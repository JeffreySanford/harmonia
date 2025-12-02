# Harmonia Architecture Overview

This document describes the high-level architecture and design goals for the Harmonia project: a local, reproducible multi-modal generation platform focused initially on music, with planned support for vocals, sampling, and video generation.

Goals
- Reproducible local development for model experimentation and iteration.
- Auditable artifact management (inventories, checksums, manifests) to enable CI verification without repeated large downloads.
- Modular services for each generation domain (music, vocal, sampling, video) that can be composed into pipelines.
- Enterprise-grade frontend (Angular + Material 3 + NGRX) and backend (NestJS) with strict coding standards and traceable change control.

Core components
- Models & Datasets: stored under `models/` and `datasets/`. Each snapshot includes an `inventory.json` and checksums where appropriate.
- Downloader & CLI: `scripts/` contains authenticated snapshot downloaders (Hugging Face) that respect `HUGGINGFACE_HUB_TOKEN` via `.env`.
- Generation Libraries: language-specific Python services (or Node wrappers) that load local models and expose a small CLI for inference/export.
- Containerization: Docker images for reproducible runtime environments, with `docker-compose` examples for multi-service orchestration.
- Backend: NestJS service to orchestrate generation jobs, manage manifests, and connect to storage or LLMs.
- Frontend: Angular app (Material 3 + NGRX) to collect user intents, transform them into LLM prompts, and coordinate generation tasks via backend APIs.

Data flow (simple scenario)
1. User submits an idea in the frontend (text / settings).
2. NGRX reducers and effects pre-process input into canonical prompts and generation parameters.
3. Frontend calls NestJS backend to start a job (job definitions map to library scripts).
4. Backend schedules job; a worker container or process loads the local model, runs inference, and writes results to `artifacts/` or an object store.
5. Backend returns job status and artifact links; frontend fetches and plays media.

Design trade-offs and constraints
- Local-first: avoids HF re-downloads for each run by using manifests and artifact storage. CI will validate manifests and checksums rather than re-downloading models.
- Storage & compute limits: expect heavy models to be hosted externally (S3/GCS) or stored locally on developer machines; prefer quantized / pruned variants for local testing.
- Security & compliance: tokens live in `.env` (gitignored) and CI uses repository secrets.

Next steps
- Finalize the manifest schema and versioning strategy.
- Create lightweight Docker images for worker processes and a minimal production-like Compose file.
- Implement CI smoke checks to validate manifests and run deterministic small-sample inferences.

Reference paths
- `models/`, `datasets/`, `scripts/`, `tests/env_tests/`, `.github/workflows/smoke.yml`

Questions to resolve
- Artifact hosting strategy (S3 vs GitHub Releases) and retention policy.
- Which model variants are considered canonical for CI verification (largest, medium, small)?

---
End of architecture overview.
