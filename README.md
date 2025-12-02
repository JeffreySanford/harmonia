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
