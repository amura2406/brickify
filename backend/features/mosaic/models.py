from pydantic import BaseModel
from typing import Optional, List, Dict


class SetSelection(BaseModel):
    set_id: str
    qty: int = 1


class GenerateRequest(BaseModel):
    url: str
    set_id: Optional[str] = None
    set_selections: Optional[List[SetSelection]] = None

    preprocessing: bool = True
    contrast_boost: float = 1.0
    saturation: float = 0.0
    temperature: float = 0.0
    sharpen: float = 0.0
    posterize_levels: int = 32
    gamma: float = 1.0
    black_point: int = 0
    white_point: int = 255
    color_mode: str = "realistic"
    gradient_colors: Optional[List[str]] = None
    color_weights: Optional[Dict[str, float]] = None
    target_width: Optional[int] = None
    target_height: Optional[int] = None


class GeneratePdfRequest(BaseModel):
    grid: List[List[int]]
    colors: List[dict]
    width: int
    height: int


class PalettePreviewRequest(BaseModel):
    url: str
    set_id: Optional[str] = None
    set_selections: Optional[List[SetSelection]] = None
    preprocessing: bool = True
    contrast_boost: float = 1.0
    saturation: float = 0.0
    temperature: float = 0.0
    sharpen: float = 0.0
    posterize_levels: int = 32
    gamma: float = 1.0
    black_point: int = 0
    white_point: int = 255
    color_mode: str = "realistic"
    gradient_colors: Optional[List[str]] = None
    target_width: Optional[int] = None
    target_height: Optional[int] = None


class CropRequest(BaseModel):
    url: str
    x: float
    y: float
    w: float
    h: float
    rotation_degrees: int = 0  # 0, 90, 180, 270
