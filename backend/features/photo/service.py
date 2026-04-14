import io
import logging
from PIL import Image
from .contract import GooglePhotosAPI
from storage import StorageProvider

logger = logging.getLogger(__name__)

class PhotoService:
    def __init__(self, gphotos_api: GooglePhotosAPI, storage_provider: StorageProvider):
        self.gphotos_api = gphotos_api
        self.storage_provider = storage_provider

    def create_session(self, access_token: str) -> dict:
        return self.gphotos_api.create_session(access_token)

    def poll_session(self, session_id: str, access_token: str) -> dict:
        return self.gphotos_api.poll_session(session_id, access_token)

    def list_media_items(self, session_id: str, access_token: str) -> dict:
        return {"items": self.gphotos_api.list_media_items(session_id, access_token)}

    def upload_from_google_photos(self, base_url: str, access_token: str, user_id: str) -> dict:
        if "=" not in base_url.split("/")[-1]:
            base_url += "=d"

        content = self.gphotos_api.download_photo(base_url, access_token)
        try:
            img = Image.open(io.BytesIO(content)).convert("RGB")
        except Exception as exc:
            logger.exception("Failed to open image from Google Photos")
            raise ValueError(f"Failed to process downloaded photo: {exc}") from exc

        url = self.storage_provider.upload_image(img, "uploads", fmt="JPEG", user_id=user_id)
        w, h = img.size

        return {
            "url": url,
            "width": w,
            "height": h,
            "is_square": w == h,
        }
