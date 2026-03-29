"""
Mosaic generation engine orchestration.

Delegates to algorithms in `backend/algos/` based on `color_mode`:
- `realistic`: Perceptual CIEDE2000 color matching with dithering support and constraints.
- `pop_art`: Luminance and ratio-based stylization for Andy Warhol style generation.
"""

import numpy as np
from PIL import Image

from algos.color_math import preprocess_image, single_rgb_to_lab, rgb_to_lab, ciede2000
from algos.realistic import analyze_palette_relevance, generate_realistic, generate_realistic_dithered
from algos.pop_art import generate_pop_art_ratio

def generate_palette_preview(
    img: Image.Image,
    palette_rgb: list[tuple],
    grid_w: int,
    grid_h: int,
    preprocessing: bool = True,
    contrast_boost: float = 1.0,
) -> Image.Image:
    """Generate a preview of the image mapped to palette colors.
    (Note: Preview strictly previews photorealistic matching. Pop-art requires piece counts to visualize).
    """
    processed = img.copy()
    if processed.width > 1024 or processed.height > 1024:
        processed.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

    if preprocessing:
        processed = preprocess_image(processed, contrast_boost=contrast_boost)

    # Analyze relevance
    relevance = analyze_palette_relevance(processed, palette_rgb, grid_w, grid_h)

    resized = processed.resize((grid_w, grid_h), Image.Resampling.LANCZOS)
    pixels = np.array(resized, dtype=np.float64)
    pixels_lab = rgb_to_lab(pixels)
    flat_lab = pixels_lab.reshape(-1, 3)

    palette_lab = np.array([single_rgb_to_lab(rgb) for rgb in palette_rgb])
    n_colors = len(palette_lab)

    distances = np.zeros((flat_lab.shape[0], n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        base_dist = ciede2000(flat_lab, pal_broadcast)
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


def generate_mosaic(
    image: Image.Image,
    set_data: dict,
    dithering: bool = False,
    crop_box: dict | None = None,
    preprocessing: bool = True,
    contrast_boost: float = 1.0,
    color_mode: str = "realistic",
) -> dict:
    """Generate a LEGO mosaic from an image.

    Args:
        image: PIL Image (RGB)
        set_data: LEGO set definition from lego_sets.py
        dithering: Enable Floyd-Steinberg dithering (only used in realistic mode)
        crop_box: Optional {x, y, size} for square crop
        preprocessing: Enable palette-aware preprocessing (CLAHE)
        contrast_boost: Contrast enhancement multiplier (0.0-2.0)
        color_mode: "realistic" or "pop_art"

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

    if img.width > 1024 or img.height > 1024:
        img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

    palette_rgb = [c["rgb"] for c in set_data["colors"]]
    grid_w, grid_h = set_data["grid"]

    if preprocessing:
        img = preprocess_image(img, contrast_boost=contrast_boost)

    # Resize to grid dimensions
    img = img.resize((grid_w, grid_h), Image.Resampling.LANCZOS)

    # Convert image to numpy array
    pixels = np.array(img, dtype=np.float64)

    # Prepare palette in Lab space
    palette_lab = np.array([single_rgb_to_lab(rgb) for rgb in palette_rgb])
    max_counts = np.array([c["count"] for c in set_data["colors"]])

    if color_mode == "pop_art":
        grid = generate_pop_art_ratio(pixels, palette_lab, max_counts, grid_w, grid_h)
    else:
        # Realistic color matching
        relevance = analyze_palette_relevance(img, palette_rgb, grid_w, grid_h)
        if dithering:
            grid = generate_realistic_dithered(pixels, palette_rgb, palette_lab,
                                            max_counts, grid_w, grid_h, relevance)
        else:
            grid = generate_realistic(pixels, palette_lab, max_counts,
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
