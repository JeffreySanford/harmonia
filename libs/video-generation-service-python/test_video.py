import requests

def test_root():
    response = requests.get("http://localhost:8002/")
    assert response.status_code == 200
    assert response.json()["message"] == "Video Generation Service is running"
