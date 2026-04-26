import numpy as np
import pytest
from backend.algos.edge_aware import generate_edge_aware, _sobel_edge_map
from backend.algos.color_math import single_rgb_to_lab


@pytest.fixture
def rgb_palette_lab():
    return np.array(
        [
            single_rgb_to_lab((255, 0, 0)),  # Red (0)
            single_rgb_to_lab((0, 255, 0)),  # Green (1)
            single_rgb_to_lab((0, 0, 255)),  # Blue (2)
        ]
    )


def test_sobel_edge_map_detects_edges():
    """A sharp boundary should produce high edge values."""
    # Left half white, right half black → strong vertical edge in center
    pixels = np.zeros((10, 10, 3), dtype=np.float64)
    pixels[:, :5, :] = 255.0  # Left half white

    edge = _sobel_edge_map(pixels)
    assert edge.shape == (10, 10)

    # Center column (x=5) should have high edge values
    center_edge = edge[2:-2, 5].mean()
    # Corner/flat areas should have low edge values
    flat_edge = edge[2:-2, 2].mean()
    assert center_edge > flat_edge


def test_sobel_edge_map_uniform_no_edges():
    """A uniform image should have zero edges."""
    pixels = np.full((8, 8, 3), 128.0, dtype=np.float64)
    edge = _sobel_edge_map(pixels)
    assert np.allclose(edge, 0.0)


def test_edge_aware_pure_red_image(rgb_palette_lab):
    """A uniform red image should map entirely to red."""
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:, :, 0] = 255.0
    max_counts = np.array([20, 20, 20])
    relevance = np.array([1.0, 0.3, 0.3])

    grid = generate_edge_aware(
        pixels=pixels,
        palette_lab=rgb_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
        relevance=relevance,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) == 16  # All red


def test_edge_aware_respects_constraints(rgb_palette_lab):
    """Piece count constraints must be enforced."""
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:, :, 0] = 255.0  # All red
    # Only 10 red pieces allowed out of 16 needed
    max_counts = np.array([10, 16, 16])
    relevance = np.array([1.0, 0.5, 0.5])

    grid = generate_edge_aware(
        pixels=pixels,
        palette_lab=rgb_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
        relevance=relevance,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) <= 10


def test_edge_aware_coherence_smooths_flat_regions():
    """Flat regions should have more spatial coherence than random assignment."""
    # Create a mostly-red image with one pixel slightly different
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:, :, 0] = 255.0
    # Make center pixel slightly pink (still closest to red)
    pixels[2, 2] = [240.0, 10.0, 10.0]

    palette_lab = np.array(
        [
            single_rgb_to_lab((255, 0, 0)),  # Red
            single_rgb_to_lab((240, 10, 10)),  # Slightly pinkish red
            single_rgb_to_lab((0, 0, 255)),  # Blue
        ]
    )
    max_counts = np.array([20, 20, 20])
    relevance = np.array([1.0, 0.8, 0.1])

    grid = generate_edge_aware(
        pixels=pixels,
        palette_lab=palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
        relevance=relevance,
    )

    # Most cells should be the same color (coherence kicks in)
    flat = [item for row in grid for item in row]
    most_common = max(set(flat), key=flat.count)
    assert flat.count(most_common) >= 14  # At least 14/16 should be uniform
