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
import threading
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Load secret environment variables from .env
load_dotenv(Path(__file__).parent.parent / '.env')


from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Response, Header
from fastapi.responses import StreamingResponse
from pdf_export import generate_instructions_pdf
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import httpx
import urllib.parse
import urllib.request
from storage import StorageProvider, get_storage_provider
from database import DatabaseProvider, get_database_provider

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

_ADMIN_EMAILS: frozenset[str] = frozenset(
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "amuhr4@gmail.com").split(",")
    if e.strip()
)

# Max saved projects for non-admin users
_MAX_PROJECTS_PER_USER = 20

# In-memory store for async purge job status (single-instance, fine for Cloud Run)
# key: job_id (str) → value: {"status": "running"|"done"|"error", "result": dict|None, "error": str|None}
_purge_jobs: dict[str, dict] = {}

app = FastAPI(title="LEGO Mosaic Maker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Mount directory
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


logger = logging.getLogger(__name__)


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
    user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Upload an image directly to storage (approved users). Scoped per user."""
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image file")

    url = provider.upload_image(img, "uploads", fmt="JPEG", user_id=user["uid"])
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
    user: dict = Depends(require_approved_user),
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

    url = provider.upload_image(img, "uploads", fmt="JPEG", user_id=user["uid"])
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
    user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider)
):
    """Download image, optionally rotate, crop, and upload result."""
    try:
        img = _download_from_url(req.url)
    except Exception:
        raise HTTPException(400, "Cannot fetch image from URL")

    # Apply rotation before crop (uses PIL expand=True to avoid clipping)
    if req.rotation_degrees and req.rotation_degrees % 360 != 0:
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
    new_url = provider.upload_image(cropped, "crops", fmt="JPEG", user_id=user["uid"])

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
    saturation: float = 0.0
    temperature: float = 0.0
    sharpen: float = 0.0
    posterize_levels: int = 32
    gamma: float = 1.0
    black_point: int = 0
    white_point: int = 255
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
        "preview_url": "", # Deprecated, client uses canvas rendering instead
        "width": mosaic_data["width"],
        "height": mosaic_data["height"],
        "colors": mosaic_data["colors"],
        "grid": mosaic_data["grid"],
    }


class GeneratePdfRequest(BaseModel):
    grid: list[list[int]]
    colors: list[dict]
    width: int
    height: int


@app.post("/api/generate-pdf")
def generate_pdf(
    req: GeneratePdfRequest,
    user: dict = Depends(require_approved_user)
):
    """Generate a printable PDF build guide for a mosaic."""
    pdf_bytes = generate_instructions_pdf(req.grid, req.colors, req.width, req.height)
    return Response(content=pdf_bytes, media_type="application/pdf")

# ── Projects (Saved Mosaics) ───────────────────────────────────

class SaveProjectRequest(BaseModel):
    name: str
    image_url: str
    cropped_image_url: str
    mosaic_preview_url: str
    set_selections: list[dict]
    config: dict
    crop_state: dict | None = None
    mosaic_data: dict
    mosaic_history: list[dict] = []


@app.post("/api/projects")
def save_project(
    req: SaveProjectRequest,
    user: dict = Depends(require_approved_user),
    db: DatabaseProvider = Depends(get_database_provider),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Save a mosaic project (approved users). Enforces 20-project limit for non-admins."""
    uid = user["uid"]
    is_admin = user.get("email", "").lower() in _ADMIN_EMAILS

    if not is_admin:
        count = db.count_projects(uid)
        if count >= _MAX_PROJECTS_PER_USER:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "PROJECT_LIMIT_REACHED",
                    "message": f"You've reached the {_MAX_PROJECTS_PER_USER} project limit. "
                               "Delete a project to save a new one.",
                },
            )

    # Process base64 preview image from frontend
    if req.mosaic_preview_url.startswith("data:image"):
        import base64
        from io import BytesIO
        from PIL import Image
        try:
            header, encoded = req.mosaic_preview_url.split(",", 1)
            img_data = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_data))
            # Upload to storage provider and overwrite the URL format in the database
            req.mosaic_preview_url = provider.upload_image(img, "mosaics", fmt="PNG", user_id=uid)
        except Exception as e:
            # Fallback if image decode fails
            req.mosaic_preview_url = ""

    project_id = db.save_project(uid, req.model_dump())
    return {"project_id": project_id, "name": req.name}


@app.get("/api/projects")
def list_projects(
    user: dict = Depends(require_approved_user),
    db: DatabaseProvider = Depends(get_database_provider),
):
    """List saved project summaries for the current user (lightweight, no grid data)."""
    projects = db.list_projects(user["uid"])
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
def get_project(
    project_id: str,
    user: dict = Depends(require_approved_user),
    db: DatabaseProvider = Depends(get_database_provider),
):
    """Get full project detail including mosaic grid data."""
    project = db.get_project_detail(user["uid"], project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@app.put("/api/projects/{project_id}")
def update_project(
    project_id: str,
    req: SaveProjectRequest,
    user: dict = Depends(require_approved_user),
    db: DatabaseProvider = Depends(get_database_provider),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Update an existing saved project."""
    # Process base64 preview image from frontend
    if req.mosaic_preview_url.startswith("data:image"):
        import base64
        from io import BytesIO
        from PIL import Image
        try:
            header, encoded = req.mosaic_preview_url.split(",", 1)
            img_data = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_data))
            req.mosaic_preview_url = provider.upload_image(img, "mosaics", fmt="PNG", user_id=user["uid"])
        except Exception:
            pass

    updated = db.update_project(user["uid"], project_id, req.model_dump())
    if not updated:
        raise HTTPException(404, "Project not found")
    return {"project_id": project_id, "name": req.name}


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: str,
    user: dict = Depends(require_approved_user),
    db: DatabaseProvider = Depends(get_database_provider),
):
    """Delete a saved project."""
    deleted = db.delete_project(user["uid"], project_id)
    if not deleted:
        raise HTTPException(404, "Project not found")
    return {"deleted": project_id}


# ── Google Photos Picker API proxy ─────────────────────────────

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
    """Create a Google Photos Picker session."""
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
    x_google_access_token: str = Header(...),
    _user: dict = Depends(require_approved_user),
):
    """Poll a Google Photos Picker session status."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{GPHOTOS_PICKER_BASE}/sessions/{session_id}",
                headers={"Authorization": f"Bearer {x_google_access_token}"},
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
    x_google_access_token: str = Header(...),
    _user: dict = Depends(require_approved_user),
):
    """List picked media items from a completed Picker session."""
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{GPHOTOS_PICKER_BASE}/mediaItems",
                params={"sessionId": session_id},
                headers={"Authorization": f"Bearer {x_google_access_token}"},
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
        data = resp.json()
        items = data.get("pickedMediaItems", data.get("mediaItems", []))
        images = [
            item for item in items
            if item.get("type", item.get("mimeType", "")).startswith("image")
            or "mediaFile" in item
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
    user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Download a photo from Google Photos and save it to our storage."""
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

    url = provider.upload_image(img, "uploads", fmt="JPEG", user_id=user["uid"])
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
    except Exception as exc:
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
        "is_admin": user.get("email", "").lower() in _ADMIN_EMAILS,
    }


@app.get("/api/recent-uploads")
def recent_uploads(
    user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """List the 10 most recently uploaded images for the current user."""
    items = provider.list_recent(folder="uploads", limit=10, user_id=user["uid"])
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
    db: DatabaseProvider = Depends(get_database_provider),
):
    """Start an async purge of all storage files, skipping images used by saved projects (admin only).

    Returns 202 Accepted immediately with a job_id. Poll GET /api/admin/storage-clear/{job_id}
    for status. This avoids timeouts from the Firebase Hosting 60s proxy limit.
    """
    # Build the exclusion set synchronously first (fast Firestore read)
    try:
        excluded_urls = db.get_all_referenced_urls()
        logger.info("Purge: protecting %d URLs from saved projects", len(excluded_urls))
    except Exception:
        logger.exception("Failed to build exclusion set; aborting purge for safety")
        raise HTTPException(500, "Failed to build purge exclusion set. No files were deleted.")

    job_id = str(uuid.uuid4())
    _purge_jobs[job_id] = {"status": "running", "result": None, "error": None}

    def _run_purge() -> None:
        try:
            result = provider.clear_all_storage(excluded_urls=excluded_urls)
            _purge_jobs[job_id] = {"status": "done", "result": result, "error": None}
            logger.info("Purge job %s complete: %s", job_id, result)
        except Exception as exc:
            logger.exception("Purge job %s failed", job_id)
            _purge_jobs[job_id] = {"status": "error", "result": None, "error": str(exc)}

    threading.Thread(target=_run_purge, daemon=True).start()

    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=202, content={"job_id": job_id, "status": "running"})


@app.get("/api/admin/storage-clear/{job_id}")
def storage_clear_status(
    job_id: str,
    _admin: dict = Depends(require_admin),
):
    """Poll the status of an async purge job (admin only)."""
    job = _purge_jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return job


class PalettePreviewRequest(BaseModel):
    url: str
    set_id: str | None = None
    set_selections: list[SetSelection] | None = None
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
