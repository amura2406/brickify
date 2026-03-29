"""
Firebase Auth middleware for FastAPI.

Verifies Firebase ID tokens (JWTs) on protected endpoints.
Checks the `approved` custom claim for user activation.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Header, HTTPException, status

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firebase Admin SDK initialisation (idempotent)
# ---------------------------------------------------------------------------

def _init_firebase() -> None:
    """Initialise the Firebase Admin SDK once per process."""
    if os.environ.get("ENV", "development") != "production":
        logger.info("ENVIRONMENT=development detected. Skipping Firebase Admin SDK init.")
        return

    if firebase_admin._apps:
        return  # Already initialised

    # In Cloud Run, GOOGLE_APPLICATION_CREDENTIALS is set automatically via
    # the service account attached to the revision.
    # Locally, set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON.
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        # Falls back to Application Default Credentials (works on Cloud Run)
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", "brickify999"),
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "brickify999.firebasestorage.app"),
    })
    logger.info("Firebase Admin SDK initialised")


_init_firebase()

# ---------------------------------------------------------------------------
# Admin e-mails / UIDs (loaded once from env)
# ---------------------------------------------------------------------------

_ADMIN_EMAILS: frozenset[str] = frozenset(
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "amuhr4@gmail.com").split(",")
    if e.strip()
)


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def _decode_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded payload."""
    try:
        decoded = firebase_auth.verify_id_token(id_token, check_revoked=True)
        return decoded
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed.",
        ) from exc


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """FastAPI dependency: verify Bearer token, return decoded token dict.

    Usage::

        @app.get("/api/protected")
        def endpoint(user: dict = Depends(get_current_user)):
            ...
    """
    if os.environ.get("ENV", "development") != "production":
        logger.info("Local mode auth bypass triggered.")
        return {"uid": "local-dev-user", "email": list(_ADMIN_EMAILS)[0] if _ADMIN_EMAILS else "admin@local.test", "approved": True}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    return _decode_token(token)


def require_approved_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """FastAPI dependency: verify token AND check the `approved` custom claim.

    Admins are always approved. Other users need `approved: true` in their
    custom claims (set via the /api/admin/approve-user endpoint).

    Usage::

        @app.post("/api/generate")
        def endpoint(user: dict = Depends(require_approved_user)):
            ...
    """
    user = get_current_user(authorization)

    # Admins bypass approval check
    if user.get("email", "").lower() in _ADMIN_EMAILS:
        user["is_admin"] = True
        return user

    # Check custom claim
    if not user.get("approved", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PENDING_APPROVAL",
                "message": "Your account is pending admin approval. Please check back soon.",
            },
        )

    user["is_admin"] = False
    return user


def require_admin(authorization: Optional[str] = Header(default=None)) -> dict:
    """FastAPI dependency: require the caller to be an admin."""
    user = get_current_user(authorization)
    if user.get("email", "").lower() not in _ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    user["is_admin"] = True
    return user
