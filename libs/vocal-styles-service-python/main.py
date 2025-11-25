# Vocal Styles Service (Python)

Microservice for advanced vocal processing (TTS, style transfer).

## Quickstart
- Install dependencies: `pip install fastapi uvicorn redis`
- Run: `uvicorn main:app --reload`

## main.py
```python
from fastapi import FastAPI
import redis

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Vocal Styles Service is running"}
```
