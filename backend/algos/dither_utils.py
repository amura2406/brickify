"""
Dithering utility functions shared across algorithms.

Provides Bayer matrix generation for ordered dithering patterns.
"""

import numpy as np


def bayer_matrix(n: int) -> np.ndarray:
    """Generate an n×n Bayer ordered-dither threshold matrix.

    The matrix values are normalized to the [0, 1) range.
    Supported sizes: any power of 2 (2, 4, 8, 16, …).

    Args:
        n: Matrix size — must be a power of 2 and ≥ 2.

    Returns:
        ndarray of shape (n, n) with float64 values in [0, 1).

    Raises:
        ValueError: If *n* is not a power of 2 or is less than 2.
    """
    if n < 2 or (n & (n - 1)) != 0:
        raise ValueError(f"n must be a power of 2 and >= 2, got {n}")

    # Start with the canonical 2×2 Bayer kernel
    matrix = np.array([[0, 2], [3, 1]], dtype=np.float64)

    # Recursively expand to the requested size
    size = 2
    while size < n:
        quarter = matrix
        expanded = np.zeros((size * 2, size * 2), dtype=np.float64)
        expanded[:size, :size] = 4 * quarter  # top-left
        expanded[:size, size:] = 4 * quarter + 2  # top-right
        expanded[size:, :size] = 4 * quarter + 3  # bottom-left
        expanded[size:, size:] = 4 * quarter + 1  # bottom-right
        matrix = expanded
        size *= 2

    # Normalize to [0, 1)
    return matrix / (n * n)
