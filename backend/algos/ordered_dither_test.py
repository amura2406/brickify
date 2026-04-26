import numpy as np
import pytest
from backend.algos.ordered_dither import generate_ordered_dither
from backend.algos.color_math import single_rgb_to_lab


@pytest.fixture
def bw_palette_lab():
    """Black and White palette in Lab space."""
    return np.array(
        [
            single_rgb_to_lab((0, 0, 0)),
            single_rgb_to_lab((255, 255, 255)),
        ]
    )


def test_ordered_dither_produces_dither_pattern(bw_palette_lab):
    """A mid-gray image should produce a mix of black and white (not all one color)."""
    # 8x8 uniform mid-gray image
    pixels = np.full((8, 8, 3), 128, dtype=np.uint8)
    max_counts = np.array([64, 64])  # plenty of both

    grid = generate_ordered_dither(
        pixels=pixels,
        palette_lab=bw_palette_lab,
        max_counts=max_counts,
        grid_w=8,
        grid_h=8,
    )

    flat = [item for row in grid for item in row]
    # Should have a mix of 0s and 1s (not 100% one color)
    assert flat.count(0) > 0
    assert flat.count(1) > 0


def test_ordered_dither_respects_constraints(bw_palette_lab):
    """Even with dithering, piece count limits must be respected."""
    # 4x4 mid-gray image = 16 pixels
    pixels = np.full((4, 4, 3), 128, dtype=np.uint8)
    # Only allow 4 black pieces — rest must be white
    max_counts = np.array([4, 16])

    grid = generate_ordered_dither(
        pixels=pixels,
        palette_lab=bw_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) <= 4


def test_ordered_dither_pure_color_stays_pure():
    """A pure red image should map entirely to the red palette entry."""
    palette_lab = np.array(
        [
            single_rgb_to_lab((255, 0, 0)),  # Red
            single_rgb_to_lab((0, 0, 255)),  # Blue
            single_rgb_to_lab((0, 255, 0)),  # Green
        ]
    )
    pixels = np.zeros((4, 4, 3), dtype=np.uint8)
    pixels[:, :, 0] = 255  # Pure red
    max_counts = np.array([20, 20, 20])

    grid = generate_ordered_dither(
        pixels=pixels,
        palette_lab=palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
    )

    flat = [item for row in grid for item in row]
    # All pixels should map to red (index 0)
    assert flat.count(0) == 16


def test_ordered_dither_weights_exclude_color(bw_palette_lab):
    """Excluding a color via weights should prevent its use."""
    pixels = np.full((4, 4, 3), 0, dtype=np.uint8)  # Pure black
    max_counts = np.array([16, 16])
    weights = np.array([0.0, 1.0])  # Exclude black

    grid = generate_ordered_dither(
        pixels=pixels,
        palette_lab=bw_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
        weights=weights,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) == 0  # No black used
