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

    def process_base64_preview(self, req: SaveProjectRequest, uid: str):
        if req.mosaic_preview_url.startswith("data:image"):
            try:
                header, encoded = req.mosaic_preview_url.split(",", 1)
                img_data = base64.b64decode(encoded)
                img = Image.open(BytesIO(img_data))
                req.mosaic_preview_url = self.provider.upload_image(img, "mosaics", fmt="PNG", user_id=uid)
            except Exception:
                req.mosaic_preview_url = ""
