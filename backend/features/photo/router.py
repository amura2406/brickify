from fastapi import APIRouter, Depends, Header
from auth import require_approved_user
from storage import StorageProvider, get_storage_provider
from .models import CreateSessionRequest, GooglePhotosUploadRequest
from .service import PhotoService
from .api import BackendGooglePhotosAPI

router = APIRouter(prefix="/api/google-photos", tags=["photo"])

def get_photo_service(provider: StorageProvider = Depends(get_storage_provider)) -> PhotoService:
    api = BackendGooglePhotosAPI()
    return PhotoService(gphotos_api=api, storage_provider=provider)

@router.post("/create-session")
def gphotos_create_session(
    req: CreateSessionRequest,
    _user: dict = Depends(require_approved_user),
    service: PhotoService = Depends(get_photo_service),
):
    """Create a Google Photos Picker session."""
    return service.create_session(req.access_token)

@router.get("/session/{session_id}")
def gphotos_get_session(
    session_id: str,
    x_google_access_token: str = Header(...),
    _user: dict = Depends(require_approved_user),
    service: PhotoService = Depends(get_photo_service),
):
    """Poll a Google Photos Picker session status."""
    return service.poll_session(session_id, x_google_access_token)

@router.get("/session/{session_id}/media-items")
def gphotos_list_media_items(
    session_id: str,
    x_google_access_token: str = Header(...),
    _user: dict = Depends(require_approved_user),
    service: PhotoService = Depends(get_photo_service),
):
    """List picked media items from a completed Picker session."""
    return service.list_media_items(session_id, x_google_access_token)

@router.post("/upload")
def upload_from_google_photos(
    req: GooglePhotosUploadRequest,
    user: dict = Depends(require_approved_user),
    service: PhotoService = Depends(get_photo_service),
):
    """Download a photo from Google Photos and save it to our storage."""
    return service.upload_from_google_photos(req.base_url, req.access_token, user["uid"])
