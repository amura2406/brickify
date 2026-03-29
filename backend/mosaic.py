"""
Mosaic generation engine.

Converts an uploaded image into a LEGO mosaic grid using:
1. Palette relevance analysis (identifies which colors suit the image)
2. CIE Lab color space with CIEDE2000 perceptual color matching
3. Relevance-weighted distance penalties for unsuitable colors
4. Spatial-importance-weighted piece-count constraint resolution
5. Optional CLAHE contrast enhancement
6. Optional Floyd-Steinberg dithering
"""

import numpy as np
from PIL import Image


# ═══════════════════════════════════════════════════════════════════
#  Color Space Conversions
# ═══════════════════════════════════════════════════════════════════

def rgb_to_lab(rgb_array: np.ndarray) -> np.ndarray:
    """Convert RGB (0-255) array to CIE Lab color space.

    Uses the standard D65 illuminant.
    Input shape: (..., 3) with values 0-255
    Output shape: (..., 3) with L in [0,100], a,b in [-128, 127]
    """
    rgb = rgb_array.astype(np.float64) / 255.0
    mask = rgb > 0.04045
    rgb = np.where(mask, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)

    mat = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = rgb @ mat.T

    xyz[..., 0] /= 0.95047
    xyz[..., 1] /= 1.00000
    xyz[..., 2] /= 1.08883

    epsilon = 0.008856
    kappa = 903.3
    mask = xyz > epsilon
    xyz_f = np.where(mask, np.cbrt(xyz), (kappa * xyz + 16.0) / 116.0)

    L = 116.0 * xyz_f[..., 1] - 16.0
    a = 500.0 * (xyz_f[..., 0] - xyz_f[..., 1])
    b = 200.0 * (xyz_f[..., 1] - xyz_f[..., 2])

    return np.stack([L, a, b], axis=-1)


def single_rgb_to_lab(rgb: tuple) -> np.ndarray:
    """Convert a single RGB tuple to Lab."""
    arr = np.array([[list(rgb)]], dtype=np.float64)
    lab = rgb_to_lab(arr)
    return lab[0, 0]


def lab_to_rgb(lab_array: np.ndarray) -> np.ndarray:
    """Convert CIE Lab array back to RGB (0-255)."""
    L = lab_array[..., 0]
    a = lab_array[..., 1]
    b = lab_array[..., 2]

    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0

    epsilon = 0.008856
    kappa = 903.3

    x = np.where(fx ** 3 > epsilon, fx ** 3, (116.0 * fx - 16.0) / kappa)
    y = np.where(L > kappa * epsilon, ((L + 16.0) / 116.0) ** 3, L / kappa)
    z = np.where(fz ** 3 > epsilon, fz ** 3, (116.0 * fz - 16.0) / kappa)

    x *= 0.95047
    y *= 1.00000
    z *= 1.08883

    xyz = np.stack([x, y, z], axis=-1)
    mat_inv = np.array([
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252],
    ])
    rgb_linear = xyz @ mat_inv.T
    rgb_linear = np.clip(rgb_linear, 0, 1)
    mask = rgb_linear > 0.0031308
    rgb_srgb = np.where(mask, 1.055 * (rgb_linear ** (1.0 / 2.4)) - 0.055, 12.92 * rgb_linear)

    return np.clip(rgb_srgb * 255.0, 0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════════
#  CIEDE2000 Color Distance
# ═══════════════════════════════════════════════════════════════════

def ciede2000(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """CIEDE2000 color difference (vectorized)."""
    L1, a1, b1 = lab1[..., 0], lab1[..., 1], lab1[..., 2]
    L2, a2, b2 = lab2[..., 0], lab2[..., 1], lab2[..., 2]

    C1 = np.sqrt(a1 ** 2 + b1 ** 2)
    C2 = np.sqrt(a2 ** 2 + b2 ** 2)
    C_avg = (C1 + C2) / 2.0
    C_avg7 = C_avg ** 7
    G = 0.5 * (1.0 - np.sqrt(C_avg7 / (C_avg7 + 25.0 ** 7)))

    a1_prime = a1 * (1.0 + G)
    a2_prime = a2 * (1.0 + G)

    C1_prime = np.sqrt(a1_prime ** 2 + b1 ** 2)
    C2_prime = np.sqrt(a2_prime ** 2 + b2 ** 2)

    h1_prime = np.degrees(np.arctan2(b1, a1_prime)) % 360
    h2_prime = np.degrees(np.arctan2(b2, a2_prime)) % 360

    dL_prime = L2 - L1
    dC_prime = C2_prime - C1_prime

    h_diff = h2_prime - h1_prime
    C_product = C1_prime * C2_prime

    dh_prime = np.where(
        C_product == 0, 0.0,
        np.where(np.abs(h_diff) <= 180, h_diff,
                 np.where(h_diff > 180, h_diff - 360, h_diff + 360))
    )
    dH_prime = 2.0 * np.sqrt(C_product) * np.sin(np.radians(dh_prime / 2.0))

    L_avg = (L1 + L2) / 2.0
    C_avg_prime = (C1_prime + C2_prime) / 2.0

    h_sum = h1_prime + h2_prime
    h_avg_prime = np.where(
        C_product == 0, h_sum,
        np.where(np.abs(h_diff) <= 180, h_sum / 2.0,
                 np.where(h_sum < 360, (h_sum + 360) / 2.0, (h_sum - 360) / 2.0))
    )

    T = (1.0
         - 0.17 * np.cos(np.radians(h_avg_prime - 30))
         + 0.24 * np.cos(np.radians(2 * h_avg_prime))
         + 0.32 * np.cos(np.radians(3 * h_avg_prime + 6))
         - 0.20 * np.cos(np.radians(4 * h_avg_prime - 63)))

    SL = 1.0 + 0.015 * (L_avg - 50) ** 2 / np.sqrt(20 + (L_avg - 50) ** 2)
    SC = 1.0 + 0.045 * C_avg_prime
    SH = 1.0 + 0.015 * C_avg_prime * T

    C_avg_prime7 = C_avg_prime ** 7
    RT = (-2.0 * np.sqrt(C_avg_prime7 / (C_avg_prime7 + 25.0 ** 7))
          * np.sin(np.radians(60.0 * np.exp(-((h_avg_prime - 275) / 25.0) ** 2))))

    dE = np.sqrt(
        (dL_prime / SL) ** 2 +
        (dC_prime / SC) ** 2 +
        (dH_prime / SH) ** 2 +
        RT * (dC_prime / SC) * (dH_prime / SH)
    )

    return dE


# ═══════════════════════════════════════════════════════════════════
#  Palette Relevance Analysis
# ═══════════════════════════════════════════════════════════════════

def analyze_palette_relevance(
    img: Image.Image,
    palette_rgb: list[tuple],
    grid_w: int,
    grid_h: int,
) -> np.ndarray:
    """Analyze how relevant each palette color is for the given image.

    Computes a relevance score [0, 1] for each palette color:
    - Colors that many image pixels naturally map to → high relevance
    - Colors that no pixels naturally map to → low relevance

    This is used to add distance penalties during mosaic generation,
    suppressing colors that would look wrong (e.g., blue in a sepia photo).

    Returns: array of shape (n_colors,) with relevance scores
    """
    small = img.resize((grid_w, grid_h), Image.Resampling.LANCZOS)
    pixels = np.array(small, dtype=np.float64)
    pixels_lab = rgb_to_lab(pixels)
    flat_lab = pixels_lab.reshape(-1, 3)

    palette_lab = np.array([single_rgb_to_lab(rgb) for rgb in palette_rgb])
    n_colors = len(palette_lab)
    n_pixels = flat_lab.shape[0]

    # Compute CIEDE2000 distances to all palette colors
    distances = np.zeros((n_pixels, n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        distances[:, i] = ciede2000(flat_lab, pal_broadcast)

    # For each pixel, find its nearest palette color
    nearest = np.argmin(distances, axis=1)
    color_demand = np.bincount(nearest, minlength=n_colors).astype(np.float64)

    # Normalize: how much of the image wants each color
    total_pixels = float(n_pixels)
    demand_fraction = color_demand / total_pixels

    # Also consider average distance: colors that are close matches
    # to many pixels are more relevant even if not the nearest
    avg_nearness = np.zeros(n_colors)
    for i in range(n_colors):
        # What fraction of pixels have this color within ΔE 25?
        close_pixels = np.sum(distances[:, i] < 25)
        avg_nearness[i] = close_pixels / total_pixels

    # Combined relevance score
    relevance = 0.6 * demand_fraction / max(demand_fraction.max(), 1e-6) + \
                0.4 * avg_nearness / max(avg_nearness.max(), 1e-6)

    # Achromatic colors (low chroma) are always somewhat relevant
    # because they represent shadows, highlights, grays
    palette_chroma = np.sqrt(palette_lab[:, 1] ** 2 + palette_lab[:, 2] ** 2)
    is_achromatic = palette_chroma < 15  # Low saturation
    relevance[is_achromatic] = np.maximum(relevance[is_achromatic], 0.5)

    # Ensure minimum relevance (never 100% block a color)
    relevance = np.clip(relevance, 0.05, 1.0)

    return relevance


# ═══════════════════════════════════════════════════════════════════
#  CLAHE Preprocessing
# ═══════════════════════════════════════════════════════════════════

def _clahe_channel(channel: np.ndarray, clip_limit: float = 2.0,
                   grid_size: int = 8) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization).
    Pure numpy implementation — no OpenCV needed.
    """
    h, w = channel.shape
    pad_h = (grid_size - h % grid_size) % grid_size
    pad_w = (grid_size - w % grid_size) % grid_size
    padded = np.pad(channel, ((0, pad_h), (0, pad_w)), mode='reflect')
    ph, pw = padded.shape
    actual_tile_h = ph // grid_size
    actual_tile_w = pw // grid_size

    n_bins = 256
    clip_count = max(1, int(clip_limit * actual_tile_h * actual_tile_w / n_bins))

    luts = np.zeros((grid_size, grid_size, n_bins), dtype=np.float64)
    for ty in range(grid_size):
        for tx in range(grid_size):
            y0 = ty * actual_tile_h
            x0 = tx * actual_tile_w
            tile = padded[y0:y0 + actual_tile_h, x0:x0 + actual_tile_w]
            hist = np.bincount(tile.ravel(), minlength=n_bins).astype(np.float64)
            excess = np.sum(np.maximum(hist - clip_count, 0))
            hist = np.minimum(hist, clip_count)
            hist += excess / n_bins
            cdf = np.cumsum(hist)
            cdf = (cdf - cdf.min()) / max(cdf.max() - cdf.min(), 1) * 255
            luts[ty, tx] = cdf

    result = np.zeros_like(padded, dtype=np.float64)
    for ty in range(grid_size):
        for tx in range(grid_size):
            y0 = ty * actual_tile_h
            x0 = tx * actual_tile_w
            y1 = y0 + actual_tile_h
            x1 = x0 + actual_tile_w
            tile = padded[y0:y1, x0:x1]
            result[y0:y1, x0:x1] = luts[ty, tx][tile]

    return result[:h, :w].astype(np.uint8)


def preprocess_image(
    img: Image.Image,
    palette_rgb: list[tuple],
    contrast_boost: float = 1.0,
) -> Image.Image:
    """Apply CLAHE contrast enhancement to the image."""
    if contrast_boost <= 0:
        return img.copy()

    arr = np.array(img, dtype=np.float64)
    lab = rgb_to_lab(arr)
    L_u8 = np.clip(lab[..., 0] * 255.0 / 100.0, 0, 255).astype(np.uint8)
    L_enhanced = _clahe_channel(L_u8, clip_limit=2.0 * contrast_boost)
    lab[..., 0] = L_enhanced.astype(np.float64) * 100.0 / 255.0
    arr = lab_to_rgb(lab).astype(np.float64)

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def generate_palette_preview(
    img: Image.Image,
    palette_rgb: list[tuple],
    grid_w: int,
    grid_h: int,
    preprocessing: bool = True,
    contrast_boost: float = 1.0,
) -> Image.Image:
    """Generate a preview of the image mapped to palette colors.

    Uses relevance-weighted color matching (same as full generation)
    but without piece count constraints.
    """
    processed = img.copy()
    if preprocessing:
        processed = preprocess_image(processed, palette_rgb,
                                     contrast_boost=contrast_boost)

    # Analyze relevance
    relevance = analyze_palette_relevance(processed, palette_rgb, grid_w, grid_h)

    resized = processed.resize((grid_w, grid_h), Image.Resampling.LANCZOS)
    pixels = np.array(resized, dtype=np.float64)
    pixels_lab = rgb_to_lab(pixels)
    flat_lab = pixels_lab.reshape(-1, 3)

    palette_lab = np.array([single_rgb_to_lab(rgb) for rgb in palette_rgb])
    n_colors = len(palette_lab)

    # Compute distances with relevance penalties
    distances = np.zeros((flat_lab.shape[0], n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        base_dist = ciede2000(flat_lab, pal_broadcast)
        # Penalty for irrelevant colors: multiply distance by up to 3x
        penalty = 1.0 + 2.0 * (1.0 - relevance[i])
        distances[:, i] = base_dist * penalty

    nearest = np.argmin(distances, axis=1)

    palette_arr = np.array(palette_rgb, dtype=np.uint8)
    result = palette_arr[nearest].reshape(grid_h, grid_w, 3)

    preview = Image.fromarray(result)
    scale = 10
    preview = preview.resize((grid_w * scale, grid_h * scale),
                             Image.Resampling.NEAREST)
    return preview


# ═══════════════════════════════════════════════════════════════════
#  Spatial Importance Map
# ═══════════════════════════════════════════════════════════════════

def _compute_importance_map(grid_h: int, grid_w: int) -> np.ndarray:
    """Compute a spatial importance map for constraint resolution.

    Center pixels are more important and protected from reassignment.
    Returns flat array of values in [0, 1] where 1 = center.
    """
    y_coords = np.arange(grid_h, dtype=np.float64)
    x_coords = np.arange(grid_w, dtype=np.float64)
    yy, xx = np.meshgrid(y_coords, x_coords, indexing='ij')

    cy = (yy - grid_h / 2) / (grid_h / 2)
    cx = (xx - grid_w / 2) / (grid_w / 2)

    dist = np.sqrt(cx ** 2 + cy ** 2)
    importance = 1.0 - np.clip(dist / 1.4, 0, 1)

    return importance.ravel()


# ═══════════════════════════════════════════════════════════════════
#  Mosaic Generation
# ═══════════════════════════════════════════════════════════════════

def generate_mosaic(
    image: Image.Image,
    set_data: dict,
    dithering: bool = False,
    crop_box: dict | None = None,
    preprocessing: bool = True,
    contrast_boost: float = 1.0,
) -> dict:
    """Generate a LEGO mosaic from an image.

    Args:
        image: PIL Image (RGB)
        set_data: LEGO set definition from lego_sets.py
        dithering: Enable Floyd-Steinberg dithering
        crop_box: Optional {x, y, size} for square crop
        preprocessing: Enable palette-aware preprocessing
        contrast_boost: Contrast enhancement multiplier (0.0-2.0)

    Returns:
        dict with grid, colors, width, height
    """
    img = image.convert("RGB")

    # Apply crop if provided
    if crop_box:
        x = int(crop_box["x"])
        y = int(crop_box["y"])
        size = int(crop_box["size"])
        img = img.crop((x, y, x + size, y + size))

    palette_rgb = [c["rgb"] for c in set_data["colors"]]
    grid_w, grid_h = set_data["grid"]

    # Preprocess
    if preprocessing:
        img = preprocess_image(img, palette_rgb, contrast_boost=contrast_boost)

    # Analyze palette relevance BEFORE resizing
    relevance = analyze_palette_relevance(img, palette_rgb, grid_w, grid_h)

    # Resize to grid dimensions
    img = img.resize((grid_w, grid_h), Image.Resampling.LANCZOS)

    # Convert image to numpy array
    pixels = np.array(img, dtype=np.float64)

    # Prepare palette in Lab space
    palette_lab = np.array([single_rgb_to_lab(rgb) for rgb in palette_rgb])
    max_counts = np.array([c["count"] for c in set_data["colors"]])

    if dithering:
        grid = _generate_with_dithering(pixels, palette_rgb, palette_lab,
                                        max_counts, grid_w, grid_h, relevance)
    else:
        grid = _generate_nearest(pixels, palette_lab, max_counts,
                                 grid_w, grid_h, relevance)

    # Count used pieces per color
    used_counts = [0] * len(set_data["colors"])
    for row in grid:
        for ci in row:
            used_counts[ci] += 1

    colors_info = []
    for i, c in enumerate(set_data["colors"]):
        colors_info.append({
            "name": c["name"],
            "hex": c["hex"],
            "rgb": list(c["rgb"]),
            "count": c["count"],
            "used": used_counts[i],
        })

    return {
        "grid": grid,
        "colors": colors_info,
        "width": grid_w,
        "height": grid_h,
    }


def _generate_nearest(
    pixels: np.ndarray,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    relevance: np.ndarray,
) -> list:
    """Nearest-color assignment with relevance weighting and piece constraints.

    Uses CIEDE2000 + relevance penalties to prefer colors that naturally
    suit the image. Spatial importance weighting protects center pixels.
    """
    pixels_lab = rgb_to_lab(pixels)
    n_colors = len(palette_lab)

    flat_lab = pixels_lab.reshape(-1, 3)
    n_pixels = flat_lab.shape[0]

    # Compute CIEDE2000 distances
    distances_raw = np.zeros((n_pixels, n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        distances_raw[:, i] = ciede2000(flat_lab, pal_broadcast)

    # Apply relevance penalty: multiply distance for irrelevant colors
    # Penalty ranges from 1.0 (fully relevant) to 3.0 (fully irrelevant)
    penalties = 1.0 + 2.0 * (1.0 - relevance)
    distances = distances_raw * penalties[np.newaxis, :]

    # Sort color indices by penalized distance
    sorted_indices = np.argsort(distances, axis=1)

    # Initial assignment: nearest color (after penalty)
    assignment = sorted_indices[:, 0].copy()

    # Spatial importance map
    importance = _compute_importance_map(grid_h, grid_w)

    # Fix overbudget colors
    for iteration in range(10):
        used = np.bincount(assignment, minlength=n_colors)
        overbudget = np.where(used > max_counts)[0]

        if len(overbudget) == 0:
            break

        for ci in overbudget:
            pixel_mask = assignment == ci
            pixel_indices = np.where(pixel_mask)[0]

            pixel_dists = distances[pixel_indices, ci]
            dist_norm = pixel_dists / max(pixel_dists.max(), 1e-6)
            imp_vals = importance[pixel_indices]

            # Reassign worst-match + low-importance pixels first
            reassign_score = (1.0 - imp_vals) * 0.4 + dist_norm * 0.6
            worst_first = pixel_indices[np.argsort(-reassign_score)]

            excess = int(used[ci] - max_counts[ci])
            to_reassign = worst_first[:excess]

            for px in to_reassign:
                for rank in range(1, n_colors):
                    alt_ci = sorted_indices[px, rank]
                    current_used = np.sum(assignment == alt_ci)
                    if current_used < max_counts[alt_ci]:
                        assignment[px] = alt_ci
                        break

    grid = assignment.reshape(grid_h, grid_w).tolist()
    return grid


def _generate_with_dithering(
    pixels: np.ndarray,
    palette_rgb: list,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    relevance: np.ndarray,
) -> list:
    """Floyd-Steinberg dithering with relevance weighting and constraints."""
    img_float = pixels.copy()

    # Precompute penalties
    penalties = 1.0 + 2.0 * (1.0 - relevance)

    grid = [[0] * grid_w for _ in range(grid_h)]
    used = np.zeros(len(palette_lab), dtype=int)

    for y in range(grid_h):
        for x in range(grid_w):
            old_pixel = img_float[y, x].copy()
            old_lab = single_rgb_to_lab(tuple(np.clip(old_pixel, 0, 255).astype(int)))

            # Find nearest available color with relevance penalties
            dists = np.array([
                ciede2000(
                    old_lab.reshape(1, 3),
                    palette_lab[i].reshape(1, 3)
                )[0] * penalties[i]
                for i in range(len(palette_lab))
            ])
            sorted_ci = np.argsort(dists)

            chosen = 0
            for ci in sorted_ci:
                if used[ci] < max_counts[ci]:
                    chosen = int(ci)
                    break

            grid[y][x] = chosen
            used[chosen] += 1

            # Compute quantization error
            new_pixel = np.array(palette_rgb[chosen], dtype=np.float64)
            error = old_pixel - new_pixel

            # Distribute error (Floyd-Steinberg)
            if x + 1 < grid_w:
                img_float[y, x + 1] += error * 7 / 16
            if y + 1 < grid_h:
                if x - 1 >= 0:
                    img_float[y + 1, x - 1] += error * 3 / 16
                img_float[y + 1, x] += error * 5 / 16
                if x + 1 < grid_w:
                    img_float[y + 1, x + 1] += error * 1 / 16

    return grid


# ═══════════════════════════════════════════════════════════════════
#  Mosaic Rendering
# ═══════════════════════════════════════════════════════════════════

def render_mosaic_image(
    mosaic_data: dict,
    stud_size: int = 20,
) -> Image.Image:
    """Render mosaic grid as an image with circular studs."""
    from PIL import ImageDraw

    grid = mosaic_data["grid"]
    colors = mosaic_data["colors"]
    w = mosaic_data["width"]
    h = mosaic_data["height"]

    padding = 1
    cell = stud_size + padding
    img_w = w * cell + padding
    img_h = h * cell + padding

    img = Image.new("RGB", (img_w, img_h), (30, 30, 30))
    draw = ImageDraw.Draw(img)

    for y in range(h):
        for x in range(w):
            ci = grid[y][x]
            color = tuple(colors[ci]["rgb"])
            cx = x * cell + padding
            cy = y * cell + padding

            margin = 1
            draw.ellipse(
                [cx + margin, cy + margin, cx + stud_size - margin, cy + stud_size - margin],
                fill=color,
            )

            highlight_margin = stud_size // 4
            highlight_color = tuple(min(255, c + 40) for c in color)
            draw.ellipse(
                [
                    cx + highlight_margin,
                    cy + highlight_margin,
                    cx + highlight_margin + stud_size // 4,
                    cy + highlight_margin + stud_size // 4,
                ],
                fill=highlight_color,
            )

    return img
