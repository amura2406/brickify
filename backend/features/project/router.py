from fastapi import APIRouter, Depends, HTTPException
from auth import require_approved_user
from database import get_database_provider, DatabaseProvider
from storage import get_storage_provider, StorageProvider
from features.project.models import SaveProjectRequest
from features.project.service import ProjectService
import os

router = APIRouter(prefix="/api/projects", tags=["projects"])
_MAX_PROJECTS_PER_USER = 20

def get_project_service(
    db: DatabaseProvider = Depends(get_database_provider),
    provider: StorageProvider = Depends(get_storage_provider)
) -> ProjectService:
    return ProjectService(db, provider)

@router.post("")
def save_project(
    req: SaveProjectRequest,
    user: dict = Depends(require_approved_user),
    service: ProjectService = Depends(get_project_service)
):
    """Save a mosaic project (approved users). Enforces 20-project limit for non-admins."""
    uid = user["uid"]
    admin_emails = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "amuhr4@gmail.com").split(",") if e.strip()]
    is_admin = user.get("email", "").lower() in admin_emails

    if not is_admin:
        count = service.count_projects(uid)
        if count >= _MAX_PROJECTS_PER_USER:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "PROJECT_LIMIT_REACHED",
                    "message": f"You've reached the {_MAX_PROJECTS_PER_USER} project limit. "
                               "Delete a project to save a new one.",
                },
            )

    service.process_base64_images(req, uid)
    project_id = service.db.save_project(uid, req.model_dump())
    return {"project_id": project_id, "name": req.name}

@router.get("")
def list_projects(
    user: dict = Depends(require_approved_user),
    service: ProjectService = Depends(get_project_service)
):
    """List saved project summaries for the current user (lightweight, no grid data)."""
    projects = service.db.list_projects(user["uid"])
    return {"projects": projects}

@router.get("/{project_id}")
def get_project(
    project_id: str,
    user: dict = Depends(require_approved_user),
    service: ProjectService = Depends(get_project_service)
):
    """Get full project detail including mosaic grid data."""
    project = service.db.get_project_detail(user["uid"], project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project

@router.put("/{project_id}")
def update_project(
    project_id: str,
    req: SaveProjectRequest,
    user: dict = Depends(require_approved_user),
    service: ProjectService = Depends(get_project_service)
):
    """Update an existing saved project."""
    service.process_base64_images(req, user["uid"])
    updated = service.db.update_project(user["uid"], project_id, req.model_dump())
    if not updated:
        raise HTTPException(404, "Project not found")
    return {"updated": project_id}

@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    user: dict = Depends(require_approved_user),
    service: ProjectService = Depends(get_project_service)
):
    """Delete a saved project."""
    deleted = service.db.delete_project(user["uid"], project_id)
    if not deleted:
        raise HTTPException(404, "Project not found")
    return {"deleted": project_id}
