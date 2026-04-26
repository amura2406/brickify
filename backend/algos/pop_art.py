"""
Pop-Art style mosaic generation algorithm.

Ignores original color hues completely. Instead, it sorts the image by 
luminance (brightness) and maps pixels to the LEGO palette (sorted by 
brightness), respecting the exact piece counts and ratios available in 
the selected LEGO set. This automatically handles highly stylized, 
Andy Warhol-esque portraits with unnatural colors.
"""

import numpy as np
from PIL import Image
from algos.color_math import rgb_to_lab

def generate_pop_art_ratio(
    pixels: np.ndarray,
    palette_lab: np.ndarray,
    max_counts: np.ndarray,
    grid_w: int,
    grid_h: int,
    weights: np.ndarray | None = None,
) -> list:
    """Pop-Art (Luminance & Ratio-Based) Mapping.

    Args:
        weights: Optional per-color weight multipliers (0.0=excluded, 0.1–3.0).
                 When provided, adjusts the ratio each color occupies.
    """
    
    total_pixels = grid_w * grid_h

    # Apply user-defined weights to shift color ratios
    effective_counts = max_counts.copy().astype(np.float64)
    if weights is not None:
        effective_counts *= weights

    total_weighted = np.sum(effective_counts)
    if total_weighted <= 0:
        # All colors excluded — fallback to uniform
        effective_counts = np.ones_like(max_counts, dtype=np.float64)
        total_weighted = float(len(effective_counts))

    # 1. Proportional Allocation (Hamilton Method)
    # Give pieces proportionally to their weighted availability
    ratios = effective_counts / total_weighted
    target_counts = ratios * total_pixels
    alloc = np.floor(target_counts).astype(int)
    remainder = total_pixels - np.sum(alloc)
    fractional = target_counts - alloc

    if remainder > 0:
        top_fractions = np.argsort(-fractional)[:remainder]
        alloc[top_fractions] += 1

    # 2. Sort LEGO colors by Luminance (L from Lab)
    # palette_lab shape: (N, 3), 0th index is L
    L_vals = palette_lab[:, 0]
    color_dark_to_light = np.argsort(L_vals)

    # 3. Create a flattened sequence of pieces to use, sorted dark to light
    assigned_colors = []
    for ci in color_dark_to_light:
        assigned_colors.extend([ci] * alloc[ci])
    assigned_colors = np.array(assigned_colors)

    # 4. Sort image pixels by Luminance
    pixels_lab = rgb_to_lab(pixels)
    L_image = pixels_lab[..., 0]
    
    # --- Add Random Noise Dithering ---
    # Use uniform random noise to break ties naturally without checkerboard patterns
    # The noise spans [-0.5, 0.5].
    noise_mask = np.random.uniform(-0.5, 0.5, size=(grid_h, grid_w))
    
    # Add scaled noise to the luminance channel.
    # L ranges from 0 to ~100. A strength of 24.0 provides nice, broad mixing.
    noise_strength = 24.0
    L_perturbed = L_image + noise_mask * noise_strength
    
    # We want to match dark pixels with dark colors.
    # Argsort gives the indices that would sort the array, meaning
    # pixel_sort_idx[0] is the index of the darkest pixel.
    pixel_sort_idx = np.argsort(L_perturbed.ravel())

    # 5. Place the assigned colors back into the correct spatial locations
    final_flat = np.zeros(total_pixels, dtype=int)
    final_flat[pixel_sort_idx] = assigned_colors

    # 6. Reshape back to image grid
    grid = final_flat.reshape((grid_h, grid_w)).tolist()

    return grid
