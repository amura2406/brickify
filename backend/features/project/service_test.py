import pytest
from features.project.service import ProjectService
from features.project.models import SaveProjectRequest
from storage import StorageProvider
from database import DatabaseProvider

class MockDatabaseProvider(DatabaseProvider):
    def __init__(self):
        pass

    def count_projects(self, uid: str) -> int:
        return 5

class MockStorageProvider(StorageProvider):
    def __init__(self):
        pass

    def upload_image(self, image, bucket_name: str, fmt: str = "JPEG", user_id: str = "guest") -> str:
        return "https://storage.mock/mosaics/preview.png"

def test_count_projects():
    service = ProjectService(MockDatabaseProvider(), MockStorageProvider())
    res = service.count_projects("user_123")
    assert res == 5

def test_process_base64_preview():
    service = ProjectService(MockDatabaseProvider(), MockStorageProvider())
    
    # 1x1 transparent PNG
    b64_img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    
    req = SaveProjectRequest(
        name="Test",
        image_url="http://example.com/image.jpg",
        cropped_image_url="http://example.com/cropped.jpg",
        mosaic_preview_url=b64_img,
        set_selections=[],
        config={},
        mosaic_data={}
    )
    
    service.process_base64_preview(req, "user_123")
    assert req.mosaic_preview_url == "https://storage.mock/mosaics/preview.png"

def test_process_base64_preview_invalid():
    service = ProjectService(MockDatabaseProvider(), MockStorageProvider())
    
    req = SaveProjectRequest(
        name="Test",
        image_url="http://example.com/image.jpg",
        cropped_image_url="http://example.com/cropped.jpg",
        mosaic_preview_url="data:image/png;base64,INVALID_B64!!!!",
        set_selections=[],
        config={},
        mosaic_data={}
    )
    
    service.process_base64_preview(req, "user_123")
    assert req.mosaic_preview_url == ""

def test_process_base64_preview_not_data_image():
    service = ProjectService(MockDatabaseProvider(), MockStorageProvider())
    
    req = SaveProjectRequest(
        name="Test",
        image_url="http://example.com/image.jpg",
        cropped_image_url="http://example.com/cropped.jpg",
        mosaic_preview_url="https://example.com/normal_image.png",
        set_selections=[],
        config={},
        mosaic_data={}
    )
    
    service.process_base64_preview(req, "user_123")
    assert req.mosaic_preview_url == "https://example.com/normal_image.png"
