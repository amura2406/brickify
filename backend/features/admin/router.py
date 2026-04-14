import os
import uuid
import threading
import logging
from fastapi import APIRouter, Depends, HTTPException
from auth import require_admin
from database import get_database_provider, DatabaseProvider
from storage import get_storage_provider, StorageProvider
from fastapi.responses import JSONResponse
from features.admin.models import ApproveUserRequest

router = APIRouter(prefix="/api/admin", tags=["admin"])

# In-memory store for async purge job status (single-instance, fine for Cloud Run)
_purge_jobs = {}

@router.post("/approve-user")
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

@router.get("/pending-users")
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

@router.get("/storage-usage")
def storage_usage(
    _admin: dict = Depends(require_admin),
    provider: StorageProvider = Depends(get_storage_provider),
):
    """Return total storage usage for managed prefixes (admin only)."""
    usage = provider.get_storage_usage()
    return usage

@router.delete("/storage-clear")
def storage_clear(
    _admin: dict = Depends(require_admin),
    provider: StorageProvider = Depends(get_storage_provider),
    db: DatabaseProvider = Depends(get_database_provider),
):
    """Start an async purge of all storage files, skipping images used by saved projects."""
    logger = logging.getLogger(__name__)
    try:
        excluded_urls = db.get_all_referenced_urls()
        logger.info("Purge: protecting %d URLs from saved projects", len(excluded_urls))
    except Exception as exc:
        logger.exception("Failed to build exclusion set; aborting purge for safety")
        raise HTTPException(500, "Failed to build purge exclusion set. No files were deleted.") from exc

    job_id = str(uuid.uuid4())
    _purge_jobs[job_id] = {"status": "running", "result": None, "error": None}

    def _run_purge():
        try:
            result = provider.clear_all_storage(excluded_urls=excluded_urls)
            _purge_jobs[job_id] = {"status": "done", "result": result, "error": None}
            logger.info("Purge job %s complete: %s", job_id, result)
        except Exception as exc:
            logger.exception("Purge job %s failed", job_id)
            _purge_jobs[job_id] = {"status": "error", "result": None, "error": str(exc)}

    threading.Thread(target=_run_purge, daemon=True).start()
    return JSONResponse(status_code=202, content={"job_id": job_id, "status": "running"})

@router.get("/storage-clear/{job_id}")
def storage_clear_status(
    job_id: str,
    _admin: dict = Depends(require_admin),
):
    """Poll the status of an async purge job (admin only)."""
    job = _purge_jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return job
