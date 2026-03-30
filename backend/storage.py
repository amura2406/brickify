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
import logging
from firebase_admin import storage

logger = logging.getLogger(__name__)


class StorageProvider(Protocol):
    def upload_image(self, img: Image.Image, folder: str, fmt: str = "JPEG") -> str:
        """Upload an image to storage and return its public URL."""
        ...

    def list_recent(self, folder: str = "uploads", limit: int = 10) -> list[dict]:
        """List recently uploaded files with metadata.

        Returns list of dicts: [{"url": str, "name": str, "created": str}]
        Sorted by creation time (most recent first), limited to `limit` items.
        """
        ...

    def get_storage_usage(self) -> dict:
        """Return storage usage info for all managed prefixes.

        Returns dict: {"total_bytes": int, "total_files": int, "by_prefix": {...}}
        """
        ...

    def clear_all_storage(self, prefixes: list[str] | None = None) -> dict:
        """Delete all files under the given prefixes.

        Args:
            prefixes: list of folder prefixes to clear. Defaults to
                      ["uploads", "crops", "mosaics", "previews"].

        Returns dict: {"deleted_count": int}
        """
        ...


class FirebaseStorageProvider:
    """Production implementation: Saves directly to Firebase Cloud Storage bucket."""

    _MANAGED_PREFIXES = ["uploads", "crops", "mosaics", "previews"]

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

    def list_recent(self, folder: str = "uploads", limit: int = 10) -> list[dict]:
        bucket = storage.bucket()
        blobs = list(bucket.list_blobs(prefix=f"{folder}/", max_results=500))

        # Sort by time_created descending (most recent first)
        blobs.sort(key=lambda b: b.time_created or "", reverse=True)
        blobs = blobs[:limit]

        result = []
        for blob in blobs:
            # Build public download URL with the stored token
            token = None
            if blob.metadata:
                token = blob.metadata.get("firebaseStorageDownloadTokens")

            if token:
                url = (
                    f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
                    f"/o/{urllib.parse.quote(blob.name, safe='')}?alt=media&token={token}"
                )
            else:
                # Fallback: make the blob publicly readable temporarily
                blob.make_public()
                url = blob.public_url

            result.append({
                "url": url,
                "name": blob.name.split("/")[-1],
                "created": blob.time_created.isoformat() if blob.time_created else "",
            })
        return result

    def get_storage_usage(self) -> dict:
        bucket = storage.bucket()
        total_bytes = 0
        total_files = 0
        by_prefix: dict[str, dict] = {}

        for prefix in self._MANAGED_PREFIXES:
            prefix_bytes = 0
            prefix_files = 0
            for blob in bucket.list_blobs(prefix=f"{prefix}/"):
                size = blob.size or 0
                prefix_bytes += size
                prefix_files += 1
            by_prefix[prefix] = {"bytes": prefix_bytes, "files": prefix_files}
            total_bytes += prefix_bytes
            total_files += prefix_files

        return {
            "total_bytes": total_bytes,
            "total_files": total_files,
            "by_prefix": by_prefix,
        }

    def clear_all_storage(self, prefixes: list[str] | None = None) -> dict:
        if prefixes is None:
            prefixes = self._MANAGED_PREFIXES

        bucket = storage.bucket()
        deleted = 0

        for prefix in prefixes:
            blobs = list(bucket.list_blobs(prefix=f"{prefix}/"))
            for blob in blobs:
                try:
                    blob.delete()
                    deleted += 1
                except Exception:
                    logger.warning("Failed to delete blob: %s", blob.name, exc_info=True)

        return {"deleted_count": deleted}


class LocalStorageProvider:
    """Local Development implementation: Saves to local hard disk and returns localhost URL."""

    _MANAGED_PREFIXES = ["uploads", "crops", "mosaics", "previews"]

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

    def list_recent(self, folder: str = "uploads", limit: int = 10) -> list[dict]:
        target_dir = os.path.join(self.upload_dir, folder)
        if not os.path.isdir(target_dir):
            return []

        files = []
        for f in os.listdir(target_dir):
            fpath = os.path.join(target_dir, f)
            if os.path.isfile(fpath):
                files.append((f, os.path.getmtime(fpath)))

        # Sort by modification time descending
        files.sort(key=lambda x: x[1], reverse=True)
        files = files[:limit]

        return [
            {
                "url": f"{self.base_url}/uploads/{folder}/{name}",
                "name": name,
                "created": "",
            }
            for name, _ in files
        ]

    def get_storage_usage(self) -> dict:
        total_bytes = 0
        total_files = 0
        by_prefix: dict[str, dict] = {}

        for prefix in self._MANAGED_PREFIXES:
            target_dir = os.path.join(self.upload_dir, prefix)
            prefix_bytes = 0
            prefix_files = 0
            if os.path.isdir(target_dir):
                for f in os.listdir(target_dir):
                    fpath = os.path.join(target_dir, f)
                    if os.path.isfile(fpath):
                        prefix_bytes += os.path.getsize(fpath)
                        prefix_files += 1
            by_prefix[prefix] = {"bytes": prefix_bytes, "files": prefix_files}
            total_bytes += prefix_bytes
            total_files += prefix_files

        return {
            "total_bytes": total_bytes,
            "total_files": total_files,
            "by_prefix": by_prefix,
        }

    def clear_all_storage(self, prefixes: list[str] | None = None) -> dict:
        import shutil

        if prefixes is None:
            prefixes = self._MANAGED_PREFIXES

        deleted = 0
        for prefix in prefixes:
            target_dir = os.path.join(self.upload_dir, prefix)
            if os.path.isdir(target_dir):
                for f in os.listdir(target_dir):
                    fpath = os.path.join(target_dir, f)
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                        deleted += 1

        return {"deleted_count": deleted}


def get_storage_provider() -> StorageProvider:
    """FastAPI Dependency to get the current storage provider based on environment."""
    if os.environ.get("ENV", "development") != "production":
        # Can be made more robust by extracting Host url dynamically from request,
        # but for local dev localhost:8000 is the hardcoded default.
        return LocalStorageProvider()
    return FirebaseStorageProvider()
