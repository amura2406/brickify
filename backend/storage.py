"""
Storage Protocol and Implementations.

Follows Testability-First architectural rules by abstracting
the I/O (Firebase Storage vs Local Storage) into interchangeable providers
that are controlled by the central environment via Dependency Injection.

Changes vs original:
- upload_image() now accepts optional user_id for per-user path scoping
- list_recent() accepts optional user_id to filter by user prefix
- clear_all_storage() accepts excluded_urls set to protect saved-project assets
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
    def upload_image(
        self, img: Image.Image, folder: str, fmt: str = "JPEG", user_id: str | None = None
    ) -> str:
        """Upload an image to storage and return its public URL.

        If user_id is provided, the file is stored under {folder}/{user_id}/{uuid}.
        Otherwise it falls back to {folder}/{uuid} (backward compatible).
        """
        ...

    def list_recent(
        self, folder: str = "uploads", limit: int = 10, user_id: str | None = None
    ) -> list[dict]:
        """List recently uploaded files with metadata.

        If user_id is provided, only files under {folder}/{user_id}/ are returned.
        Returns list of dicts: [{"url": str, "name": str, "created": str}]
        Sorted by creation time (most recent first), limited to `limit` items.
        """
        ...

    def get_storage_usage(self) -> dict:
        """Return storage usage info for all managed prefixes.

        Returns dict: {"total_bytes": int, "total_files": int, "by_prefix": {...}}
        """
        ...

    def clear_all_storage(
        self,
        prefixes: list[str] | None = None,
        excluded_urls: set[str] | None = None,
    ) -> dict:
        """Delete all files under the given prefixes, skipping protected URLs.

        Args:
            prefixes: list of folder prefixes to clear. Defaults to
                      ["uploads", "crops", "mosaics", "previews"].
            excluded_urls: set of full download URLs to skip (saved project assets).

        Returns dict: {"deleted_count": int, "protected_count": int}
        """
        ...


class FirebaseStorageProvider:
    """Production implementation: Saves directly to Firebase Cloud Storage bucket."""

    _MANAGED_PREFIXES = ["uploads", "crops", "mosaics", "previews"]

    def __init__(self):
        # We rely on main.py / auth.py to ensure firebase_admin is initialized
        # with the correct storageBucket before we get here.
        pass

    def _make_path(self, folder: str, file_id: str, ext: str, user_id: str | None) -> str:
        if user_id:
            return f"{folder}/{user_id}/{file_id}.{ext}"
        return f"{folder}/{file_id}.{ext}"

    def upload_image(
        self, img: Image.Image, folder: str, fmt: str = "JPEG", user_id: str | None = None
    ) -> str:
        bucket = storage.bucket()

        bio = io.BytesIO()
        img.save(bio, format=fmt)
        bio.seek(0)

        file_id = str(uuid.uuid4())
        ext = fmt.lower().replace("jpeg", "jpg")
        path = self._make_path(folder, file_id, ext, user_id)
        blob = bucket.blob(path)

        token = str(uuid.uuid4())
        blob.metadata = {"firebaseStorageDownloadTokens": token}

        content_type = f"image/{fmt.lower()}"
        blob.upload_from_file(bio, content_type=content_type)

        return (
            f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
            f"/o/{urllib.parse.quote(path, safe='')}?alt=media&token={token}"
        )

    def list_recent(
        self, folder: str = "uploads", limit: int = 10, user_id: str | None = None
    ) -> list[dict]:
        bucket = storage.bucket()
        prefix = f"{folder}/{user_id}/" if user_id else f"{folder}/"
        blobs = list(bucket.list_blobs(prefix=prefix, max_results=500))

        # Sort by time_created descending (most recent first)
        blobs.sort(key=lambda b: b.time_created or "", reverse=True)
        blobs = blobs[:limit]

        result = []
        for blob in blobs:
            token = None
            if blob.metadata:
                token = blob.metadata.get("firebaseStorageDownloadTokens")

            if token:
                url = (
                    f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
                    f"/o/{urllib.parse.quote(blob.name, safe='')}?alt=media&token={token}"
                )
            else:
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

    def clear_all_storage(
        self,
        prefixes: list[str] | None = None,
        excluded_urls: set[str] | None = None,
    ) -> dict:
        if prefixes is None:
            prefixes = self._MANAGED_PREFIXES
        if excluded_urls is None:
            excluded_urls = set()

        bucket = storage.bucket()
        deleted = 0
        protected = 0

        for prefix in prefixes:
            blobs = list(bucket.list_blobs(prefix=f"{prefix}/"))
            for blob in blobs:
                # Build the blob's download URL pattern to match against excluded set.
                # We check both token-based and public URL forms.
                blob_url_base = (
                    f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
                    f"/o/{urllib.parse.quote(blob.name, safe='')}"
                )
                is_protected = any(blob_url_base in excl for excl in excluded_urls)
                if is_protected:
                    protected += 1
                    continue
                try:
                    blob.delete()
                    deleted += 1
                except Exception as exc:
                    logger.warning("Failed to delete blob: %s", blob.name, exc_info=True)

        return {"deleted_count": deleted, "protected_count": protected}


class LocalStorageProvider:
    """Local Development implementation: Saves to local hard disk and returns localhost URL."""

    _MANAGED_PREFIXES = ["uploads", "crops", "mosaics", "previews"]

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.upload_dir = "uploads"
        self.base_url = base_url
        os.makedirs(self.upload_dir, exist_ok=True)

    def _make_subdir(self, folder: str, user_id: str | None) -> str:
        if user_id:
            return os.path.join(self.upload_dir, folder, user_id)
        return os.path.join(self.upload_dir, folder)

    def _make_url(self, folder: str, user_id: str | None, filename: str) -> str:
        if user_id:
            return f"{self.base_url}/uploads/{folder}/{user_id}/{filename}"
        return f"{self.base_url}/uploads/{folder}/{filename}"

    def upload_image(
        self, img: Image.Image, folder: str, fmt: str = "JPEG", user_id: str | None = None
    ) -> str:
        target_dir = self._make_subdir(folder, user_id)
        os.makedirs(target_dir, exist_ok=True)

        file_id = str(uuid.uuid4())
        ext = fmt.lower().replace("jpeg", "jpg")
        filename = f"{file_id}.{ext}"
        local_path = os.path.join(target_dir, filename)
        img.save(local_path, format=fmt)

        return self._make_url(folder, user_id, filename)

    def list_recent(
        self, folder: str = "uploads", limit: int = 10, user_id: str | None = None
    ) -> list[dict]:
        target_dir = self._make_subdir(folder, user_id)
        if not os.path.isdir(target_dir):
            return []

        files = []
        for f in os.listdir(target_dir):
            fpath = os.path.join(target_dir, f)
            if os.path.isfile(fpath):
                files.append((f, os.path.getmtime(fpath)))

        files.sort(key=lambda x: x[1], reverse=True)
        files = files[:limit]

        return [
            {
                "url": self._make_url(folder, user_id, name),
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
                for root, _dirs, files in os.walk(target_dir):
                    for f in files:
                        fpath = os.path.join(root, f)
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

    def clear_all_storage(
        self,
        prefixes: list[str] | None = None,
        excluded_urls: set[str] | None = None,
    ) -> dict:
        if prefixes is None:
            prefixes = self._MANAGED_PREFIXES
        if excluded_urls is None:
            excluded_urls = set()

        deleted = 0
        protected = 0

        for prefix in prefixes:
            target_dir = os.path.join(self.upload_dir, prefix)
            if not os.path.isdir(target_dir):
                continue
            for root, _dirs, files in os.walk(target_dir):
                for f in files:
                    fpath = os.path.join(root, f)
                    if not os.path.isfile(fpath):
                        continue
                    # Build a URL equivalent to check against exclusions
                    rel = os.path.relpath(fpath, self.upload_dir).replace(os.sep, "/")
                    url = f"{self.base_url}/uploads/{rel}"
                    if url in excluded_urls:
                        protected += 1
                        continue
                    os.remove(fpath)
                    deleted += 1

        return {"deleted_count": deleted, "protected_count": protected}


def get_storage_provider() -> StorageProvider:
    """FastAPI Dependency to get the current storage provider based on environment."""
    if os.environ.get("ENV", "development") != "production":
        return LocalStorageProvider()
    return FirebaseStorageProvider()
