import pytest
pytest.importorskip('httpx')
from fastapi.testclient import TestClient
from main import app
import os
import time

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Music Generation Service is running"


def test_simulate_generates_wav(tmp_path):
    # Ensure we can call simulate and it produces a WAV file in assets/generated
    assets_dir = os.path.join(os.getcwd(), 'assets', 'generated')
    # Remove any existing test files
    if os.path.exists(assets_dir):
        # create a marker timestamp
        pass
    response = client.get('/simulate')
    assert response.status_code == 200
    # Wait a short moment for simulate to create file
    time.sleep(0.1)
    # Find any wav files in the assets generated directory
    if os.path.exists(assets_dir):
        wavs = [f for f in os.listdir(assets_dir) if f.endswith('.wav')]
        assert len(wavs) > 0
    else:
        # If assets dir not present, that's a failure
        raise AssertionError('assets/generated not created')
