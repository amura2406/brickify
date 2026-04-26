import numpy as np
from backend.algos.color_math import (
    rgb_to_lab,
    single_rgb_to_lab,
    lab_to_rgb,
    ciede2000,
    compute_importance_map,
)


def test_rgb_to_lab_and_back():
    """Verify that converting from RGB to Lab and back recovers the original RGB values (approx)."""
    original_rgb = np.array(
        [
            [[0, 0, 0], [255, 255, 255], [255, 0, 0]],
            [[0, 255, 0], [0, 0, 255], [128, 128, 128]],
        ],
        dtype=np.uint8,
    )

    lab = rgb_to_lab(original_rgb)
    recovered_rgb = lab_to_rgb(lab)

    # Check max deviation is at most 1 due to rounding/float precision
    diff = np.abs(original_rgb.astype(int) - recovered_rgb.astype(int))
    assert np.max(diff) <= 1


def test_single_rgb_to_lab():
    """Verify a single RGB tuple converts correctly compared to the vectorized function."""
    red = (255, 0, 0)
    lab_single = single_rgb_to_lab(red)

    arr = np.array([[[255, 0, 0]]], dtype=np.uint8)
    lab_vectorized = rgb_to_lab(arr)[0, 0]

    np.testing.assert_allclose(lab_single, lab_vectorized)


def test_ciede2000_identical_colors():
    """CIEDE2000 distance between identical colors should be 0."""
    lab = single_rgb_to_lab((100, 150, 200))
    dist = ciede2000(lab, lab)
    assert np.isclose(dist, 0.0)


def test_ciede2000_different_colors():
    """CIEDE2000 distance between different colors should be greater than 0."""
    lab_red = single_rgb_to_lab((255, 0, 0))
    lab_blue = single_rgb_to_lab((0, 0, 255))

    dist = ciede2000(lab_red, lab_blue)
    assert dist > 10.0


def test_compute_importance_map():
    """Verify the importance map has correct shape and properties."""
    grid_h = 10
    grid_w = 10

    importance = compute_importance_map(grid_h, grid_w)
    assert importance.shape == (grid_h * grid_w,)

    # Center pixel should have high importance
    # The grid is even, so centers are around index 4,4 and 5,5
    # Just check max and min are within expected bounds [0, 1]
    assert np.max(importance) <= 1.0
    assert np.min(importance) >= 0.0
