import numpy as np
import pytest
from backend.algos.dither_utils import bayer_matrix


def test_bayer_matrix_2x2():
    m = bayer_matrix(2)
    assert m.shape == (2, 2)
    # All values in [0, 1)
    assert np.all(m >= 0.0)
    assert np.all(m < 1.0)
    # Must contain 4 unique values
    assert len(np.unique(m)) == 4


def test_bayer_matrix_4x4():
    m = bayer_matrix(4)
    assert m.shape == (4, 4)
    assert np.all(m >= 0.0)
    assert np.all(m < 1.0)
    assert len(np.unique(m)) == 16


def test_bayer_matrix_8x8():
    m = bayer_matrix(8)
    assert m.shape == (8, 8)
    assert np.all(m >= 0.0)
    assert np.all(m < 1.0)
    assert len(np.unique(m)) == 64


def test_bayer_matrix_invalid_size():
    with pytest.raises(ValueError):
        bayer_matrix(3)
    with pytest.raises(ValueError):
        bayer_matrix(1)
    with pytest.raises(ValueError):
        bayer_matrix(0)


def test_bayer_matrix_mean_is_half():
    """The mean of a normalized Bayer matrix should be close to 0.5."""
    m = bayer_matrix(8)
    # Mean of [0, 1, 2, ..., 63] / 64 = 31.5 / 64 ≈ 0.4921875
    expected_mean = (8 * 8 - 1) / (2.0 * 8 * 8)
    assert np.isclose(np.mean(m), expected_mean)
