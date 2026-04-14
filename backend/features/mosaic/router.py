import io
import urllib.request
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, Response
from auth import require_approved_user
from storage import StorageProvider, get_storage_provider
from lego_sets import LEGO_SETS, merge_sets
from mosaic import generate_mosaic, generate_palette_preview
from pdf_export import generate_instructions_pdf

from features.mosaic.models import (
    SetSelection,
    GenerateRequest,
    GeneratePdfRequest,
    PalettePreviewRequest
)

router = APIRouter(prefix="/api", tags=["mosaic"])

def _download_from_url(url: str) -> Image.Image:
    """Downloads image from URL and returns PIL Image."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        return Image.open(io.BytesIO(resp.read())).convert("RGB")

def _resolve_set_data(set_id: str | None, set_selections: list[SetSelection] | None) -> dict:
    if set_selections and len(set_selections) > 0:
        merged = merge_sets([{"set_id": s.set_id, "qty": s.qty} for s in set_selections])
        if not merged:
            raise HTTPException(400, "Invalid set selections")
        return merged
    elif set_id:
        set_data = LEGO_SETS.get(set_id)
        if not set_data:
            raise HTTPException(404, f"Set {set_id} not found")
        return set_data
    else:
        raise HTTPException(400, "Provide set_id or set_selections")

@router.post("/generate")
def generate(
    req: GenerateRequest,
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Generate a LEGO mosaic and render a preview to storage."""
    try:
        img = _download_from_url(req.url)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Failed fetching URL %s", req.url, exc_info=True)
        raise HTTPException(400, "Cannot fetch cropped image URL") from e

    set_data = _resolve_set_data(req.set_id, req.set_selections)

    mosaic_data = generate_mosaic(
        img, set_data,
        dithering=req.dithering,
        preprocessing=req.preprocessing,
        contrast_boost=max(0.0, min(2.0, req.contrast_boost)),
        saturation=max(-100.0, min(100.0, req.saturation)),
        temperature=max(-50.0, min(50.0, req.temperature)),
        sharpen=max(0.0, min(5.0, req.sharpen)),
        posterize_levels=max(2, min(32, req.posterize_levels)),
        gamma=max(0.2, min(3.0, req.gamma)),
        black_point=max(0, min(100, req.black_point)),
        white_point=max(155, min(255, req.white_point)),
        color_mode=req.color_mode,
        gradient_colors=req.gradient_colors,
        target_width=req.target_width,
        target_height=req.target_height,
    )

    return {
        "preview_url": "",
        "width": mosaic_data["width"],
        "height": mosaic_data["height"],
        "colors": mosaic_data["colors"],
        "grid": mosaic_data["grid"],
    }

@router.post("/generate-pdf")
def generate_pdf(
    req: GeneratePdfRequest,
    user: dict = Depends(require_approved_user)
):
    """Generate a printable PDF build guide for a mosaic."""
    pdf_bytes = generate_instructions_pdf(req.grid, req.colors, req.width, req.height)
    return Response(content=pdf_bytes, media_type="application/pdf")

@router.post("/preview-palette")
def preview_palette(
    req: PalettePreviewRequest,
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Uploads palette preview to Firebase Storage and returns URL."""
    try:
        img = _download_from_url(req.url)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Failed fetching URL %s", req.url, exc_info=True)
        raise HTTPException(400, "Cannot fetch image URL") from e

    set_data = _resolve_set_data(req.set_id, req.set_selections)

    grid_w = req.target_width if req.target_width else set_data["grid"][0]
    grid_h = req.target_height if req.target_height else set_data["grid"][1]

    palette_rgb = [c["rgb"] for c in set_data["colors"]]

    preview = generate_palette_preview(
        img, palette_rgb, grid_w, grid_h,
        preprocessing=req.preprocessing,
        contrast_boost=max(0.0, min(2.0, req.contrast_boost)),
        saturation=max(-100.0, min(100.0, req.saturation)),
        temperature=max(-50.0, min(50.0, req.temperature)),
        sharpen=max(0.0, min(5.0, req.sharpen)),
        posterize_levels=max(2, min(32, req.posterize_levels)),
        gamma=max(0.2, min(3.0, req.gamma)),
        black_point=max(0, min(100, req.black_point)),
        white_point=max(155, min(255, req.white_point)),
    )

    url = provider.upload_image(preview, "previews", fmt="PNG")
    return {"url": url}
