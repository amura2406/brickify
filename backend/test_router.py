import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_list_sets():
    response = client.get("/api/sets")
    assert response.status_code == 200
    data = response.json()
    assert "sets" in data
    # Check if colors are included in the details
    assert len(data["sets"]) > 0
    assert "colors" in data["sets"][0]
