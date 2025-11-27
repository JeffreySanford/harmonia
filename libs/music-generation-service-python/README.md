Music Generation Service (Python)
--------------------------------

This microservice provides a very small local music generation simulation and serves static generated WAV files.

Configuration
- MODEL_PROVIDER: set to `meta`, `google`, or `synth` (default). The service currently contains stubs to simulate different providers. To use local model backends, implement `generate_with_meta` or `generate_with_google`.

Dev Quickstart
- Start Redis via docker compose: `pnpm run start:docker`
- Start API: `pnpm nx serve api` (defaults to port 3000)
- Start frontend: `pnpm nx serve frontend` (defaults to port 4200)
- Start music microservice locally: `cd libs/music-generation-service-python && uvicorn main:app --reload --port 8001`

Run tests
- Install python deps: `pip install -r requirements.txt`
- Run tests: `python -m pytest -q test_music.py` (requires httpx - installed via requirements)
