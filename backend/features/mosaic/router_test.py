import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from PIL import Image

from features.mosaic.router import router
from storage import StorageProvider, get_storage_provider
from auth import require_approved_user
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)

class MockStorageProvider(StorageProvider):
    def upload_image(self, img, folder, fmt="JPEG", user_id=None):
        return f"https://mock.storage/{folder}/{user_id}/crop.jpg"
        
    def list_recent(self, folder="uploads", limit=10, user_id=None):
        return []
        
    def get_storage_usage(self):
        return {}
        
    def clear_all_storage(self, prefixes=None, excluded_urls=None):
        return {}

def mock_get_user():
    return {"uid": "test_user"}

def mock_get_storage():
    return MockStorageProvider()

app.dependency_overrides[require_approved_user] = mock_get_user
app.dependency_overrides[get_storage_provider] = mock_get_storage

client = TestClient(app)

@pytest.fixture
def mock_image():
    # 100x100 image
    return Image.new("RGB", (100, 100), color="blue")

def test_crop_image_success(mock_image):
    with patch("features.mosaic.router._download_from_url", return_value=mock_image):
        req_data = {
            "url": "http://example.com/image.jpg",
            "x": 10,
            "y": 10,
            "w": 50,
            "h": 50,
            "rotation_degrees": 0
        }
        response = client.post("/api/crop", json=req_data)
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://mock.storage/crops/test_user/crop.jpg"
        assert data["width"] == 50
        assert data["height"] == 50
        assert data["is_square"] is True

def test_crop_image_out_of_bounds_clamping(mock_image):
    with patch("features.mosaic.router._download_from_url", return_value=mock_image):
        req_data = {
            "url": "http://example.com/image.jpg",
            "x": 80,
            "y": 80,
            "w": 50,
            "h": 50,
            "rotation_degrees": 0
        }
        response = client.post("/api/crop", json=req_data)
        assert response.status_code == 200
        data = response.json()
        # the image is 100x100. crop from 80, 80 with width 50 -> x and y are shifted to 50
        # so width and height remain 50
        assert data["width"] == 50
        assert data["height"] == 50
        assert data["is_square"] is True

def test_crop_image_invalid_url():
    with patch("features.mosaic.router._download_from_url", side_effect=Exception("Network error")):
        req_data = {
            "url": "invalid_url",
            "x": 0, "y": 0, "w": 50, "h": 50, "rotation_degrees": 0
        }
        response = client.post("/api/crop", json=req_data)
        assert response.status_code == 400
        assert "Cannot fetch image from URL" in response.json()["detail"]

def test_crop_image_too_small(mock_image):
    with patch("features.mosaic.router._download_from_url", return_value=mock_image):
        req_data = {
            "url": "http://example.com/image.jpg",
            "x": 10,
            "y": 10,
            "w": 0, # zero width
            "h": 0,
            "rotation_degrees": 0
        }
        response = client.post("/api/crop", json=req_data)
        assert response.status_code == 400
        assert "Crop region too small" in response.json()["detail"]

def test_crop_image_rotation(mock_image):
    with patch("features.mosaic.router._download_from_url", return_value=mock_image):
        req_data = {
            "url": "http://example.com/image.jpg",
            "x": 0,
            "y": 0,
            "w": 50,
            "h": 50,
            "rotation_degrees": 90
        }
        response = client.post("/api/crop", json=req_data)
        assert response.status_code == 200
        data = response.json()
        assert data["width"] == 50
        assert data["height"] == 50
