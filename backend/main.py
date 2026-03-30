"""
LEGO Mosaic Maker — FastAPI Backend

Serves the frontend and provides API endpoints for
image upload, cropping, and mosaic generation.

Auth: Firebase ID tokens (JWT) are required on all /api/* endpoints.
Admin approval: users must have the `approved` custom claim set to true
by an admin via POST /api/admin/approve-user.
"""

import io
import logging
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Load secret environment variables from .env
load_dotenv(Path(__file__).parent.parent / '.env')


from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import httpx
import urllib.parse
import urllib.request
from storage import StorageProvider, get_storage_provider

from lego_sets import LEGO_SETS, get_set_info, get_set_detail, merge_sets
from mosaic import generate_mosaic, render_mosaic_image, generate_palette_preview
from auth import require_approved_user, require_admin, get_current_user

# ── Environment ────────────────────────────────────────────────
IS_PRODUCTION = os.environ.get("ENV", "development") == "production"

_ALLOWED_ORIGINS = (
    os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if IS_PRODUCTION
    else ["*"]
)

app = FastAPI(title="LEGO Mosaic Maker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Mount directory
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"




def _download_from_url(url: str) -> Image.Image:
    """Downloads image from URL and returns PIL Image."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        return Image.open(io.BytesIO(resp.read())).convert("RGB")

# ── API Endpoints ──────────────────────────────────────────────

@app.get("/api/firebase-config")
def get_firebase_config():
    """Return the Firebase frontend configuration loaded from environment variables."""
    return {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": f"{os.getenv('FIREBASE_PROJECT_ID')}.firebaseapp.com",
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": f"{os.getenv('FIREBASE_PROJECT_ID')}.appspot.com",
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }


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
async def upload_image(
    file: UploadFile = File(...),
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Upload an image directly to storage (approved users)."""
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image file")

    url = provider.upload_image(img, "uploads", fmt="JPEG")
    w, h = img.size

    return {
        "url": url,
        "width": w,
        "height": h,
        "is_square": w == h,
    }



class UploadPathRequest(BaseModel):
    file_path: str


@app.post("/api/upload-path")
def upload_from_path(
    req: UploadPathRequest,
    provider: StorageProvider = Depends(get_storage_provider)
):
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

    url = provider.upload_image(img, "uploads", fmt="JPEG")
    w, h = img.size

    return {
        "url": url,
        "width": w,
        "height": h,
        "is_square": w == h,
    }


class CropRequest(BaseModel):
    url: str
    x: float
    y: float
    w: float
    h: float
    rotation_degrees: int = 0  # 0, 90, 180, 270


@app.post("/api/crop")
def crop_image(
    req: CropRequest,
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Download image, optionally rotate, crop, and upload result."""
    try:
        img = _download_from_url(req.url)
    except Exception:
        raise HTTPException(400, "Cannot fetch image from URL")

    # Apply rotation before crop (uses PIL expand=True to avoid clipping)
    if req.rotation_degrees and req.rotation_degrees % 360 != 0:
        # PIL rotates counter-clockwise; negate for clockwise convention
        angle = -(req.rotation_degrees % 360)
        img = img.rotate(angle, expand=True)

    cw, ch = img.size
    x = max(0, int(req.x))
    y = max(0, int(req.y))
    target_w = int(req.w)
    target_h = int(req.h)

    # Clamp to image bounds
    if x + target_w > cw:
        x = cw - target_w
    if y + target_h > ch:
        y = ch - target_h
    x = max(0, x)
    y = max(0, y)
    
    target_w = min(target_w, cw - x)
    target_h = min(target_h, ch - y)

    if target_w <= 0 or target_h <= 0:
        raise HTTPException(400, "Crop region too small")

    cropped = img.crop((x, y, x + target_w, y + target_h))
    new_url = provider.upload_image(cropped, "crops", fmt="JPEG")

    return {
        "url": new_url,
        "width": target_w,
        "height": target_h,
        "is_square": target_w == target_h,
    }


class SetSelection(BaseModel):
    set_id: str
    qty: int = 1


class GenerateRequest(BaseModel):
    url: str
    set_id: str | None = None
    set_selections: list[SetSelection] | None = None
    dithering: bool = False
    preprocessing: bool = True
    contrast_boost: float = 1.0
    color_mode: str = "realistic"
    gradient_colors: list[str] | None = None
    target_width: int | None = None
    target_height: int | None = None


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
def generate(
    req: GenerateRequest,
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Generate a LEGO mosaic and render a preview to storage."""
    try:
        img = _download_from_url(req.url)
    except Exception:
        raise HTTPException(400, "Cannot fetch cropped image URL")

    set_data = _resolve_set_data(req.set_id, req.set_selections)

    mosaic_data = generate_mosaic(
        img, set_data,
        dithering=req.dithering,
        preprocessing=req.preprocessing,
        contrast_boost=max(0.0, min(2.0, req.contrast_boost)),
        color_mode=req.color_mode,
        gradient_colors=req.gradient_colors,
        target_width=req.target_width,
        target_height=req.target_height,
    )
    
    preview_img = render_mosaic_image(mosaic_data, stud_size=15)
    preview_url = provider.upload_image(preview_img, "mosaics", fmt="PNG")

    return {
        "preview_url": preview_url,
        "width": mosaic_data["width"],
        "height": mosaic_data["height"],
        "colors": mosaic_data["colors"],
        "grid": mosaic_data["grid"],
    }


# ── Google Photos Picker API proxy ─────────────────────────────

logger = logging.getLogger(__name__)

GPHOTOS_PICKER_BASE = "https://photospicker.googleapis.com/v1"


class GooglePhotosUploadRequest(BaseModel):
    access_token: str
    base_url: str


class CreateSessionRequest(BaseModel):
    access_token: str


@app.post("/api/google-photos/create-session")
def gphotos_create_session(
    req: CreateSessionRequest,
    _user: dict = Depends(require_approved_user),
):
    """Create a Google Photos Picker session.

    The frontend provides the user's Google OAuth access token (obtained via
    incremental scope authorization). We proxy the call to the Picker API.
    """
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{GPHOTOS_PICKER_BASE}/sessions",
                headers={"Authorization": f"Bearer {req.access_token}"},
                json={},
            )
        if resp.status_code == 400 and "FAILED_PRECONDITION" in resp.text:
            raise HTTPException(
                412,
                "This Google account does not have an active Google Photos library. "
                "Please make sure Google Photos is set up for your account.",
            )
        if resp.status_code != 200:
            logger.warning("Picker session create failed: %s %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
        data = resp.json()
        return {
            "id": data["id"],
            "pickerUri": data["pickerUri"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to create Google Photos session")
        raise HTTPException(502, f"Google Photos API error: {exc}") from exc


@app.get("/api/google-photos/session/{session_id}")
def gphotos_get_session(
    session_id: str,
    google_access_token: str,
    _user: dict = Depends(require_approved_user),
):
    """Poll a Google Photos Picker session status.

    The google_access_token is passed as a query parameter.
    Returns the session with mediaItemsSet boolean.
    """
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{GPHOTOS_PICKER_BASE}/sessions/{session_id}",
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
        data = resp.json()
        return {
            "id": data.get("id"),
            "mediaItemsSet": data.get("mediaItemsSet", False),
            "pollingConfig": data.get("pollingConfig"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to poll Google Photos session")
        raise HTTPException(502, f"Google Photos API error: {exc}") from exc


@app.get("/api/google-photos/session/{session_id}/media-items")
def gphotos_list_media_items(
    session_id: str,
    google_access_token: str,
    _user: dict = Depends(require_approved_user),
):
    """List picked media items from a completed Picker session.

    Returns the first photo's metadata (baseUrl, dimensions, mimeType).
    """
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{GPHOTOS_PICKER_BASE}/mediaItems",
                params={"sessionId": session_id},
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
        data = resp.json()
        items = data.get("pickedMediaItems", data.get("mediaItems", []))
        # Filter to images only
        images = [
            item for item in items
            if item.get("type", item.get("mimeType", "")).startswith("image")
            or "mediaFile" in item  # Picker API wraps in mediaFile
        ]
        return {"items": images}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to list Google Photos media items")
        raise HTTPException(502, f"Google Photos API error: {exc}") from exc


@app.post("/api/upload-from-google-photos")
def upload_from_google_photos(
    req: GooglePhotosUploadRequest,
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Download a photo from Google Photos and save it to our storage.

    The baseUrl from the Picker API requires an Authorization header,
    so the frontend cannot use it as a plain <img src>. This endpoint
    downloads the image bytes, stores them, and returns a permanent URL.
    """
    # Append =d to download full resolution with EXIF (minus location)
    download_url = req.base_url
    if "=" not in download_url.split("/")[-1]:
        download_url += "=d"

    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.get(
                download_url,
                headers={"Authorization": f"Bearer {req.access_token}"},
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"Failed to download photo from Google Photos ({resp.status_code})")

        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to download Google Photos image")
        raise HTTPException(502, f"Failed to download photo: {exc}") from exc

    url = provider.upload_image(img, "uploads", fmt="JPEG")
    w, h = img.size

    return {
        "url": url,
        "width": w,
        "height": h,
        "is_square": w == h,
    }


# ── Admin endpoints ────────────────────────────────────────────

class ApproveUserRequest(BaseModel):
    uid: str


@app.post("/api/admin/approve-user")
def approve_user(
    req: ApproveUserRequest,
    _admin: dict = Depends(require_admin),
):
    """Set the `approved` custom claim on a Firebase user (admin only)."""
    from firebase_admin import auth as firebase_auth
    try:
        firebase_auth.set_custom_user_claims(req.uid, {"approved": True})
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Failed to approve user: {exc}") from exc
    return {"status": "approved", "uid": req.uid}


@app.get("/api/admin/pending-users")
def list_pending_users(_admin: dict = Depends(require_admin)):
    """List Firebase users who haven't been approved yet (admin only)."""
    from firebase_admin import auth as firebase_auth
    page = firebase_auth.list_users()
    pending = []
    
    admin_emails = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "amuhr4@gmail.com").split(",") if e.strip()]
    
    for user in page.users:
        claims = user.custom_claims or {}
        is_admin = (user.email or "").lower() in admin_emails
        
        if not claims.get("approved", False) and not is_admin:
            pending.append({
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "creation_time": user.user_metadata.creation_timestamp,
            })
    return {"pending": pending}


@app.get("/api/me")
def me(user: dict = Depends(get_current_user)):
    """Return basic info about the authenticated user."""
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "approved": user.get("approved", False),
        "is_admin": user.get("email", "").lower() in os.environ.get("ADMIN_EMAILS", "amuhr4@gmail.com").split(","),
    }


@app.get("/api/recent-uploads")
def recent_uploads(
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """List the 10 most recently uploaded images (global, all users)."""
    items = provider.list_recent(folder="uploads", limit=10)
    return {"images": items}


@app.get("/api/admin/storage-usage")
def storage_usage(
    _admin: dict = Depends(require_admin),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Return total storage usage for managed prefixes (admin only)."""
    usage = provider.get_storage_usage()
    return usage


@app.delete("/api/admin/storage-clear")
def storage_clear(
    _admin: dict = Depends(require_admin),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Purge all files under managed prefixes (admin only)."""
    result = provider.clear_all_storage()
    return result


class PalettePreviewRequest(BaseModel):
    url: str
    set_id: str | None = None
    set_selections: list[SetSelection] | None = None
    preprocessing: bool = True
    contrast_boost: float = 1.0
    color_mode: str = "realistic"
    gradient_colors: list[str] | None = None
    target_width: int | None = None
    target_height: int | None = None


@app.post("/api/preview-palette")
def preview_palette(
    req: PalettePreviewRequest,
    _user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Uploads palette preview to Firebase Storage and returns URL."""
    try:
        img = _download_from_url(req.url)
    except Exception:
        raise HTTPException(400, "Cannot fetch image URL")

    set_data = _resolve_set_data(req.set_id, req.set_selections)

    grid_w = req.target_width if req.target_width else set_data["grid"][0]
    grid_h = req.target_height if req.target_height else set_data["grid"][1]
    
    palette_rgb = [c["rgb"] for c in set_data["colors"]]

    preview = generate_palette_preview(
        img, palette_rgb, grid_w, grid_h,
        preprocessing=req.preprocessing,
        contrast_boost=max(0.0, min(2.0, req.contrast_boost)),
    )

    url = provider.upload_image(preview, "previews", fmt="PNG")
    return {"url": url}



# ── Serve Frontend ─────────────────────────────────────────────

if not IS_PRODUCTION:
    UPLOAD_DIR = Path(__file__).parent / "uploads"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Mount static files ONLY if directory exists (in local dev)
# This MUST be placed after all other routes and mounts because it matches the root "/"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
else:
    @app.get("/")
    def health_check():
        return {"status": "ok", "message": "Backend is running"}
