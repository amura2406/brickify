import numpy as np
from backend.algos.pop_art import generate_pop_art_ratio


def test_generate_pop_art_ratio_allocation():
    np.random.seed(42)  # For deterministic test output

    # 2x2 image, 4 pixels
    pixels = np.array(
        [[[255, 255, 255], [0, 0, 0]], [[100, 100, 100], [200, 200, 200]]],
        dtype=np.uint8,
    )

    # 2 colors in palette: Color 0 (dark), Color 1 (light)
    # Index 0: L=0, Index 1: L=100
    palette_lab = np.array([[0.0, 0.0, 0.0], [100.0, 0.0, 0.0]])

    # Total pieces in set limit: 100
    # Color 0: 25 pieces
    # Color 1: 75 pieces
    # Proportions: 25%, 75%
    # With 4 total pixels: allocation should be 1 for Color 0, 3 for Color 1
    max_counts = np.array([25, 75])

    grid = generate_pop_art_ratio(
        pixels=pixels,
        palette_lab=palette_lab,
        max_counts=max_counts,
        grid_w=2,
        grid_h=2,
    )

    flat = [item for row in grid for item in row]
    assert flat.count(0) == 1
    assert flat.count(1) == 3
