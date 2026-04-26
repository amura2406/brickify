"""
Photorealistic mosaic generation algorithm.
Attempts to match the perceptual color of the reference image as closely as possible.
"""

import numpy as np
from PIL import Image
from algos.color_math import rgb_to_lab, single_rgb_to_lab, ciede2000, compute_importance_map


def analyze_palette_relevance(
    img: Image.Image,
    palette_rgb: list[tuple],
    grid_w: int,
    grid_h: int,
    weights: np.ndarray | None = None,
) -> np.ndarray:
    """Analyze how relevant each palette color is for the given image.

    Args:
        weights: Optional per-color weight multipliers (0.0=excluded, 0.1–3.0).
                 Boosted colors become more relevant; excluded ones (0.0) get
                 relevance 0.0 so they receive the maximum penalty.
    """
    small = img.resize((grid_w, grid_h), Image.Resampling.LANCZOS)
    pixels = np.array(small, dtype=np.float64)
    pixels_lab = rgb_to_lab(pixels)
    flat_lab = pixels_lab.reshape(-1, 3)

    palette_lab = np.array([single_rgb_to_lab(rgb) for rgb in palette_rgb])
    n_colors = len(palette_lab)
    n_pixels = flat_lab.shape[0]

    # Compute CIEDE2000 distances
    distances = np.zeros((n_pixels, n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        distances[:, i] = ciede2000(flat_lab, pal_broadcast)

    nearest = np.argmin(distances, axis=1)
    color_demand = np.bincount(nearest, minlength=n_colors).astype(np.float64)

    total_pixels = float(n_pixels)
    demand_fraction = color_demand / total_pixels

    avg_nearness = np.zeros(n_colors)
    for i in range(n_colors):
        close_pixels = np.sum(distances[:, i] < 25)
        avg_nearness[i] = close_pixels / total_pixels

    relevance = 0.6 * demand_fraction / max(demand_fraction.max(), 1e-6) + \
                0.4 * avg_nearness / max(avg_nearness.max(), 1e-6)

    palette_chroma = np.sqrt(palette_lab[:, 1] ** 2 + palette_lab[:, 2] ** 2)
    is_achromatic = palette_chroma < 15
    relevance[is_achromatic] = np.maximum(relevance[is_achromatic], 0.5)

    # ── Luminance-aware fallback for under-utilised colors ──
    # Colors with low demand (relevance < 0.15) that are NOT excluded get a
    # softer penalty when the pixel luminance matches.  Instead of modifying
    # the scalar relevance, we flag them so generate_realistic* can apply a
    # luminance-conditional reduced penalty.
    # We encode this by boosting their relevance to a minimum of 0.25 when
    # weighted demand is still low — this softens the 3× penalty down to ~2.5×.
    if weights is None:
        # Default behaviour: give under-utilised colors a small relevance lift
        low_demand = relevance < 0.15
        # Only lift non-achromatic low-demand colors (achromatics already get 0.5)
        lift_mask = low_demand & ~is_achromatic
        relevance[lift_mask] = np.maximum(relevance[lift_mask], 0.15)
    else:
        # Apply user weights: boost / suppress relevance
        relevance *= weights
        # Excluded colors (weight == 0.0) → relevance 0.0 → max penalty
        # For non-excluded colors with low demand, apply luminance fallback
        active_mask = weights > 0.0
        low_demand = (relevance < 0.15) & active_mask & ~is_achromatic
        relevance[low_demand] = np.maximum(relevance[low_demand], 0.15)

    relevance = np.clip(relevance, 0.0, 1.0)
    return relevance


def generate_realistic(
    pixels: np.ndarray,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    relevance: np.ndarray,
    weights: np.ndarray | None = None,
) -> list:
    """Nearest-color assignment with relevance weighting and constraints.

    Args:
        weights: Optional per-color weight multipliers.
                 0.0 = excluded (max_counts zeroed).
                 > 1.0 = boosted (effective distance divided by weight).
                 < 1.0 = suppressed (effective distance increased).
    """
    # Zero-out excluded colors
    effective_counts = max_counts.copy()
    if weights is not None:
        effective_counts[weights == 0.0] = 0

    pixels_lab = rgb_to_lab(pixels)
    n_colors = len(palette_lab)

    flat_lab = pixels_lab.reshape(-1, 3)
    n_pixels = flat_lab.shape[0]

    distances_raw = np.zeros((n_pixels, n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        distances_raw[:, i] = ciede2000(flat_lab, pal_broadcast)

    penalties = 1.0 + 2.0 * (1.0 - relevance)
    distances = distances_raw * penalties[np.newaxis, :]

    # Apply weight as distance modifier: higher weight = lower distance.
    # weight 3.0 → distance / 3.0 (color appears 3× closer)
    # weight 0.5 → distance / 0.5 = distance × 2.0 (color pushed away)
    if weights is not None:
        active = weights > 0
        weight_divisors = np.ones(n_colors)
        weight_divisors[active] = np.clip(weights[active], 0.1, 3.0)
        distances /= weight_divisors[np.newaxis, :]

    sorted_indices = np.argsort(distances, axis=1)
    assignment = sorted_indices[:, 0].copy()
    importance = compute_importance_map(grid_h, grid_w)

    for iteration in range(10):
        used = np.bincount(assignment, minlength=n_colors)
        overbudget = np.where(used > effective_counts)[0]

        if len(overbudget) == 0:
            break

        for ci in overbudget:
            pixel_mask = assignment == ci
            pixel_indices = np.where(pixel_mask)[0]

            pixel_dists = distances[pixel_indices, ci]
            dist_norm = pixel_dists / max(pixel_dists.max(), 1e-6)
            imp_vals = importance[pixel_indices]

            reassign_score = (1.0 - imp_vals) * 0.4 + dist_norm * 0.6
            worst_first = pixel_indices[np.argsort(-reassign_score)]

            excess = int(used[ci] - effective_counts[ci])
            to_reassign = worst_first[:excess]

            for px in to_reassign:
                for rank in range(1, n_colors):
                    alt_ci = sorted_indices[px, rank]
                    current_used = np.sum(assignment == alt_ci)
                    if current_used < effective_counts[alt_ci]:
                        assignment[px] = alt_ci
                        break

    grid = assignment.reshape(grid_h, grid_w).tolist()
    return grid


def generate_realistic_dithered(
    pixels: np.ndarray,
    palette_rgb: list,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    relevance: np.ndarray,
    weights: np.ndarray | None = None,
) -> list:
    """Floyd-Steinberg dithering with relevance weighting and constraints.

    Args:
        weights: Optional per-color weight multipliers.
                 0.0 = excluded (max_counts zeroed).
                 > 1.0 = boosted (effective distance divided by weight).
                 < 1.0 = suppressed (effective distance increased).
    """
    # Zero-out excluded colors
    effective_counts = max_counts.copy()
    if weights is not None:
        effective_counts[weights == 0.0] = 0

    img_float = pixels.copy()
    penalties = 1.0 + 2.0 * (1.0 - relevance)

    # Pre-compute weight divisors for distance modulation
    n_colors = len(palette_lab)
    weight_divisors = np.ones(n_colors)
    if weights is not None:
        active = weights > 0
        weight_divisors[active] = np.clip(weights[active], 0.1, 3.0)

    grid = [[0] * grid_w for _ in range(grid_h)]
    used = np.zeros(n_colors, dtype=int)

    for y in range(grid_h):
        for x in range(grid_w):
            old_pixel = img_float[y, x].copy()
            old_lab = single_rgb_to_lab(tuple(np.clip(old_pixel, 0, 255).astype(int)))

            dists = np.array([
                ciede2000(
                    old_lab.reshape(1, 3),
                    palette_lab[i].reshape(1, 3)
                )[0] * penalties[i] / weight_divisors[i]
                for i in range(n_colors)
            ])
            sorted_ci = np.argsort(dists)

            chosen = 0
            for ci in sorted_ci:
                if used[ci] < effective_counts[ci]:
                    chosen = int(ci)
                    break

            grid[y][x] = chosen
            used[chosen] += 1

            new_pixel = np.array(palette_rgb[chosen], dtype=np.float64)
            error = old_pixel - new_pixel

            if x + 1 < grid_w:
                img_float[y, x + 1] += error * 7 / 16
            if y + 1 < grid_h:
                if x - 1 >= 0:
                    img_float[y + 1, x - 1] += error * 3 / 16
                img_float[y + 1, x] += error * 5 / 16
                if x + 1 < grid_w:
                    img_float[y + 1, x + 1] += error * 1 / 16

    return grid
