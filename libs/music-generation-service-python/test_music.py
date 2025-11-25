import requests

def test_root():
    response = requests.get("http://localhost:8001/")
    assert response.status_code == 200
    assert response.json()["message"] == "Music Generation Service is running"
