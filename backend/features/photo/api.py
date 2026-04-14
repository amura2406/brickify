import httpx
from fastapi import HTTPException
import logging
from .contract import GooglePhotosAPI

logger = logging.getLogger(__name__)

GPHOTOS_PICKER_BASE = "https://photospicker.googleapis.com/v1"

class BackendGooglePhotosAPI(GooglePhotosAPI):
    def create_session(self, access_token: str) -> dict:
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    f"{GPHOTOS_PICKER_BASE}/sessions",
                    headers={"Authorization": f"Bearer {access_token}"},
                    json={},
                )
            if resp.status_code == 400 and "FAILED_PRECONDITION" in resp.text:
                raise HTTPException(
                    412,
                    "This Google account does not have an active Google Photos library. "
                    "Please make sure Google Photos is set up for your account.",
                )
            if resp.status_code != 200:
                logger.warning("Picker session create failed: %s %s", resp.status_code, resp.text[:300])
                raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
            data = resp.json()
            return {
                "id": data["id"],
                "pickerUri": data["pickerUri"],
            }
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create Google Photos session")
            raise HTTPException(502, f"Google Photos API error: {exc}") from exc

    def poll_session(self, session_id: str, access_token: str) -> dict:
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.get(
                    f"{GPHOTOS_PICKER_BASE}/sessions/{session_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if resp.status_code != 200:
                raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
            data = resp.json()
            return {
                "id": data.get("id"),
                "mediaItemsSet": data.get("mediaItemsSet", False),
                "pollingConfig": data.get("pollingConfig"),
            }
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to poll Google Photos session")
            raise HTTPException(502, f"Google Photos API error: {exc}") from exc

    def list_media_items(self, session_id: str, access_token: str) -> list[dict]:
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{GPHOTOS_PICKER_BASE}/mediaItems",
                    params={"sessionId": session_id},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if resp.status_code != 200:
                raise HTTPException(502, f"Google Photos API error ({resp.status_code})")
            data = resp.json()
            items = data.get("pickedMediaItems", data.get("mediaItems", []))
            images = [
                item for item in items
                if item.get("type", item.get("mimeType", "")).startswith("image")
                or "mediaFile" in item
            ]
            return images
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list Google Photos media items")
            raise HTTPException(502, f"Google Photos API error: {exc}") from exc

    def download_photo(self, base_url: str, access_token: str) -> bytes:
        try:
            with httpx.Client(timeout=30, follow_redirects=True) as client:
                resp = client.get(
                    base_url,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if resp.status_code != 200:
                raise HTTPException(502, f"Failed to download photo from Google Photos ({resp.status_code})")
            return resp.content
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to download Google Photos image")
            raise HTTPException(502, f"Failed to download photo: {exc}") from exc
