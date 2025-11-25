# Music Generation Service (Python)

FastAPI app for LLM chat, parameter extraction, and music generation (MusicGen, Suno, Udio).
Integrates with Ollama for LLM and Redis for session/job management.

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
    return {"message": "Music Generation Service is running"}
```
