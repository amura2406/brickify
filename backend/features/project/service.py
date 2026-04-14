import base64
from io import BytesIO
from PIL import Image
from features.project.models import SaveProjectRequest
from storage import StorageProvider
from database import DatabaseProvider

class ProjectService:
    def __init__(self, db: DatabaseProvider, provider: StorageProvider):
        self.db = db
        self.provider = provider

    def count_projects(self, uid: str) -> int:
        return self.db.count_projects(uid)

    def _upload_b64(self, val: str, folder: str, uid: str) -> str:
        if not val or not val.startswith("data:image"):
            return val
        try:
            header, encoded = val.split(",", 1)
            img_data = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_data))
            
            # Use PNG for mosaics, JPEG for source/crops to save space
            req_fmt = "PNG" if folder == "mosaics" else "JPEG"
            if req_fmt == "JPEG":
                img = img.convert("RGB")
                
            return self.provider.upload_image(img, folder, fmt=req_fmt, user_id=uid)
        except Exception:
            import logging
            logging.getLogger(__name__).error("Failed processing base64 image", exc_info=True)
            return ""

    def process_base64_images(self, req: SaveProjectRequest, uid: str):
        req.mosaic_preview_url = self._upload_b64(req.mosaic_preview_url, "mosaics", uid)
        if req.image_url:
            req.image_url = self._upload_b64(req.image_url, "source", uid)
        if req.cropped_image_url:
            req.cropped_image_url = self._upload_b64(req.cropped_image_url, "crops", uid)
        
        for h in req.mosaic_history:
            if h.get("url"):
                h["url"] = self._upload_b64(h["url"], "mosaics", uid)
