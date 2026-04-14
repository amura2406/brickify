import base64
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, raise_server_exceptions=True)

# Generate an 800KB base64 string
big_str = "data:image/jpeg;base64," + ("A" * 1200000)

payload = {
    "name": "Big Project",
    "image_url": big_str,
    "cropped_image_url": big_str,
    "mosaic_preview_url": "data:image/png;base64,iVBORw0K", # fake tiny preview
    "set_selections": [
        {
            "set_id": "31199",
            "qty": 1
        }
    ],
    "preprocessing": True,
    "config": {"color_mode": "realistic"},
    "mosaic_data": {
        "width": 10, "height": 10, "colors": [], "grid": []
    }
}

try:
    resp = client.post("/api/projects", json=payload)
    print("STATUS:", resp.status_code)
except Exception as e:
    print("EXCEPTION:", repr(e))

