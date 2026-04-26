"""
Color Clustering (K-means) mosaic generation algorithm.

Uses spatial + color k-means to divide the image into natural color regions,
then assigns each region to the nearest palette color. Produces mosaics
that look like color-by-number paintings with clean, organic region
boundaries — a "painterly" aesthetic.

Respects piece count constraints by reassigning over-budget clusters.
"""

import numpy as np

from algos.color_math import (
    rgb_to_lab,
    ciede2000,
    compute_importance_map,
)


def _kmeans_5d(
    features: np.ndarray,
    k: int,
    max_iter: int = 20,
    seed: int = 42,
) -> np.ndarray:
    """Simple k-means clustering on 5D feature vectors.

    Args:
        features: (N, 5) array of [x_norm, y_norm, L, a, b].
        k: Number of clusters.
        max_iter: Maximum iterations.
        seed: Random seed for reproducibility.

    Returns:
        (N,) int array of cluster labels.
    """
    rng = np.random.RandomState(seed)
    n = features.shape[0]

    # Initialize centroids using k-means++ style
    centroids = np.zeros((k, 5), dtype=np.float64)
    centroids[0] = features[rng.randint(n)]

    for c in range(1, k):
        # Distance from each point to nearest existing centroid
        dists = np.min(
            np.sum((features[:, np.newaxis, :] - centroids[:c, :]) ** 2, axis=2),
            axis=1,
        )
        # Probability proportional to distance squared
        probs = dists / max(dists.sum(), 1e-10)
        centroids[c] = features[rng.choice(n, p=probs)]

    labels = np.zeros(n, dtype=int)

    for _iteration in range(max_iter):
        # Assign to nearest centroid
        dists = np.sum(
            (features[:, np.newaxis, :] - centroids[np.newaxis, :, :]) ** 2,
            axis=2,
        )
        new_labels = np.argmin(dists, axis=1)

        # Check convergence
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels

        # Update centroids
        for c in range(k):
            mask = labels == c
            if np.any(mask):
                centroids[c] = features[mask].mean(axis=0)

    return labels


def generate_clustered(
    pixels: np.ndarray,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    weights: np.ndarray | None = None,
) -> list:
    """Clustered (painterly) mosaic generation via spatial+color k-means.

    1. Build 5D feature vectors [x_norm, y_norm, L, a, b] per pixel.
    2. Run k-means with k = min(num_palette_colors, reasonable_limit).
    3. Each cluster → nearest palette color (CIEDE2000).
    4. Enforce constraints by reassigning smallest over-budget clusters.

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

    n_colors = len(palette_lab)
    total_pixels = grid_w * grid_h

    # ── 1. Build 5D feature vectors ──
    pixels_lab = rgb_to_lab(pixels)
    flat_lab = pixels_lab.reshape(-1, 3)

    # Normalized spatial coordinates [0, 1]
    yy, xx = np.mgrid[0:grid_h, 0:grid_w]
    x_norm = (xx.ravel().astype(np.float64)) / max(grid_w - 1, 1)
    y_norm = (yy.ravel().astype(np.float64)) / max(grid_h - 1, 1)

    # Scale spatial coordinates to be comparable to Lab range
    # L is [0, 100], a/b are [-128, 127]. Spatial weight ~30 gives good balance.
    spatial_weight = 30.0
    features = np.column_stack(
        [
            x_norm * spatial_weight,
            y_norm * spatial_weight,
            flat_lab[:, 0],  # L
            flat_lab[:, 1],  # a
            flat_lab[:, 2],  # b
        ]
    )

    # ── 2. K-means clustering ──
    # Use at most the number of active palette colors, but cap for performance
    active_colors = int(np.sum(effective_counts > 0))
    k = min(active_colors, n_colors, 32)
    k = max(k, 2)  # At least 2 clusters

    labels = _kmeans_5d(features, k)

    # ── 3. Map each cluster to nearest palette color ──
    cluster_to_palette = np.zeros(k, dtype=int)
    for c in range(k):
        mask = labels == c
        if not np.any(mask):
            cluster_to_palette[c] = 0
            continue

        # Average Lab of cluster
        cluster_lab = flat_lab[mask].mean(axis=0)

        # Find nearest palette color via CIEDE2000
        cluster_lab_broadcast = np.broadcast_to(cluster_lab, palette_lab.shape)
        dists = ciede2000(palette_lab, cluster_lab_broadcast)

        # Exclude colors with 0 count
        dists[effective_counts == 0] = 1e9

        # Apply weight modifier
        if weights is not None:
            active = (weights > 0) & (effective_counts > 0)
            divisors = np.ones(n_colors)
            divisors[active] = np.clip(weights[active], 0.1, 3.0)
            dists /= divisors

        cluster_to_palette[c] = int(np.argmin(dists))

    # ── 4. Assign pixels ──
    assignment = cluster_to_palette[labels]

    # ── 5. Constraint enforcement ──
    sorted_indices_raw = np.zeros((total_pixels, n_colors), dtype=int)
    distances_raw = np.zeros((total_pixels, n_colors))
    for i in range(n_colors):
        pal_broadcast = np.broadcast_to(palette_lab[i], flat_lab.shape)
        distances_raw[:, i] = ciede2000(flat_lab, pal_broadcast)
    if weights is not None:
        active = weights > 0
        divisors = np.ones(n_colors)
        divisors[active] = np.clip(weights[active], 0.1, 3.0)
        distances_raw /= divisors[np.newaxis, :]
    distances_raw[:, effective_counts == 0] = 1e9
    sorted_indices_raw = np.argsort(distances_raw, axis=1)

    importance = compute_importance_map(grid_h, grid_w)

    for _iteration in range(10):
        used = np.bincount(assignment, minlength=n_colors)
        overbudget = np.where(used > effective_counts)[0]

        if len(overbudget) == 0:
            break

        for ci in overbudget:
            pixel_mask = assignment == ci
            pixel_indices = np.where(pixel_mask)[0]

            pixel_dists = distances_raw[pixel_indices, ci]
            dist_norm = pixel_dists / max(pixel_dists.max(), 1e-6)
            imp_vals = importance[pixel_indices]

            reassign_score = (1.0 - imp_vals) * 0.4 + dist_norm * 0.6
            worst_first = pixel_indices[np.argsort(-reassign_score)]

            excess = int(used[ci] - effective_counts[ci])
            to_reassign = worst_first[:excess]

            for px in to_reassign:
                for rank in range(n_colors):
                    alt_ci = sorted_indices_raw[px, rank]
                    if alt_ci == ci:
                        continue
                    if used[alt_ci] < effective_counts[alt_ci]:
                        assignment[px] = alt_ci
                        used[ci] -= 1
                        used[alt_ci] += 1
                        break

    grid = assignment.reshape(grid_h, grid_w).tolist()
    return grid
