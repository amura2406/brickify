"""
Storage Protocol and Implementations.

Follows Testability-First architectural rules by abstracting
the I/O (Firebase Storage vs Local Storage) into interchangeable providers
that are controlled by the central environment via Dependency Injection.
"""

from typing import Protocol
from PIL import Image
import io
import uuid
import os
import urllib.parse
from firebase_admin import storage


class StorageProvider(Protocol):
    def upload_image(self, img: Image.Image, folder: str, fmt: str = "JPEG") -> str:
        """Upload an image to storage and return its public URL."""
        ...


class FirebaseStorageProvider:
    """Production implementation: Saves directly to Firebase Cloud Storage bucket."""
    
    def __init__(self):
        # We rely on main.py / auth.py to ensure firebase_admin is initialized
        # with the correct storageBucket before we get here.
        pass

    def upload_image(self, img: Image.Image, folder: str, fmt: str = "JPEG") -> str:
        bucket = storage.bucket()
        
        bio = io.BytesIO()
        img.save(bio, format=fmt)
        bio.seek(0)
        
        file_id = str(uuid.uuid4())
        ext = fmt.lower().replace("jpeg", "jpg")
        path = f"{folder}/{file_id}.{ext}"
        blob = bucket.blob(path)
        
        token = str(uuid.uuid4())
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        
        content_type = f"image/{fmt.lower()}"
        blob.upload_from_file(bio, content_type=content_type)
        
        return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{urllib.parse.quote(path, safe='')}?alt=media&token={token}"


class LocalStorageProvider:
    """Local Development implementation: Saves to local hard disk and returns localhost URL."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.upload_dir = "uploads"
        self.base_url = base_url
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_image(self, img: Image.Image, folder: str, fmt: str = "JPEG") -> str:
        # Create folder inside local uploads dir
        target_dir = os.path.join(self.upload_dir, folder)
        os.makedirs(target_dir, exist_ok=True)
        
        file_id = str(uuid.uuid4())
        ext = fmt.lower().replace("jpeg", "jpg")
        filename = f"{file_id}.{ext}"
        
        local_path = os.path.join(target_dir, filename)
        img.save(local_path, format=fmt)
        
        url_path = f"uploads/{folder}/{filename}"
        return f"{self.base_url}/{url_path}"


def get_storage_provider() -> StorageProvider:
    """FastAPI Dependency to get the current storage provider based on environment."""
    if os.environ.get("ENVIRONMENT") == "development":
        # Can be made more robust by extracting Host url dynamically from request,
        # but for local dev localhost:8000 is the hardcoded default.
        return LocalStorageProvider()
    return FirebaseStorageProvider()
