"""
Vocal Styles Service (Python)

Microservice for advanced vocal processing (TTS, style transfer).
"""

# Quickstart
# - Install dependencies: pip install fastapi uvicorn redis
# - Run: uvicorn main:app --reload

# main.py
from fastapi import FastAPI
import redis

app = FastAPI()
redis_client = redis.Redis(host='localhost', port=6379, db=0)

@app.get("/")
def read_root():
    return {"message": "Vocal Styles Service is running"}

@app.get("/status")
def get_status():
    status = redis_client.get('vocal_status')
    return {"vocal_status": status.decode() if status else "unknown"}

