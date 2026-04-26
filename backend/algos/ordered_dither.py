"""
Ordered Dithering mosaic generation algorithm.

Uses a Bayer threshold matrix to produce structured, visually pleasing
dither patterns that break up color banding — similar to newspaper
printing and LEGO's own official Art set reference designs.

Respects piece count constraints via iterative over-budget reassignment.
"""

import numpy as np

from algos.color_math import rgb_to_lab, ciede2000, compute_importance_map
from algos.dither_utils import bayer_matrix


def generate_ordered_dither(
    pixels: np.ndarray,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    weights: np.ndarray | None = None,
) -> list:
    """Ordered-dither color assignment with Bayer matrix thresholding.

    For each pixel the two perceptually closest palette colors are found.
    A Bayer threshold determines which of the two is chosen, producing a
    structured crosshatch pattern instead of flat nearest-neighbor banding.

    Args:
        pixels: (grid_h, grid_w, 3) float64 RGB image.
        palette_lab: (N, 3) Lab palette.
        max_counts: (N,) available piece counts per color.
        grid_w: Grid width in studs.
        grid_h: Grid height in studs.
        weights: Optional per-color weight multipliers (0.0=excluded).

    Returns:
        list[list[int]] — grid of palette indices.
    """
    effective_counts = max_counts.copy()
    if weights is not None:
        effective_counts[weights == 0.0] = 0

    # ── 1. Compute CIEDE2000 distances ──
    pixels_lab = rgb_to_lab(pixels)
    n_colors = len(palette_lab)
    flat_lab = pixels_lab.reshape(-1, 3)
    n_pixels = flat_lab.shape[0]

    distances = np.zeros((n_pixels, n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        distances[:, i] = ciede2000(flat_lab, pal_broadcast)

    # Apply weight modifier (same logic as realistic)
    if weights is not None:
        active = weights > 0
        weight_divisors = np.ones(n_colors)
        weight_divisors[active] = np.clip(weights[active], 0.1, 3.0)
        distances /= weight_divisors[np.newaxis, :]

    # ── 2. Find two closest colors per pixel ──
    sorted_indices = np.argsort(distances, axis=1)
    best = sorted_indices[:, 0]
    second = sorted_indices[:, 1]

    best_dist = distances[np.arange(n_pixels), best]
    second_dist = distances[np.arange(n_pixels), second]

    # Blend ratio: 0.0 = exactly best, 1.0 = exactly second
    total_dist = best_dist + second_dist
    # Avoid division by zero when pixel exactly matches a palette color
    safe_total = np.where(total_dist > 0, total_dist, 1.0)
    blend = best_dist / safe_total

    # ── 3. Bayer threshold ──
    bayer = bayer_matrix(8)
    # Tile the Bayer matrix across the grid
    threshold = np.tile(
        bayer,
        (
            (grid_h + 7) // 8,
            (grid_w + 7) // 8,
        ),
    )[:grid_h, :grid_w].ravel()

    # Choose: if blend > threshold → second color, else → best color
    assignment = np.where(blend > threshold, second, best)

    # ── 4. Constraint enforcement (same approach as realistic.py) ──
    importance = compute_importance_map(grid_h, grid_w)

    for _iteration in range(10):
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
                for rank in range(n_colors):
                    alt_ci = sorted_indices[px, rank]
                    if alt_ci == ci:
                        continue
                    if used[alt_ci] < effective_counts[alt_ci]:
                        assignment[px] = alt_ci
                        used[ci] -= 1
                        used[alt_ci] += 1
                        break

    grid = assignment.reshape(grid_h, grid_w).tolist()
    return grid
