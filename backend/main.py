"""
LEGO Mosaic Maker — FastAPI Backend

Serves the frontend and provides API endpoints for
image upload, cropping, and mosaic generation.

Auth: Firebase ID tokens (JWT) are required on all /api/* endpoints.
Admin approval: users must have the `approved` custom claim set to true
by an admin via POST /api/admin/approve-user.
"""

import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# Load secret environment variables from .env
load_dotenv(Path(__file__).parent.parent / '.env')

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Routers
from features.photo.router import router as photo_router
from features.project.router import router as project_router
from features.admin.router import router as admin_router
from features.user.router import router as user_router
from features.lego_set.router import router as lego_set_router
from features.mosaic.router import router as mosaic_router
from features.config.router import router as config_router

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(photo_router)
app.include_router(project_router)
app.include_router(admin_router)
app.include_router(user_router)
app.include_router(lego_set_router)
app.include_router(mosaic_router)
app.include_router(config_router)

# Mount directory
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

logger = logging.getLogger(__name__)

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
