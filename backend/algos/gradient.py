"""
Gradient Mapping style mosaic generation algorithm.

Maps the image's luminance strictly to a user-provided array of colors,
completely ignoring source hue. It assigns the darkest pixels to the darkest
color in the user's gradient, and the lightest pixels to the lightest color.

Crucially, because this uses strict thresholding based on the user's specific
color choices rather than the natural piece-count distribution of the set,
this algorithm is allowed to exceed the available piece counts for a set.
"""

import numpy as np
from PIL import Image
from algos.color_math import rgb_to_lab, single_rgb_to_lab, ciede2000

def hex_to_rgb(hex_code: str) -> tuple:
    hex_code = hex_code.lstrip('#')
    return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))

def generate_gradient_mapping(
    pixels: np.ndarray,
    target_hex_colors: list[str],
    palette_rgb: list[tuple],
    palette_lab: np.ndarray,
    grid_w: int,
    grid_h: int,
) -> list:
    """Gradient Mapping (Ignored Piece Counts)"""
    
    total_pixels = grid_w * grid_h

    # 1. Parse user gradient colors and convert to LAB
    user_colors_rgb = [hex_to_rgb(h) for h in target_hex_colors]
    user_colors_lab = np.array([single_rgb_to_lab(rgb) for rgb in user_colors_rgb])

    # 2. Sort user colors by Luminance (L channel is index 0)
    user_dark_to_light_idx = np.argsort(user_colors_lab[:, 0])
    sorted_user_lab = user_colors_lab[user_dark_to_light_idx]

    # 3. For each user color, find the closest matching color in the LEGO set
    # We use CIEDE2000 to find the best perceptual match.
    mapped_palette_indices = []
    for user_lab in sorted_user_lab:
        user_lab_broadcast = np.broadcast_to(user_lab, palette_lab.shape)
        distances = ciede2000(palette_lab, user_lab_broadcast)
        closest_idx = int(np.argmin(distances))
        mapped_palette_indices.append(closest_idx)

    num_buckets = len(mapped_palette_indices)

    # 4. Sort image pixels by Luminance
    pixels_lab = rgb_to_lab(pixels)
    L_image = pixels_lab[..., 0]
    
    # Argsort gives the indices that would sort the array, meaning
    # pixel_sort_idx[0] is the index of the darkest pixel.
    pixel_sort_idx = np.argsort(L_image.ravel())

    # 5. Divide pixels into equal-sized buckets based on the number of gradient colors
    base_bucket_size = total_pixels // num_buckets
    remainder = total_pixels % num_buckets
    
    bucket_sizes = [base_bucket_size] * num_buckets
    for i in range(remainder):
        bucket_sizes[i] += 1
        
    bucket_boundaries = np.cumsum([0] + bucket_sizes)

    # 6. Assign the mapped piece indices to the respective buckets
    final_flat = np.zeros(total_pixels, dtype=int)
    for i in range(num_buckets):
        start_idx = bucket_boundaries[i]
        end_idx = bucket_boundaries[i+1]
        
        # Get the pixel indices for this brightness bucket
        bucket_pixels = pixel_sort_idx[start_idx:end_idx]
        
        # Assign the closest matching LEGO color index
        final_flat[bucket_pixels] = mapped_palette_indices[i]

    # 7. Reshape back to image grid
    grid = final_flat.reshape((grid_h, grid_w)).tolist()

    return grid
