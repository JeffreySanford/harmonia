# Harmonia

A minimal scaffold for the `harmonia` repository.

## What’s included

- `package.json` with basic scripts (`build`, `start`, `dev`, `test`).
- TypeScript configuration (`tsconfig.json`).
- A minimal `src/index.ts` exporting `greet()`.
- `.gitignore` and `LICENSE` (MIT).
- A GitHub Actions CI workflow for building the project.

## Quick start

Run these commands locally to initialize and install:

```bash
cd c:/repos/harmonia
git init
npm install
npm run build
npm start
```

For development with live TypeScript execution:

```bash
npm run dev
```

## Next steps

- Add project description, author, and dependencies as needed.
- Add tests and linting configuration if desired.

## Docker usage (recommended for reproducible environment)

This project includes a `Dockerfile` and `docker-compose.yml` to create a reproducible Debian/Ubuntu-based environment on Windows (WSL2 recommended).

````markdown
# Harmonia

**AI-powered music generation platform built on Meta's MusicGen, with enterprise-grade data management, persistent storage, and reproducible workflows.**

---

## Quick Start

**New to Harmonia? Start here:**

1. **Set up MongoDB on i9:** [QUICKSTART_MONGODB.md](docs/QUICKSTART_MONGODB.md) (~10 minutes)
2. **Install dependencies:** `pnpm install`
3. **Run tests:** `pnpm test:mongo`
4. **Review Phase 0 checklist:** [PHASE_0_CHECKLIST.md](docs/PHASE_0_CHECKLIST.md)

---

## What's Included

### Infrastructure
- 🐳 Docker-based MongoDB with Mongo Express UI
- 📦 PNPM workspace with security-first package management
- 🔐 Secure authentication and firewall configuration
- 💾 Automated backup scripts

### Models & Data
- 🎵 MusicGen, EnCodec, and Demucs models (~100GB)
- 📊 Curated datasets (GTZAN, MusicCaps, etc.)
- ✅ SHA256 checksums and smoke-check validation
- 📋 Structured inventories (JSON manifests)

### Persistent Storage
- 🗄️ MongoDB 7.0 with Mongoose schemas
- 📝 TypeScript DTOs with validation
- 🔗 Strongly-typed collection relationships
- ⚡ Indexed queries and TTL expiration

### CI/CD
- ✅ Smoke checks (scheduled + PR-triggered)
- 📜 License validation (soft/strict modes)
- 🧪 Memory-server unit tests
- 🚀 Release workflows with strict checks

### Documentation
- 📘 [Architecture](docs/ARCHITECTURE.md)
- 🛡️ [Coding Standards](docs/CODING_STANDARDS.md) (file size limits, refactoring patterns)
- 🔒 [PNPM Benefits & Security](docs/PNPM.md)
- 🗄️ [MongoDB Setup](docs/I9_MONGODB_INSTALL.md)
- ⚖️ [Legal/License Audit](docs/LICENSING_CI.md)
- 💰 [Cost Planning](docs/RESOURCE_COST_PLANNING.md)
- 🧭 [Developer Onboarding](docs/DEV_ONBOARDING.md)

---

## Project Structure

```
harmonia/
├── docs/                          # Comprehensive documentation
│   ├── QUICKSTART_MONGODB.md      # 10-minute MongoDB setup
│   ├── PHASE_0_CHECKLIST.md       # Current phase progress
│   ├── I9_MONGODB_INSTALL.md      # Detailed i9 installation guide
│   ├── PNPM.md                    # Package manager benefits & security
│   └── ...                        # Architecture, standards, guides
├── src/
│   ├── models/                    # TypeScript Mongoose schemas
│   ├── models-js/                 # JavaScript models (for migration)
│   └── dto/                       # Data transfer objects with validation
├── scripts/
│   ├── download_model_*.sh        # Model downloader scripts
│   ├── migrate_inventory_to_db.js # Seed MongoDB from inventory
│   ├── backup-mongo.sh            # Automated backup script
│   ├── audit_file_sizes.py        # Enforce 500-line limit
│   └── mongo-init/                # Database initialization scripts
├── tests/
│   └── env_tests/
│       └── smoke_check.py         # Checksum validation
├── .github/workflows/             # CI/CD pipelines
├── docker-compose.mongo.yml       # MongoDB + Mongo Express
├── pnpm-workspace.yaml            # Workspace configuration
└── models/                        # Downloaded model artifacts (gitignored)
```

---

## Core Technologies

- **Runtime:** Node.js 18+ with pnpm 8
- **Languages:** TypeScript (strict mode), Python 3.11
- **Database:** MongoDB 7.0 with Mongoose ODM
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Testing:** Jest (TS), pytest (Python), mongodb-memory-server

---
- Scripts to download MusicGen models and curated datasets from Hugging Face (`scripts/download_musicgen_full.sh`, `scripts/download_model_facebook.sh`).

## Quick start

Run these commands locally to initialize and install:

```bash
cd c:/repos/harmonia
# (optional) initialize git if needed
# git init
npm install
npm run build
npm start
```

For development with live TypeScript execution:

```bash
npm run dev
```

## Model downloads and tooling

This repository now includes automated download tooling for MusicGen and related artifacts:

- `scripts/download_musicgen_full.sh` — a curated downloader that fetches official `facebook/*` MusicGen model repos and a selection of music datasets from Hugging Face. Dry-run by default; pass `--run` to execute.
- `scripts/download_model_facebook.sh` — a lightweight metadata fetcher and optional weights downloader (accepts `-n MODEL_NAME` and `-w WEIGHTS_URL`).

Usage (dry-run):

```bash
./scripts/download_musicgen_full.sh        # shows what would be downloaded
```

To actually perform downloads (recommended to use in WSL or Linux):

```bash
# ensure a Hugging Face token is available (see .env guidance below)
./scripts/download_musicgen_full.sh --models --datasets --run
```

The project keeps large artifacts out of Git. Downloaded models live under `models/` and datasets under `datasets/`.

Artifacts and reports

- Downloaded model and dataset artifacts are stored under `models/` and `datasets/` in this workspace. These are large and intentionally not committed.
- Machine-readable inventories are committed to the repo:
	- `models/inventory.json` — per-model folder metadata (size, file count, snapshot id)
	- `datasets/inventory.json` — per-dataset metadata and README excerpts
	- `inventory/combined_inventory.json` — aggregated summary with totals
- Verification artifacts and reports:
	- `models/checksums.sha256` — SHA256 for the largest model shards (generated locally)
	- `tests/env_tests/smoke_report_*.json` — reports produced by the smoke check script
	- CI also uploads smoke check reports as workflow artifacts (see `.github/workflows/smoke.yml`).

These artifacts make it easy to run quick validation and to audit whether model/dataset files have changed without checking large binaries into Git.

## Environment and token handling

- Create a local `.env` in the repo root with your `HUGGINGFACE_HUB_TOKEN` to avoid rate-limits when downloading. Example:

```ini
# .env (DO NOT COMMIT)
HUGGINGFACE_HUB_TOKEN=hf_xxx...
```

- `.env` is already included in `.gitignore` and the downloader scripts auto-source it (so you can just run the scripts after adding your token).

## Next steps

- Add project description, author, and dependencies as needed.
- Add tests and linting configuration if desired.
- For reproducible environments, use the included Docker setup (see below).

## Docker usage (recommended for reproducible environment)

This project includes a `Dockerfile` and `docker-compose.yml` to create a reproducible Debian/Ubuntu-based environment on Windows (WSL2 recommended).

Prerequisites:

- Docker Desktop for Windows with WSL2 backend enabled (recommended).
- If you need GPU support, install the NVIDIA Container Toolkit and configure Docker/WSL accordingly.

Build the image:

```bash
cd c:/repos/harmonia
npm run docker:build
```

Run a dev container (interactive):

```bash
npm run docker:run
```

Or use Docker Compose:

```bash
docker compose up --build
```

Notes:

- Model weights should live under `models/`. Do not commit large binaries — use cloud storage or Git LFS.
- On Windows, prefer using WSL2 for better filesystem and permission handling.
- For GPU workloads, run the container with GPU access (NVIDIA runtime) and ensure host drivers are installed.

````
