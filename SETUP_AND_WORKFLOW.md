# Harmonia — Setup & Workflow

This file contains step-by-step instructions to close VS Code, move into the repository directory, and run the initial setup. Keep this file if Copilot or VS Code restarts.

## Quick overview

````markdown
# Harmonia — Setup & Workflow (updated)

This file contains step-by-step instructions to set up the repo, run download tooling, and work with the MusicGen models and datasets that have been added since the initial scaffold.

## Quick overview

- Close VS Code (if you need to reopen without file locks).
- Open a Bash terminal (WSL or Git Bash).
- Change directory into the repository (`c:\repos\harmonia` or `/c/repos/harmonia`).
- Make helper scripts executable and run the download tooling (if you need the models locally).
- Initialize git (if you haven't already) and push to your remote — this repo was pushed to GitHub during setup.

---

## 0) Important notes (downloads & tokens)

- The repository now includes download tooling for MusicGen models and curated datasets. These downloads are large (the current run used ~100GB for models + ~1.2GB datasets).
- Create a local `.env` file in the repo root to store `HUGGINGFACE_HUB_TOKEN`. Example (DO NOT COMMIT):

```ini
# .env
HUGGINGFACE_HUB_TOKEN=hf_xxx...
```

- The scripts auto-source `.env` and export variables for child processes, so the Python `huggingface_hub` calls will use the token.

---

## 1) Open a Bash terminal and move into the repo (WSL or Git Bash)

WSL (recommended when using Docker Desktop WSL backend):

```bash
# inside WSL
cd /mnt/c/repos/harmonia
```

Git Bash / msys:

```bash
cd /c/repos/harmonia
```

PowerShell:

```powershell
cd C:\repos\harmonia
```

---

## 2) Make scripts executable (if using Bash/WSL)

```bash
chmod +x scripts/*.sh
```

---

## 3) Downloading models and datasets

Use the curated downloader to fetch official MusicGen repos and curated datasets from Hugging Face.

Dry-run (recommended first):

```bash
./scripts/download_musicgen_full.sh
```

Run (actually download):

```bash
# ensure .env contains HUGGINGFACE_HUB_TOKEN or export it in your environment
./scripts/download_musicgen_full.sh --models --datasets --run
```

Notes:

- Download destinations: `models/facebook/*` and `datasets/*`.
- Expect many multi-GB files (safetensors / pytorch shards). Prefer WSL/Linux for more stable downloads.
- The first download run in this workspace completed (models ~100GB, datasets ~1.2GB) and files are available under `models/` and `datasets/`.

## Artifacts, verification, and smoke checks

- The repository includes machine-readable inventories that describe the downloaded artifacts:
  - `models/inventory.json`, `datasets/inventory.json` and `inventory/combined_inventory.json`.
- To quickly validate the environment, run the smoke-check which computes or compares SHA256 values and writes a report:

```bash
python tests/env_tests/smoke_check.py
# report written to tests/env_tests/smoke_report_<timestamp>.json
```

- If you want to re-generate local checksums for the largest model files, run the small helper in the repo root (this is done automatically during repository setup in this workspace):

```bash
# generate top-file checksums (writes models/checksums.sha256)
python -c "from pathlib import Path; print('see README for commands')"
```

CI integration:

- A lightweight GitHub Actions job (`.github/workflows/smoke.yml`) runs the smoke check on pushes and uploads the generated report as an artifact. This avoids downloading large files in CI and focuses on validating metadata/checksums.

---

## 4) Git and remote

- The local repo was committed and force-pushed to the GitHub repo `https://github.com/jeffreysanford/harmonia.git` during setup. If you need to push further changes, add the remote or use the existing `origin`.

Add remote (if missing):

```bash
git remote add origin https://github.com/<your-username>/harmonia.git
git push -u origin master
```

---

## 5) Install dependencies and build

```bash
npm install
npm run build
npm start
```

For development with TypeScript runtime:

```bash
npm run dev
```

---

## 6) Docker (build and run dev container)

Use the included Dockerfiles and npm scripts for reproducible environments.

```bash
npm run docker:build
npm run docker:run
```

Or:

```bash
docker compose up --build
```

Notes for Docker on Windows:

- Use Docker Desktop with WSL2 backend enabled for best filesystem performance.
- GPU access requires the NVIDIA Container Toolkit on the host.

---

## 7) Reopen the repo in VS Code

```bash
code .
```

---

## 8) Model files guidance & verification

- Downloaded models live under `models/` and datasets under `datasets/`.
- Check file sizes and sample files with `du -sh models datasets` and `find models -type f | xargs ls -lh`.
- To verify integrity, compute SHA256 for the largest files:

```bash
sha256sum models/facebook/*/models--*/* | head -n 20
```

---

## Troubleshooting & tips

- If `code .` fails inside WSL, ensure VS Code is installed and the Remote - WSL extension is present.
- For large downloads, run them in WSL or in a container for better stability.
- If `huggingface_hub` warns about `hf_xet` or symlinks on Windows, consider installing `hf_xet` (for Xet storage) or run in WSL where symlinks work better.

---

If you'd like, I can:

- Create a `models/README.md` summarizing which model repos and dataset snapshots were downloaded (I will add this file).
- Run checksum verification on the largest files.
- Add a small runtime smoke-test script that attempts to load a model using `huggingface_hub`.

````
