import numpy as np
from PIL import Image
import pytest
from backend.algos.realistic import (
    analyze_palette_relevance,
    generate_realistic,
    generate_realistic_dithered
)
from backend.algos.color_math import rgb_to_lab, single_rgb_to_lab

@pytest.fixture
def dummy_image():
    # 2x2 red image
    arr = np.zeros((2, 2, 3), dtype=np.uint8)
    arr[:, :, 0] = 255
    return Image.fromarray(arr)

@pytest.fixture
def dummy_palette_rgb():
    return [
        (255, 0, 0),    # Red
        (0, 255, 0),    # Green
        (0, 0, 255),    # Blue
    ]

@pytest.fixture
def dummy_palette_lab(dummy_palette_rgb):
    return np.array([single_rgb_to_lab(c) for c in dummy_palette_rgb])

def test_analyze_palette_relevance(dummy_image, dummy_palette_rgb):
    # Testing that relevance returns an array of identical shape to palette
    relevance = analyze_palette_relevance(dummy_image, dummy_palette_rgb, 2, 2)
    assert len(relevance) == 3
    # Red should clearly be most relevant
    assert relevance[0] > relevance[1]
    assert relevance[0] > relevance[2]

def test_generate_realistic(dummy_image, dummy_palette_lab):
    pixels = np.array(dummy_image, dtype=np.float64)
    # Give high counts for red
    max_counts = np.array([10, 10, 10])
    relevance = np.array([1.0, 0.5, 0.5])
    
    grid = generate_realistic(
        pixels=pixels,
        palette_lab=dummy_palette_lab,
        max_counts=max_counts,
        grid_w=2,
        grid_h=2,
        relevance=relevance
    )
    
    # Should all be exactly mapped to index 0 (red)
    assert grid == [[0, 0], [0, 0]]

def test_generate_realistic_constraints_kick_in(dummy_image, dummy_palette_lab):
    pixels = np.array(dummy_image, dtype=np.float64)
    # We only have 3 available blocks of Red!
    # But image has 4 pixels. One must be assigned else.
    max_counts = np.array([3, 10, 10])
    relevance = np.array([1.0, 0.5, 0.5])
    
    grid = generate_realistic(
        pixels=pixels,
        palette_lab=dummy_palette_lab,
        max_counts=max_counts,
        grid_w=2,
        grid_h=2,
        relevance=relevance
    )
    
    flat = [item for row in grid for item in row]
    assert flat.count(0) == 3
    # One cell must be something else (1 or 2)
    assert flat.count(1) + flat.count(2) == 1

def test_generate_realistic_dithered(dummy_image, dummy_palette_rgb, dummy_palette_lab):
    pixels = np.array(dummy_image, dtype=np.float64)
    max_counts = np.array([10, 10, 10])
    relevance = np.array([1.0, 0.5, 0.5])
    
    grid = generate_realistic_dithered(
        pixels=pixels,
        palette_rgb=dummy_palette_rgb,
        palette_lab=dummy_palette_lab,
        max_counts=max_counts,
        grid_w=2,
        grid_h=2,
        relevance=relevance
    )
    
    # Dithered mapping of pure red to pure red should remain pure red
    assert grid == [[0, 0], [0, 0]]
