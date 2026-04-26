"""
Mosaic generation algorithms.
"""

from .realistic import generate_realistic, analyze_palette_relevance
from .pop_art import generate_pop_art_ratio
from .ordered_dither import generate_ordered_dither
from .edge_aware import generate_edge_aware
from .clustered import generate_clustered
from .color_math import (
    preprocess_image,
    rgb_to_lab,
    lab_to_rgb,
    single_rgb_to_lab,
    ciede2000,
)

__all__ = [
    "generate_realistic",
    "analyze_palette_relevance",
    "generate_pop_art_ratio",
    "generate_ordered_dither",
    "generate_edge_aware",
    "generate_clustered",
    "preprocess_image",
    "rgb_to_lab",
    "lab_to_rgb",
    "single_rgb_to_lab",
    "ciede2000",
]
