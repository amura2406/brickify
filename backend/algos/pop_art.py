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
) -> list:
    """Pop-Art (Luminance & Ratio-Based) Mapping."""
    
    total_pixels = grid_w * grid_h
    total_pieces = np.sum(max_counts)

    # 1. Proportional Allocation (Hamilton Method)
    # Give pieces proportionally to their availability in the set
    ratios = max_counts / total_pieces
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
    
    # We want to match dark pixels with dark colors.
    # Argsort gives the indices that would sort the array, meaning
    # pixel_sort_idx[0] is the index of the darkest pixel.
    pixel_sort_idx = np.argsort(L_image.ravel())

    # 5. Place the assigned colors back into the correct spatial locations
    final_flat = np.zeros(total_pixels, dtype=int)
    final_flat[pixel_sort_idx] = assigned_colors

    # 6. Reshape back to image grid
    grid = final_flat.reshape((grid_h, grid_w)).tolist()

    return grid
