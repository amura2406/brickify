import json
import logging
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from main import app
from database import LocalDatabaseProvider
import uuid

client = TestClient(app)

payload = {
  "name": "Test Project",
  "image_url": "http://img",
  "cropped_image_url": "http://cropped",
  "mosaic_preview_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "set_selections": [],
  "config": {},
  "mosaic_data": {
    "width": 1,
    "height": 1,
    "colors": [],
    "grid": [[0]]
  }
}

app.dependency_overrides = {}
from auth import require_approved_user
app.dependency_overrides[require_approved_user] = lambda: {"uid": "testuser", "email": "other@user.com"}

try:
    resp = client.post("/api/projects", json=payload)
    print("STATUS:", resp.status_code)
    print("BODY:", resp.text)
except Exception as e:
    import traceback
    traceback.print_exc()
