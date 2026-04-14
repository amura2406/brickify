import numpy as np
import pytest
from backend.algos.gradient import hex_to_rgb, generate_gradient_mapping
from backend.algos.color_math import single_rgb_to_lab

def test_hex_to_rgb():
    assert hex_to_rgb("#FF0000") == (255, 0, 0)
    assert hex_to_rgb("00FF00") == (0, 255, 0)
    assert hex_to_rgb("#0000FF") == (0, 0, 255)
    assert hex_to_rgb("#FFFFFF") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)

def test_generate_gradient_mapping():
    # A 2x2 image where we have 4 distinct brightnesses
    pixels = np.array([
        [[255, 255, 255], [200, 200, 200]],
        [[100, 100, 100], [0, 0, 0]]
    ], dtype=np.uint8)
    
    # 2 target colors: Black and White
    target_hex_colors = ["#000000", "#FFFFFF"]
    
    # The LEGO set palette just happens to also be pure black and pure white
    palette_rgb = [(0, 0, 0), (255, 255, 255)]
    palette_lab = np.array([single_rgb_to_lab(c) for c in palette_rgb])
    
    grid = generate_gradient_mapping(
        pixels=pixels,
        target_hex_colors=target_hex_colors,
        palette_rgb=palette_rgb,
        palette_lab=palette_lab,
        grid_w=2,
        grid_h=2
    )
    
    # Expectation: 2 buckets because 2 target hex colors.
    # Total 4 pixels. Base bucket size 2.
    # Bottom 50% brightness (darkest 2 pixels: (0,0,0) and (100,100,100)) go to Black (idx 0)
    # Top 50% brightness ((200,200,200) and (255,255,255)) go to White (idx 1)
    
    # Grid shape:
    # (255,255,255), (200,200,200) -> 1, 1
    # (100,100,100), (0,0,0) -> 0, 0
    assert grid == [
        [1, 1],
        [0, 0]
    ]

def test_generate_gradient_mapping_remainder():
    # 3 pixels, 2 colors. Buckets will be 2 and 1.
    pixels = np.array([
        [[255, 255, 255], [100, 100, 100], [0, 0, 0]]
    ], dtype=np.uint8)
    
    target_hex_colors = ["#000000", "#FFFFFF"]
    
    palette_rgb = [(0, 0, 0), (255, 255, 255)]
    palette_lab = np.array([single_rgb_to_lab(c) for c in palette_rgb])
    
    grid = generate_gradient_mapping(
        pixels=pixels,
        target_hex_colors=target_hex_colors,
        palette_rgb=palette_rgb,
        palette_lab=palette_lab,
        grid_w=3,
        grid_h=1
    )
    
    # Darkest should be Black (0). Base size 3 // 2 = 1.
    # Remainder 1. Darkest bucket gets size 2. Lightest bucket gets size 1.
    # Pixels: 255, 100, 0.
    # Sorted: 0, 100, 255.
    # 0 -> 0. 100 -> 0. 255 -> 1.
    # So the image should be: [1, 0, 0]
    assert grid == [[1, 0, 0]]
