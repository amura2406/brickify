import json
import asyncio
from fastapi.testclient import TestClient
from main import app
from auth import require_approved_user

client = TestClient(app)

app.dependency_overrides = {}
app.dependency_overrides[require_approved_user] = lambda: {"uid": "testuser", "email": "other@user.com"}

try:
    # 1. generate mosaic
    gen_payload = {
        "url": "https://placehold.co/100x100.png",
        "set_selections": [
            {
               "set_id": "31199",
               "qty": 1
            }
        ],
        "preprocessing": True,
        "color_mode": "realistic"
    }
    
    resp_gen = client.post("/api/generate", json=gen_payload)
    if resp_gen.status_code != 200:
        print("GENERATE FAILED", resp_gen.status_code, resp_gen.text)
        exit(1)
        
    mosaic_data = resp_gen.json()
    print("GENERATE SUCCESS, grid size:", len(mosaic_data["grid"]))
    
    # 2. save project
    payload = {
      "name": "Test Project 2",
      "image_url": "http://img",
      "cropped_image_url": "http://cropped",
      "mosaic_preview_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "set_selections": [],
      "config": {},
      "mosaic_data": mosaic_data,
      "mosaic_history": []
    }
    
    resp = client.post("/api/projects", json=payload)
    print("SAVE STATUS:", resp.status_code)
    print("SAVE BODY:", resp.text)
    
except Exception as e:
    import traceback
    traceback.print_exc()

    
    project_id = resp.json()["project_id"]
    payload["name"] = "Updated Name"
    resp_put = client.put(f"/api/projects/{project_id}", json=payload)
    print("PUT STATUS:", resp_put.status_code)
    print("PUT BODY:", resp_put.text)

