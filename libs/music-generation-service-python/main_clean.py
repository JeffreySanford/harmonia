"""
Music Generation Service (Python) - Clean Copy

This file is a cleaned, single-definition copy of the microservice app used for testing.
"""

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import redis
import json
import time
import os
import wave
import struct
import math
from typing import List

app = FastAPI()
MODEL_PROVIDER = os.environ.get('MODEL_PROVIDER', 'synth').lower()

# Basic Redis client used by tests & runtime
redis_client = redis.Redis(host='localhost', port=6379, db=0)


def publish_status(service: str, status: str, url: str | None = None):
    try:
        payload = {"service": service, "status": status}
        if url:
            payload["url"] = url
        redis_client.publish('status_updates', json.dumps(payload))
    except Exception:
        pass


def synthesize_wav(path: str, duration_seconds: int = 10, freqs: List[float] = [440.0, 660.0, 880.0, 660.0]):
    sample_rate = 44100
    amplitude = 16000
    num_samples = sample_rate * duration_seconds
    with wave.open(path, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for i in range(num_samples):
            t = i / float(sample_rate)
            freq = freqs[(i // (sample_rate * 1)) % len(freqs)]
            value = int(amplitude * math.sin(2 * math.pi * freq * t))
            wav_file.writeframes(struct.pack('<h', value))


def generate_with_meta(wav_path: str, lyrics: str, duration_seconds: int = 10):
    synthesize_wav(wav_path, duration_seconds, freqs=[523.25, 659.25, 783.99, 659.25])


def generate_with_google(wav_path: str, lyrics: str, duration_seconds: int = 10):
    synthesize_wav(wav_path, duration_seconds, freqs=[392.0, 523.25, 587.33, 783.99])


def generate_music_file(wav_path: str, lyrics: str, duration_seconds: int = 10):
    if MODEL_PROVIDER == 'meta':
        generate_with_meta(wav_path, lyrics, duration_seconds)
    elif MODEL_PROVIDER == 'google':
        generate_with_google(wav_path, lyrics, duration_seconds)
    else:
        synthesize_wav(wav_path, duration_seconds)


def process_music_request(message: str):
    try:
        data = json.loads(message)
        service = data.get('service', 'music')
        lyrics = data.get('lyrics', '')
    except Exception:
        return

    redis_client.set('music_status', 'requested')
    publish_status('music', 'requested')
    publish_status('music', 'processing:10')
    time.sleep(0.5)
    publish_status('music', 'processing:40')
    time.sleep(0.5)
    publish_status('music', 'processing:70')
    time.sleep(0.5)

    filename = f"funny_coding_song_{int(time.time())}.wav"
    assets_dir = os.path.join(os.getcwd(), 'assets', 'generated')
    os.makedirs(assets_dir, exist_ok=True)
    wav_path = os.path.join(assets_dir, filename)
    generate_music_file(wav_path, lyrics, duration_seconds=10)

    url = f"http://localhost:8001/assets/generated/{filename}"
    redis_client.set('music_status', 'complete')
    publish_status('music', 'complete', url)


def subscribe_to_music_requests():
    pubsub = redis_client.pubsub(ignore_subscribe_messages=True)
    pubsub.subscribe('music_request')
    for item in pubsub.listen():
        if item and item.get('type') == 'message' and item.get('data'):
            try:
                data = item['data']
                if isinstance(data, (bytes, bytearray)):
                    data = data.decode('utf-8')
                process_music_request(data)
            except Exception:
                pass


@app.on_event('startup')
def start_subscriber_thread():
    import threading
    thread = threading.Thread(target=subscribe_to_music_requests, daemon=True)
    thread.start()


@app.get("/")
def read_root():
    return {"message": "Music Generation Service is running"}


@app.get('/simulate')
def simulate():
    redis_client.set('music_status', 'requested')
    publish_status('music', 'requested')
    time.sleep(1)
    redis_client.set('music_status', 'processing:40')
    publish_status('music', 'processing:40')
    time.sleep(1)
    redis_client.set('music_status', 'processing:70')
    publish_status('music', 'processing:70')
    time.sleep(1)
    assets_dir = os.path.join(os.getcwd(), 'assets', 'generated')
    os.makedirs(assets_dir, exist_ok=True)
    wav_path = os.path.join(assets_dir, 'funny-coding-song.wav')
    if not os.path.exists(wav_path):
        generate_music_file(wav_path, 'simulated lyrics', duration_seconds=10)
    publish_status('music', 'complete', f'http://localhost:8001/assets/generated/funny-coding-song.wav')
    redis_client.set('music_status', 'complete')
    return {"message": "Simulated progress"}


# Serve generated assets so UI can download
assets_path = os.path.join(os.getcwd(), 'assets')
os.makedirs(os.path.join(assets_path, 'generated'), exist_ok=True)
app.mount('/assets', StaticFiles(directory=assets_path), name='assets')
