import numpy as np
import pytest
from backend.algos.clustered import generate_clustered, _kmeans_5d
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


def test_kmeans_5d_basic():
    """K-means should assign 2 well-separated groups to 2 clusters."""
    features = np.array(
        [
            [0, 0, 10, 0, 0],
            [0, 0, 12, 0, 0],
            [0, 0, 90, 0, 0],
            [0, 0, 92, 0, 0],
        ],
        dtype=np.float64,
    )

    labels = _kmeans_5d(features, k=2, seed=42)
    # The two groups should have different labels
    assert labels[0] == labels[1]
    assert labels[2] == labels[3]
    assert labels[0] != labels[2]


def test_clustered_uniform_red(rgb_palette_lab):
    """A uniform red image should map entirely to red."""
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:, :, 0] = 255.0
    max_counts = np.array([20, 20, 20])

    grid = generate_clustered(
        pixels=pixels,
        palette_lab=rgb_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) == 16  # All red


def test_clustered_two_regions(rgb_palette_lab):
    """An image with two distinct color blocks should produce at least 2 colors."""
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:2, :, 0] = 255.0  # Top half: red
    pixels[2:, :, 2] = 255.0  # Bottom half: blue
    max_counts = np.array([20, 20, 20])

    grid = generate_clustered(
        pixels=pixels,
        palette_lab=rgb_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
    )

    flat = [item for row in grid for item in row]
    unique = set(flat)
    assert len(unique) >= 2  # At least 2 distinct colors used


def test_clustered_respects_constraints(rgb_palette_lab):
    """Piece count constraints must be enforced."""
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:, :, 0] = 255.0  # All red
    # Only 8 red pieces allowed
    max_counts = np.array([8, 16, 16])

    grid = generate_clustered(
        pixels=pixels,
        palette_lab=rgb_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) <= 8


def test_clustered_weights_exclude_color(rgb_palette_lab):
    """Excluding a color via weights should prevent its use."""
    pixels = np.zeros((4, 4, 3), dtype=np.float64)
    pixels[:, :, 0] = 255.0  # Pure red
    max_counts = np.array([16, 16, 16])
    weights = np.array([0.0, 1.0, 1.0])  # Exclude red

    grid = generate_clustered(
        pixels=pixels,
        palette_lab=rgb_palette_lab,
        max_counts=max_counts,
        grid_w=4,
        grid_h=4,
        weights=weights,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) == 0  # No red used
