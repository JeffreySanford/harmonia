# Video Generation Service (Python)

Handles video synthesis, overlays, and vocal style integration.
Communicates with Redis for job status.

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
    return {"message": "Video Generation Service is running"}
```
