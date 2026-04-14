from fastapi import APIRouter, Depends
from auth import require_approved_user, get_current_user
from storage import get_storage_provider, StorageProvider
import os

router = APIRouter(prefix="/api", tags=["user"])

@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    """Return basic info about the authenticated user."""
    admin_emails = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "amuhr4@gmail.com").split(",") if e.strip()]
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "approved": user.get("approved", False),
        "is_admin": user.get("email", "").lower() in admin_emails,
    }

@router.get("/recent-uploads")
def recent_uploads(
    user: dict = Depends(require_approved_user),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """List the 10 most recently uploaded images for the current user."""
    items = provider.list_recent(folder="uploads", limit=10, user_id=user["uid"])
    return {"images": items}
