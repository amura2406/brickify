import os
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["config"])

@router.get("/firebase-config")
def get_firebase_config():
    """Return the Firebase frontend configuration loaded from environment variables."""
    return {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": f"{os.getenv('FIREBASE_PROJECT_ID')}.firebaseapp.com",
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": f"{os.getenv('FIREBASE_PROJECT_ID')}.appspot.com",
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    }
