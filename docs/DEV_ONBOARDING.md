# Developer Onboarding & Local Runbook

This document helps a new developer (or you) get the Harmonia repo up and running on a local workstation (Windows + WSL2 recommended). It assumes basic familiarity with Docker, Python, Node, and Git.

Prerequisites
- Windows 10/11 with WSL2 (Ubuntu recommended).
- Docker Desktop with WSL2 integration and NVIDIA Container Toolkit (for GPU).
- Python 3.11
- Node 20+ and npm/yarn
- Git

Initial setup (quick)
1. Clone the repo:
```
git clone <repo-url> harmonia
cd harmonia
```
2. Create `.env` with your Hugging Face token:
```
HUGGINGFACE_HUB_TOKEN=pk_...  # DO NOT COMMIT
```
3. (Optional) Create a Python virtualenv and install minimal deps:
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Running the smoke check locally
```
python tests/env_tests/smoke_check.py
```
This writes `tests/env_tests/smoke_report_*.json` and prints a concise summary.

Working with models
- Place model snapshots under `models/` (the downloader script can do this).
- Keep `models/inventory.json` and `models/checksums.sha256` updated when adding new files.

Using Docker (dev pattern)
- Build worker image (example):
```
docker build -f Dockerfile.worker -t harmonia/worker:dev .
```
- Run with mounts:
```
docker run --gpus all -v ${PWD}/models:/workspace/models:ro -e HUGGINGFACE_HUB_TOKEN harmonia/worker:dev
```

Testing & development workflow
- Small changes: run unit tests and linters locally before committing.
- Big changes: open a PR with tests and updated manifests; run CI smoke checks on PR.

Performance tips (local)
- Use quantized/smaller model variants for iteration.
- Limit sample durations for quick feedback (e.g., 5–10s previews).

Contacts and escalation
- If smoke checks fail in CI: attach the smoke report from artifacts and open an issue with `models/*` paths.

---
End of developer onboarding guide.
