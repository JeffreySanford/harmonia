# Release Notes

v0.1.0 — Initial content

- Added automated download tooling to fetch official MusicGen model repos
  and curated datasets into `models/` and `datasets/` (dry-run by default).
- Added `.env` support for `HUGGINGFACE_HUB_TOKEN` and updated scripts to
  source the token in a safe, local-only way.
- Performed a one-time full download: models (~100GB) and datasets (~1.2GB)
  and generated `models/inventory.json` and `datasets/inventory.json`.
- Added verification tooling: `tests/env_tests/smoke_check.py` to compute and
  report checksums without modifying artifacts.
- Added conservative local inference example: `scripts/generate_with_musicgen.py`.
- Added `requirements.txt`, documentation updates, and example notebooks.

Notes
- Model artifacts are large and intentionally not tracked in Git. Inventories
  and verification artifacts are committed to help collaborators reproduce
  the environment without shipping large binaries.
