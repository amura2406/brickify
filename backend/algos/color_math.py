"""
Low-level color math utilities and image preprocessing.
Includes color space conversions and CLAHE contrast handling.
"""

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def rgb_to_lab(rgb_array: np.ndarray) -> np.ndarray:
    """Convert RGB (0-255) array to CIE Lab color space."""
    rgb = rgb_array.astype(np.float64) / 255.0
    mask = rgb > 0.04045
    rgb = np.where(mask, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)

    mat = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ]
    )
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

    x = np.where(fx**3 > epsilon, fx**3, (116.0 * fx - 16.0) / kappa)
    y = np.where(L > kappa * epsilon, ((L + 16.0) / 116.0) ** 3, L / kappa)
    z = np.where(fz**3 > epsilon, fz**3, (116.0 * fz - 16.0) / kappa)

    x *= 0.95047
    y *= 1.00000
    z *= 1.08883

    xyz = np.stack([x, y, z], axis=-1)
    mat_inv = np.array(
        [
            [3.2404542, -1.5371385, -0.4985314],
            [-0.9692660, 1.8760108, 0.0415560],
            [0.0556434, -0.2040259, 1.0572252],
        ]
    )
    rgb_linear = xyz @ mat_inv.T
    rgb_linear = np.clip(rgb_linear, 0, 1)
    mask = rgb_linear > 0.0031308
    rgb_srgb = np.where(
        mask, 1.055 * (rgb_linear ** (1.0 / 2.4)) - 0.055, 12.92 * rgb_linear
    )

    return np.clip(rgb_srgb * 255.0, 0, 255).astype(np.uint8)


def ciede2000(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """CIEDE2000 color difference (vectorized)."""
    L1, a1, b1 = lab1[..., 0], lab1[..., 1], lab1[..., 2]
    L2, a2, b2 = lab2[..., 0], lab2[..., 1], lab2[..., 2]

    C1 = np.sqrt(a1**2 + b1**2)
    C2 = np.sqrt(a2**2 + b2**2)
    C_avg = (C1 + C2) / 2.0
    C_avg7 = C_avg**7
    G = 0.5 * (1.0 - np.sqrt(C_avg7 / (C_avg7 + 25.0**7)))

    a1_prime = a1 * (1.0 + G)
    a2_prime = a2 * (1.0 + G)

    C1_prime = np.sqrt(a1_prime**2 + b1**2)
    C2_prime = np.sqrt(a2_prime**2 + b2**2)

    h1_prime = np.degrees(np.arctan2(b1, a1_prime)) % 360
    h2_prime = np.degrees(np.arctan2(b2, a2_prime)) % 360

    dL_prime = L2 - L1
    dC_prime = C2_prime - C1_prime

    h_diff = h2_prime - h1_prime
    C_product = C1_prime * C2_prime

    dh_prime = np.where(
        C_product == 0,
        0.0,
        np.where(
            np.abs(h_diff) <= 180,
            h_diff,
            np.where(h_diff > 180, h_diff - 360, h_diff + 360),
        ),
    )
    dH_prime = 2.0 * np.sqrt(C_product) * np.sin(np.radians(dh_prime / 2.0))

    L_avg = (L1 + L2) / 2.0
    C_avg_prime = (C1_prime + C2_prime) / 2.0

    h_sum = h1_prime + h2_prime
    h_avg_prime = np.where(
        C_product == 0,
        h_sum,
        np.where(
            np.abs(h_diff) <= 180,
            h_sum / 2.0,
            np.where(h_sum < 360, (h_sum + 360) / 2.0, (h_sum - 360) / 2.0),
        ),
    )

    T = (
        1.0
        - 0.17 * np.cos(np.radians(h_avg_prime - 30))
        + 0.24 * np.cos(np.radians(2 * h_avg_prime))
        + 0.32 * np.cos(np.radians(3 * h_avg_prime + 6))
        - 0.20 * np.cos(np.radians(4 * h_avg_prime - 63))
    )

    SL = 1.0 + 0.015 * (L_avg - 50) ** 2 / np.sqrt(20 + (L_avg - 50) ** 2)
    SC = 1.0 + 0.045 * C_avg_prime
    SH = 1.0 + 0.015 * C_avg_prime * T

    C_avg_prime7 = C_avg_prime**7
    RT = (
        -2.0
        * np.sqrt(C_avg_prime7 / (C_avg_prime7 + 25.0**7))
        * np.sin(np.radians(60.0 * np.exp(-(((h_avg_prime - 275) / 25.0) ** 2))))
    )

    dE = np.sqrt(
        (dL_prime / SL) ** 2
        + (dC_prime / SC) ** 2
        + (dH_prime / SH) ** 2
        + RT * (dC_prime / SC) * (dH_prime / SH)
    )

    return dE


def _clahe_channel(
    channel: np.ndarray, clip_limit: float = 2.0, grid_size: int = 8
) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)."""
    h, w = channel.shape
    pad_h = (grid_size - h % grid_size) % grid_size
    pad_w = (grid_size - w % grid_size) % grid_size
    padded = np.pad(channel, ((0, pad_h), (0, pad_w)), mode="reflect")
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
            tile = padded[y0 : y0 + actual_tile_h, x0 : x0 + actual_tile_w]
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
    contrast_boost: float = 1.0,
    saturation: float = 0.0,  # -100 to 100
    temperature: float = 0.0,  # -50 to 50
    sharpen: float = 0.0,  # 0 to 5
    posterize_levels: int = 32,  # 2 to 32
    gamma: float = 1.0,  # 0.2 to 3.0
    black_point: int = 0,  # 0 to 100
    white_point: int = 255,  # 155 to 255
) -> Image.Image:
    """Apply sequential image preprocessing adjustments."""
    if (
        contrast_boost <= 0
        and saturation == 0.0
        and temperature == 0.0
        and sharpen <= 0
        and posterize_levels >= 32
        and gamma == 1.0
        and black_point <= 0
        and white_point >= 255
    ):
        return img.copy()

    # 1, 2, 4. Black/White point, Gamma, Temperature -> all can be done in one numpy step
    arr = np.array(img, dtype=np.float64)

    if black_point > 0 or white_point < 255:
        black = max(0, black_point)
        white = min(255, max(black + 1, white_point))
        arr = (arr - black) / (white - black) * 255.0
        arr = np.clip(arr, 0, 255)

    if gamma != 1.0 and gamma > 0:
        arr = 255.0 * (arr / 255.0) ** (1.0 / gamma)

    if temperature != 0.0:
        arr[..., 0] += temperature * 0.5  # R
        arr[..., 2] -= temperature * 0.5  # B
        arr = np.clip(arr, 0, 255)

    img = Image.fromarray(arr.astype(np.uint8))

    # 3. Saturation
    if saturation != 0.0:
        sat_factor = max(0.0, 1.0 + (saturation / 100.0))
        img = ImageEnhance.Color(img).enhance(sat_factor)

    # 5. CLAHE (existing)
    if contrast_boost > 0:
        arr = np.array(img, dtype=np.float64)
        lab = rgb_to_lab(arr)
        L_u8 = np.clip(lab[..., 0] * 255.0 / 100.0, 0, 255).astype(np.uint8)
        L_enhanced = _clahe_channel(L_u8, clip_limit=2.0 * contrast_boost)
        lab[..., 0] = L_enhanced.astype(np.float64) * 100.0 / 255.0
        arr = lab_to_rgb(lab).astype(np.float64)
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    # 6. Sharpening
    if sharpen > 0:
        # percent up to 500% (so 5.0 -> 500%)
        img = img.filter(
            ImageFilter.UnsharpMask(radius=2, percent=int(sharpen * 100), threshold=3)
        )

    # 7. Posterize
    if posterize_levels < 32:
        levels = max(2, posterize_levels)
        arr = np.array(img, dtype=np.float64)
        factor = 255.0 / (levels - 1)
        arr = np.round(arr / factor) * factor
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    return img


def compute_importance_map(grid_h: int, grid_w: int) -> np.ndarray:
    """Compute a spatial importance map for constraint resolution."""
    y_coords = np.arange(grid_h, dtype=np.float64)
    x_coords = np.arange(grid_w, dtype=np.float64)
    yy, xx = np.meshgrid(y_coords, x_coords, indexing="ij")

    cy = (yy - grid_h / 2) / (grid_h / 2)
    cx = (xx - grid_w / 2) / (grid_w / 2)

    dist = np.sqrt(cx**2 + cy**2)
    importance = 1.0 - np.clip(dist / 1.4, 0, 1)

    return importance.ravel()
