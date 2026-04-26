"""
Edge-Aware Realistic mosaic generation algorithm.

An enhanced version of the Realistic algorithm that detects edges in the
source image and preserves them, while smoothing flat regions by
encouraging spatial coherence with neighboring pixels.

This produces cleaner backgrounds and crisper silhouettes — especially
beneficial for portraits and images with distinct foreground/background.
"""

import numpy as np

from algos.color_math import rgb_to_lab, ciede2000, compute_importance_map


def _sobel_edge_map(pixels: np.ndarray) -> np.ndarray:
    """Compute a normalized edge strength map using Sobel operators.

    Args:
        pixels: (H, W, 3) float64 RGB image.

    Returns:
        (H, W) float64 edge strength in [0, 1].
    """
    # Convert to grayscale via luminance weights
    gray = 0.299 * pixels[:, :, 0] + 0.587 * pixels[:, :, 1] + 0.114 * pixels[:, :, 2]
    gray = gray / 255.0

    h, w = gray.shape
    edge = np.zeros_like(gray)

    # Sobel kernels
    # Gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
    # Gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            gx = (
                -gray[y - 1, x - 1]
                + gray[y - 1, x + 1]
                - 2 * gray[y, x - 1]
                + 2 * gray[y, x + 1]
                - gray[y + 1, x - 1]
                + gray[y + 1, x + 1]
            )
            gy = (
                -gray[y - 1, x - 1]
                - 2 * gray[y - 1, x]
                - gray[y - 1, x + 1]
                + gray[y + 1, x - 1]
                + 2 * gray[y + 1, x]
                + gray[y + 1, x + 1]
            )
            edge[y, x] = np.sqrt(gx**2 + gy**2)

    # Normalize to [0, 1]
    max_edge = edge.max()
    if max_edge > 0:
        edge /= max_edge

    return edge


def generate_edge_aware(
    pixels: np.ndarray,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    relevance: np.ndarray,
    weights: np.ndarray | None = None,
) -> list:
    """Edge-aware color assignment with spatial coherence smoothing.

    Two-pass approach:
      1. Unconstrained CIEDE2000 nearest-color assignment (like Realistic).
      2. For non-edge pixels, apply a spatial coherence bonus — if ≥ 2 of
         the 4 direct neighbors share a color, reduce that color's distance
         by 20 %, then re-pick.

    Constraint enforcement uses the same iterative method as Realistic.

    Args:
        pixels: (grid_h, grid_w, 3) float64 RGB image.
        palette_lab: (N, 3) Lab palette.
        max_counts: (N,) available piece counts per color.
        grid_w: Grid width in studs.
        grid_h: Grid height in studs.
        relevance: (N,) palette relevance scores from analyze_palette_relevance.
        weights: Optional per-color weight multipliers (0.0=excluded).

    Returns:
        list[list[int]] — grid of palette indices.
    """
    effective_counts = max_counts.copy()
    if weights is not None:
        effective_counts[weights == 0.0] = 0

    # ── 1. Compute CIEDE2000 distances with relevance penalties ──
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

    if weights is not None:
        active = weights > 0
        weight_divisors = np.ones(n_colors)
        weight_divisors[active] = np.clip(weights[active], 0.1, 3.0)
        distances /= weight_divisors[np.newaxis, :]

    # ── 2. Pass 1: unconstrained nearest-color ──
    assignment = np.argmin(distances, axis=1).reshape(grid_h, grid_w)

    # ── 3. Edge detection ──
    edge_map = _sobel_edge_map(pixels)
    edge_threshold = 0.15  # Pixels with edge strength below this are "flat"

    # ── 4. Pass 2: spatial coherence for non-edge pixels ──
    coherence_bonus = 0.20  # 20% distance reduction for neighbor-matching colors
    distances_2d = distances.reshape(grid_h, grid_w, n_colors)

    for y in range(grid_h):
        for x in range(grid_w):
            if edge_map[y, x] >= edge_threshold:
                continue  # Edge pixel — keep original assignment

            # Count neighbor colors (4-connected)
            neighbor_colors: dict[int, int] = {}
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < grid_h and 0 <= nx < grid_w:
                    nc = int(assignment[ny, nx])
                    neighbor_colors[nc] = neighbor_colors.get(nc, 0) + 1

            # If any color appears in ≥ 2 neighbors, apply bonus
            dominant = [c for c, count in neighbor_colors.items() if count >= 2]
            if dominant:
                adjusted_dists = distances_2d[y, x].copy()
                for c in dominant:
                    adjusted_dists[c] *= 1.0 - coherence_bonus
                assignment[y, x] = int(np.argmin(adjusted_dists))

    # ── 5. Constraint enforcement ──
    assignment_flat = assignment.ravel()
    sorted_indices = np.argsort(distances, axis=1)
    importance = compute_importance_map(grid_h, grid_w)

    for _iteration in range(10):
        used = np.bincount(assignment_flat, minlength=n_colors)
        overbudget = np.where(used > effective_counts)[0]

        if len(overbudget) == 0:
            break

        for ci in overbudget:
            pixel_mask = assignment_flat == ci
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
                        assignment_flat[px] = alt_ci
                        used[ci] -= 1
                        used[alt_ci] += 1
                        break

    grid = assignment_flat.reshape(grid_h, grid_w).tolist()
    return grid
