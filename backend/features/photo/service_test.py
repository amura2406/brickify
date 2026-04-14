import pytest
from features.photo.service import PhotoService
from features.photo.contract import GooglePhotosAPI
from storage import StorageProvider

class MockGooglePhotosAPI(GooglePhotosAPI):
    def create_session(self, access_token: str) -> dict:
        return {"id": "session-1", "pickerUri": "https://picker.uri"}
        
    def poll_session(self, session_id: str, access_token: str) -> dict:
        return {"id": session_id, "mediaItemsSet": True}
        
    def list_media_items(self, session_id: str, access_token: str) -> list[dict]:
        return [{"id": "item-1"}]
        
    def download_photo(self, base_url: str, access_token: str) -> bytes:
        from PIL import Image
        import io
        img = Image.new('RGB', (10, 10), color='white')
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        return buf.getvalue()

class MockStorageProvider(StorageProvider):
    def upload_image(self, image, bucket_name: str, fmt: str = "JPEG", user_id: str = "guest") -> str:
        return "https://storage.mock/image.jpg"
    def delete_image(self, image_url: str):
        pass

def test_create_session():
    service = PhotoService(MockGooglePhotosAPI(), MockStorageProvider())
    res = service.create_session("token")
    assert res["id"] == "session-1"

def test_poll_session():
    service = PhotoService(MockGooglePhotosAPI(), MockStorageProvider())
    res = service.poll_session("session-1", "token")
    assert res["id"] == "session-1"
    assert res["mediaItemsSet"] is True

def test_list_media_items():
    service = PhotoService(MockGooglePhotosAPI(), MockStorageProvider())
    res = service.list_media_items("session-1", "token")
    assert len(res["items"]) == 1

def test_upload_from_google_photos():
    service = PhotoService(MockGooglePhotosAPI(), MockStorageProvider())
    res = service.upload_from_google_photos("https://base.url", "token", "user_123")
    assert res["url"] == "https://storage.mock/image.jpg"
    assert res["width"] == 10
    assert res["height"] == 10
    assert res["is_square"] is True
