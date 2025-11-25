import requests

def test_root():
    response = requests.get("http://localhost:8003/")
    assert response.status_code == 200
    assert response.json()["message"] == "Vocal Styles Service is running"
