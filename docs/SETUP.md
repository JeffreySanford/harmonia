# Harmonia Development Setup Guide

This is the canonical local setup for Harmonia.

## Prerequisites

- Windows 10/11, macOS, or Linux
- Node.js 20.19+
- pnpm 10.23+
- Git
- Docker Desktop with Docker Compose
- 16 GB RAM minimum; 32 GB is recommended for local AI workloads
- Optional NVIDIA runtime for GPU acceleration
- Optional Ollama when `USE_OLLAMA=true`

MongoDB does not need to be installed as a native Windows service. The normal
development flow runs MongoDB through Docker.

## Initial setup

```bash
git clone https://github.com/jeffreysanford/harmonia.git
cd harmonia
pnpm install
cp .env.example .env
```

Set at least:

```dotenv
MONGO_ROOT_PASSWORD=choose-a-strong-local-password
MONGO_HARMONIA_PASSWORD=choose-a-different-local-password
JWT_SECRET=replace-with-a-long-random-secret
```

Normal workstation defaults:

```dotenv
PORT=3000
CORS_ORIGIN=http://localhost:4200
MONGO_WIREDTIGER_CACHE_GB=2
MONGO_MAX_CONNS=500
USE_OLLAMA=false
OLLAMA_URL=http://localhost:11434
```

## Start Harmonia

```bash
pnpm start:all
```

Access points:

- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- MongoDB: `127.0.0.1:27017`
- Mongo Express: `http://localhost:8081`
- ML worker: `harmonia-worker` with no published HTTP port

Optional modes:

```bash
pnpm start:all --gpu
pnpm start:all --no-worker
pnpm start:all --no-tools
```

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for lifecycle details.

## App-only development

If Docker infrastructure is already healthy:

```bash
pnpm dev
```

Or individually:

```bash
pnpm dev:backend
pnpm dev:frontend
```

`pnpm start:all` is the preferred entry point from a stopped environment.

## Ollama

Ollama is external to Compose. When `USE_OLLAMA=false`, startup does not require
it. When `USE_OLLAMA=true`, `start:all` checks `OLLAMA_URL` before starting
the app servers.

## Qualification

```bash
pnpm lint:all
pnpm test:all
pnpm build:all
pnpm test:all:e2e
```

For the real isolated Docker lifecycle test:

```bash
RUN_DOCKER_START_TESTS=1 pnpm test:startup
```

## Ports

| Port | Service |
| ---: | --- |
| 4200 | Angular frontend |
| 3000 | NestJS API and WebSocket server |
| 27017 | MongoDB |
| 8081 | Mongo Express |
| 11434 | Ollama, external and optional |
| 6379 | Redis, reserved/optional and not provisioned |

Port 8000 is not part of the runtime contract. The ML worker is currently used via
`docker exec`.

## MongoDB password changes

The application user is created during first initialization of the MongoDB volume.
Changing the password in `.env` later does not change that existing user. Update
the user in MongoDB or intentionally recreate the local volume after backing up
data you need to keep.
