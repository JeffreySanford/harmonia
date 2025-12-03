# Docker / WSL2 Guide for Harmonia (Local GPU & Dev Setup)

This guide explains recommended Docker and WSL2 strategies for developing and running Harmonia locally on limited-GPU developer machines (e.g., i9 with 10GB GPU VRAM).

Principles

- Keep images small: do not bake multi-GB model files into images. Use manifests and mount model folders at runtime.
- Use volume mounts for `models/`, `datasets/`, and `artifacts/` to avoid copying large files into containers.
- Provide a small `dev` image for local experimentation with CPU-only fallbacks and a separate `gpu` image using NVIDIA runtime.

WSL2 notes (Windows)

- Install WSL2 and a Linux distribution (Ubuntu recommended). Make sure Docker Desktop is configured to use WSL2.
- Install NVIDIA Container Toolkit and ensure WSL2 exposes the GPU (NVIDIA drivers + WSL GPU support required).

Docker image recommendations

- Base images
  - `python:3.11-slim` for worker images.
  - `node:20-slim` for backend/frontend build containers.
- Worker image layers
  - Layer 1: OS + Python + pip
  - Layer 2: minimal runtime packages (numpy, soundfile, torchaudio) installed with `--no-cache-dir`
  - Layer 3: optional ML packages (torch, audiocraft) installed via one-step install to reduce layer count

Example `docker-compose.yml` pattern (concept)

```yaml
version: '3.8'
services:
  worker:
    image: harmonia/worker:dev
    runtime: nvidia
    environment:
      - HUGGINGFACE_HUB_TOKEN=${HUGGINGFACE_HUB_TOKEN}
    volumes:
      - ./models:/workspace/models:ro
      - ./artifacts:/workspace/artifacts
    deploy:
      resources:
        limits:
          memory: 32G
```

Mounting large models

- Mount local `models/` into containers as read-only to ensure integrity.
- Use an env var `HARMONIA_MODELS_ROOT` so services can locate models independent of container layout.

Caching & dev ergonomics

- Use host-level caches for package installs and pip wheels to speed repeated builds.
- For development, provide ephemeral `dev` compose profiles that expose ports and mount source code into containers.

GPU tips for low-VRAM devices

- Use smaller model variants (8-bit/4-bit quantized) for local runs.
- Split pipeline work: run heavy model encoding on a separate machine or cloud instance when necessary.

Security

- Do not place secrets in images. Use `.env` and GitHub Secrets for CI.

Next actionable items

- Add `Dockerfile.worker` and `docker-compose.dev.yml` examples in the repo.
- Provide a small `entrypoint.sh` that validates mounts and checks `models/inventory.json` before startup.

---
End of Docker/WSL2 guide.
