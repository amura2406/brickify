"""
Database Protocol and Implementations.

Follows the same Testability-First architectural pattern as StorageProvider:
abstracts Firestore vs local JSON behind interchangeable providers.

Firestore efficiency strategy (stay under free tier):
- Project data split into TWO documents per project:
    users/{uid}/project_summaries/{project_id}  — lightweight list doc (no grid)
    users/{uid}/project_details/{project_id}    — full mosaic data (grid + colors)
- list_projects() reads summaries only (≤20 reads per gallery open)
- get_project_detail() reads one detail doc on demand
- No realtime listeners; pure request/response
- Batch writes for save/update (2 writes per batch operation)
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocol / Interface
# ---------------------------------------------------------------------------

class DatabaseProvider(Protocol):
    """Abstract interface for project persistence."""

    def save_project(self, uid: str, project: dict[str, Any]) -> str:
        """Persist a new project. Returns the generated project_id.

        project must contain:
          - name: str
          - image_url: str
          - cropped_image_url: str
          - mosaic_preview_url: str
          - set_selections: list[dict]  — [{set_id, qty}]
          - config: dict                — generation options
          - crop_state: dict | None     — crop transform state
          - mosaic_data: dict           — {width, height, colors, grid}
        """
        ...

    def list_projects(self, uid: str) -> list[dict[str, Any]]:
        """Return lightweight summaries for a user's projects (no grid data).

        Sorted by updated_at descending. Maximum 20 items returned.
        Each item contains: id, name, created_at, updated_at,
        thumbnail_url, image_url, cropped_image_url, set_names,
        stud_count, color_count.
        """
        ...

    def get_project_detail(self, uid: str, project_id: str) -> dict[str, Any] | None:
        """Return full project data including grid. None if not found."""
        ...

    def update_project(self, uid: str, project_id: str, project: dict[str, Any]) -> bool:
        """Update an existing project. Returns True if found and updated."""
        ...

    def delete_project(self, uid: str, project_id: str) -> bool:
        """Delete a project's summary and detail docs. Returns True if deleted."""
        ...

    def count_projects(self, uid: str) -> int:
        """Return the number of saved projects for a user (efficient count)."""
        ...

    def get_all_referenced_urls(self) -> set[str]:
        """Return ALL image URLs referenced by ANY user's saved project.

        Used by admin purge to build the exclusion set before deleting storage.
        Admin-only operation — reads across all users.
        """
        ...


# ---------------------------------------------------------------------------
# Firestore Implementation
# ---------------------------------------------------------------------------

class FirestoreDatabaseProvider:
    """Production implementation using Firebase Admin SDK Firestore.

    Collection layout:
        users/{uid}/project_summaries/{project_id}
        users/{uid}/project_details/{project_id}

    The Admin SDK bypasses Firestore Security Rules, so all access control
    is enforced at the FastAPI layer via require_approved_user.
    """

    def __init__(self) -> None:
        # Lazy import — firebase_admin is only available in production env
        from firebase_admin import firestore as _firestore
        self._db = _firestore.client()

    def _summaries_col(self, uid: str):
        return self._db.collection("users").document(uid).collection("project_summaries")

    def _details_col(self, uid: str):
        return self._db.collection("users").document(uid).collection("project_details")

    def _build_summary(self, project_id: str, project: dict[str, Any], now: str) -> dict[str, Any]:
        """Extract lightweight summary fields from a full project dict."""
        set_names = [s.get("set_name", s.get("set_id", "")) for s in project.get("set_selections", [])]
        mosaic_data = project.get("mosaic_data", {})
        colors = mosaic_data.get("colors", [])
        used_colors = [c for c in colors if c.get("used", 0) > 0]
        stud_count = mosaic_data.get("width", 0) * mosaic_data.get("height", 0)

        return {
            "id": project_id,
            "name": project.get("name", "Untitled"),
            "created_at": project.get("created_at", now),
            "updated_at": now,
            "thumbnail_url": project.get("mosaic_preview_url", ""),
            "image_url": project.get("image_url", ""),
            "cropped_image_url": project.get("cropped_image_url", ""),
            "set_names": set_names,
            "stud_count": stud_count,
            "color_count": len(used_colors),
        }

    def _build_detail(self, project: dict[str, Any], now: str) -> dict[str, Any]:
        """Extract full detail fields from a full project dict.

        mosaic_data is stored as a JSON string to avoid Firestore's 20-level
        nested entity depth limit (the grid is a 2D array inside a dict).
        """
        return {
            "updated_at": now,
            "set_selections": project.get("set_selections", []),
            "config": project.get("config", {}),
            "crop_state": project.get("crop_state"),
            "mosaic_data_json": json.dumps(project.get("mosaic_data", {})),
            "mosaic_history": project.get("mosaic_history", []),
        }


    def save_project(self, uid: str, project: dict[str, Any]) -> str:
        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        summary = self._build_summary(project_id, project, now)
        detail = self._build_detail(project, now)

        # Batch write: 2 writes in one round-trip
        batch = self._db.batch()
        batch.set(self._summaries_col(uid).document(project_id), summary)
        batch.set(self._details_col(uid).document(project_id), detail)
        batch.commit()

        logger.info("Saved project %s for user %s", project_id, uid)
        return project_id

    def list_projects(self, uid: str) -> list[dict[str, Any]]:
        # Reads summary docs only — lightweight, no grid data
        docs = (
            self._summaries_col(uid)
            .order_by("updated_at", direction="DESCENDING")
            .limit(20)
            .get()
        )
        return [doc.to_dict() for doc in docs]

    def get_project_detail(self, uid: str, project_id: str) -> dict[str, Any] | None:
        summary_doc = self._summaries_col(uid).document(project_id).get()
        detail_doc = self._details_col(uid).document(project_id).get()

        if not summary_doc.exists or not detail_doc.exists:
            return None

        # Merge summary + detail for the full object
        result = summary_doc.to_dict() or {}
        detail = detail_doc.to_dict() or {}

        # Deserialize mosaic_data from its JSON string representation
        mosaic_json = detail.pop("mosaic_data_json", None)
        if mosaic_json:
            detail["mosaic_data"] = json.loads(mosaic_json)

        result.update(detail)
        return result

    def update_project(self, uid: str, project_id: str, project: dict[str, Any]) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        summary = self._build_summary(project_id, project, now)
        detail = self._build_detail(project, now)

        # Keep original created_at from existing summary
        existing = self._summaries_col(uid).document(project_id).get()
        if not existing.exists:
            return False
        existing_data = existing.to_dict() or {}
        summary["created_at"] = existing_data.get("created_at", now)

        batch = self._db.batch()
        batch.set(self._summaries_col(uid).document(project_id), summary)
        batch.set(self._details_col(uid).document(project_id), detail)
        batch.commit()

        logger.info("Updated project %s for user %s", project_id, uid)
        return True

    def delete_project(self, uid: str, project_id: str) -> bool:
        summary_ref = self._summaries_col(uid).document(project_id)
        detail_ref = self._details_col(uid).document(project_id)

        if not summary_ref.get().exists:
            return False

        batch = self._db.batch()
        batch.delete(summary_ref)
        batch.delete(detail_ref)
        batch.commit()

        logger.info("Deleted project %s for user %s", project_id, uid)
        return True

    def count_projects(self, uid: str) -> int:
        # Use count aggregation query — 1 read regardless of document count
        from google.cloud.firestore_v1.aggregation import AggregationQuery
        agg = AggregationQuery(self._summaries_col(uid))
        agg = agg.count(alias="total")
        results = agg.get()
        if results and results[0]:
            for r in results[0]:
                if r.alias == "total":
                    return int(r.value)
        return 0

    def get_all_referenced_urls(self) -> set[str]:
        """Collect all image URLs from all users' project summaries.

        This is an admin-only, infrequent operation (called only before a purge).
        Reads summary docs only (no detail docs needed — URLs are in summaries).
        """
        urls: set[str] = set()
        # List all user documents
        users_ref = self._db.collection("users")
        for user_doc in users_ref.list_documents():
            summaries = user_doc.collection("project_summaries").get()
            for doc in summaries:
                data = doc.to_dict() or {}
                for key in ("image_url", "cropped_image_url", "thumbnail_url"):
                    url = data.get(key, "")
                    if url:
                        urls.add(url)
        return urls


# ---------------------------------------------------------------------------
# Local JSON Implementation
# ---------------------------------------------------------------------------

class LocalDatabaseProvider:
    """Local development implementation: saves to JSON files under local_data/.

    Directory layout:
        backend/local_data/{uid}/project_summaries.json
        backend/local_data/{uid}/project_details/{project_id}.json

    gitignored via backend/local_data/ entry in .gitignore.
    """

    def __init__(self, base_dir: str | None = None) -> None:
        if base_dir is None:
            base_dir = str(Path(__file__).parent / "local_data")
        self._base = Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)

    def _user_dir(self, uid: str) -> Path:
        d = self._base / uid
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _summaries_path(self, uid: str) -> Path:
        return self._user_dir(uid) / "project_summaries.json"

    def _detail_path(self, uid: str, project_id: str) -> Path:
        d = self._user_dir(uid) / "project_details"
        d.mkdir(exist_ok=True)
        return d / f"{project_id}.json"

    def _read_summaries(self, uid: str) -> dict[str, Any]:
        p = self._summaries_path(uid)
        if not p.exists():
            return {}
        with open(p) as f:
            return json.load(f)

    def _write_summaries(self, uid: str, data: dict[str, Any]) -> None:
        with open(self._summaries_path(uid), "w") as f:
            json.dump(data, f, indent=2)

    def _build_summary(self, project_id: str, project: dict[str, Any], now: str) -> dict[str, Any]:
        set_names = [s.get("set_name", s.get("set_id", "")) for s in project.get("set_selections", [])]
        mosaic_data = project.get("mosaic_data", {})
        colors = mosaic_data.get("colors", [])
        used_colors = [c for c in colors if c.get("used", 0) > 0]
        stud_count = mosaic_data.get("width", 0) * mosaic_data.get("height", 0)
        return {
            "id": project_id,
            "name": project.get("name", "Untitled"),
            "created_at": project.get("created_at", now),
            "updated_at": now,
            "thumbnail_url": project.get("mosaic_preview_url", ""),
            "image_url": project.get("image_url", ""),
            "cropped_image_url": project.get("cropped_image_url", ""),
            "set_names": set_names,
            "stud_count": stud_count,
            "color_count": len(used_colors),
        }

    def save_project(self, uid: str, project: dict[str, Any]) -> str:
        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        summaries = self._read_summaries(uid)
        summaries[project_id] = self._build_summary(project_id, project, now)
        self._write_summaries(uid, summaries)

        detail = {
            "updated_at": now,
            "set_selections": project.get("set_selections", []),
            "config": project.get("config", {}),
            "crop_state": project.get("crop_state"),
            "mosaic_data": project.get("mosaic_data", {}),
            "mosaic_history": project.get("mosaic_history", []),
        }
        with open(self._detail_path(uid, project_id), "w") as f:
            json.dump(detail, f, indent=2)

        logger.info("[local] Saved project %s for user %s", project_id, uid)
        return project_id

    def list_projects(self, uid: str) -> list[dict[str, Any]]:
        summaries = self._read_summaries(uid)
        items = list(summaries.values())
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return items[:20]

    def get_project_detail(self, uid: str, project_id: str) -> dict[str, Any] | None:
        summaries = self._read_summaries(uid)
        summary = summaries.get(project_id)
        if not summary:
            return None

        detail_path = self._detail_path(uid, project_id)
        if not detail_path.exists():
            return None

        with open(detail_path) as f:
            detail = json.load(f)

        result = dict(summary)
        result.update(detail)
        return result

    def update_project(self, uid: str, project_id: str, project: dict[str, Any]) -> bool:
        summaries = self._read_summaries(uid)
        if project_id not in summaries:
            return False

        now = datetime.now(timezone.utc).isoformat()
        original_created = summaries[project_id].get("created_at", now)
        summaries[project_id] = self._build_summary(project_id, project, now)
        summaries[project_id]["created_at"] = original_created
        self._write_summaries(uid, summaries)

        detail = {
            "updated_at": now,
            "set_selections": project.get("set_selections", []),
            "config": project.get("config", {}),
            "crop_state": project.get("crop_state"),
            "mosaic_data": project.get("mosaic_data", {}),
            "mosaic_history": project.get("mosaic_history", []),
        }
        with open(self._detail_path(uid, project_id), "w") as f:
            json.dump(detail, f, indent=2)

        logger.info("[local] Updated project %s for user %s", project_id, uid)
        return True

    def delete_project(self, uid: str, project_id: str) -> bool:
        summaries = self._read_summaries(uid)
        if project_id not in summaries:
            return False

        del summaries[project_id]
        self._write_summaries(uid, summaries)

        detail_path = self._detail_path(uid, project_id)
        if detail_path.exists():
            detail_path.unlink()

        logger.info("[local] Deleted project %s for user %s", project_id, uid)
        return True

    def count_projects(self, uid: str) -> int:
        return len(self._read_summaries(uid))

    def get_all_referenced_urls(self) -> set[str]:
        urls: set[str] = set()
        if not self._base.exists():
            return urls
        for user_dir in self._base.iterdir():
            if not user_dir.is_dir():
                continue
            summaries_path = user_dir / "project_summaries.json"
            if not summaries_path.exists():
                continue
            with open(summaries_path) as f:
                summaries = json.load(f)
            for data in summaries.values():
                for key in ("image_url", "cropped_image_url", "thumbnail_url"):
                    url = data.get(key, "")
                    if url:
                        urls.add(url)
        return urls


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_database_provider() -> DatabaseProvider:
    """FastAPI Dependency: return the appropriate database provider."""
    if os.environ.get("ENV", "development") != "production":
        return LocalDatabaseProvider()
    return FirestoreDatabaseProvider()
