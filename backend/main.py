"""
LEGO Mosaic Maker — FastAPI Backend

Serves the frontend and provides API endpoints for
image upload, cropping, and mosaic generation.
"""

import io
import uuid
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from lego_sets import LEGO_SETS, get_set_info, get_set_detail, merge_sets
from mosaic import generate_mosaic, render_mosaic_image, generate_palette_preview

app = FastAPI(title="LEGO Mosaic Maker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for uploaded images and generated mosaics
_images: dict[str, Image.Image] = {}
_mosaics: dict[str, dict] = {}

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


# ── API Endpoints ──────────────────────────────────────────────


@app.get("/api/sets")
def list_sets():
    """List all available LEGO Art sets."""
    sets = []
    for set_id in LEGO_SETS:
        info = get_set_info(set_id)
        if info:
            sets.append(info)
    return {"sets": sets}


@app.get("/api/sets/{set_id}")
def get_set(set_id: str):
    """Get detailed info for a LEGO Art set."""
    detail = get_set_detail(set_id)
    if not detail:
        raise HTTPException(404, f"Set {set_id} not found")
    return detail


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and return its ID and dimensions."""
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image file")

    image_id = str(uuid.uuid4())
    _images[image_id] = img

    w, h = img.size
    is_square = w == h

    return {
        "image_id": image_id,
        "width": w,
        "height": h,
        "is_square": is_square,
    }


class UploadPathRequest(BaseModel):
    file_path: str


@app.post("/api/upload-path")
def upload_from_path(req: UploadPathRequest):
    """DEV ONLY: Upload an image from a local file path (bypasses file picker)."""
    file_path = Path(req.file_path)
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {req.file_path}")
    if not file_path.is_file():
        raise HTTPException(400, f"Not a file: {req.file_path}")

    try:
        img = Image.open(str(file_path)).convert("RGB")
    except Exception:
        raise HTTPException(400, f"Cannot open image: {req.file_path}")

    image_id = str(uuid.uuid4())
    _images[image_id] = img

    w, h = img.size
    is_square = w == h

    return {
        "image_id": image_id,
        "width": w,
        "height": h,
        "is_square": is_square,
    }


@app.get("/api/image/{image_id}")
def get_image(image_id: str):
    """Return uploaded image as JPEG."""
    img = _images.get(image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/jpeg")


class CropRequest(BaseModel):
    image_id: str
    x: float
    y: float
    size: float


@app.post("/api/crop")
def crop_image(req: CropRequest):
    """Crop image to a square region and return new image ID."""
    img = _images.get(req.image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    w, h = img.size
    x = max(0, int(req.x))
    y = max(0, int(req.y))
    size = int(req.size)

    # Clamp to image bounds (handles rounding from frontend scale)
    if x + size > w:
        x = w - size
    if y + size > h:
        y = h - size
    x = max(0, x)
    y = max(0, y)
    size = min(size, w - x, h - y)

    if size <= 0:
        raise HTTPException(400, "Crop region too small")

    cropped = img.crop((x, y, x + size, y + size))
    new_id = str(uuid.uuid4())
    _images[new_id] = cropped

    return {
        "image_id": new_id,
        "width": size,
        "height": size,
        "is_square": True,
    }


class SetSelection(BaseModel):
    set_id: str
    qty: int = 1


class GenerateRequest(BaseModel):
    image_id: str
    set_id: str | None = None
    set_selections: list[SetSelection] | None = None
    dithering: bool = False
    preprocessing: bool = True
    contrast_boost: float = 1.0


def _resolve_set_data(set_id: str | None, set_selections: list[SetSelection] | None) -> dict:
    """Resolve set data from either single set_id or multi-set selections."""
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


@app.post("/api/generate")
def generate(req: GenerateRequest):
    """Generate a LEGO mosaic from an uploaded image."""
    img = _images.get(req.image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    set_data = _resolve_set_data(req.set_id, req.set_selections)

    mosaic_data = generate_mosaic(
        img, set_data,
        dithering=req.dithering,
        preprocessing=req.preprocessing,
        contrast_boost=max(0.0, min(2.0, req.contrast_boost)),
    )
    mosaic_id = str(uuid.uuid4())
    _mosaics[mosaic_id] = mosaic_data

    return {
        "mosaic_id": mosaic_id,
        "width": mosaic_data["width"],
        "height": mosaic_data["height"],
        "colors": mosaic_data["colors"],
        "grid": mosaic_data["grid"],
    }


class PalettePreviewRequest(BaseModel):
    image_id: str
    set_id: str | None = None
    set_selections: list[SetSelection] | None = None
    preprocessing: bool = True
    contrast_boost: float = 1.0


@app.post("/api/preview-palette")
def preview_palette(req: PalettePreviewRequest):
    """Generate a palette-mapped preview (no piece constraints)."""
    img = _images.get(req.image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    set_data = _resolve_set_data(req.set_id, req.set_selections)

    grid_w, grid_h = set_data["grid"]
    palette_rgb = [c["rgb"] for c in set_data["colors"]]

    preview = generate_palette_preview(
        img, palette_rgb, grid_w, grid_h,
        preprocessing=req.preprocessing,
        contrast_boost=max(0.0, min(2.0, req.contrast_boost)),
    )

    buf = io.BytesIO()
    preview.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@app.get("/api/mosaic/{mosaic_id}/preview")
def mosaic_preview(mosaic_id: str, stud_size: int = 15):
    """Render mosaic as a PNG image with circular studs."""
    mosaic_data = _mosaics.get(mosaic_id)
    if not mosaic_data:
        raise HTTPException(404, "Mosaic not found")

    img = render_mosaic_image(mosaic_data, stud_size=stud_size)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


# ── Serve Frontend ─────────────────────────────────────────────

# Mount static files LAST so API routes take priority
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
