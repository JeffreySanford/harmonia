# Harmonia Docker Development Runtime

Harmonia uses one canonical local Compose definition: `docker-compose.yml`.

| Service | Container | Host port | Purpose |
| --- | --- | ---: | --- |
| MongoDB | `harmonia-mongo-i9` | 27017 | Application database |
| Mongo Express | `harmonia-mongo-ui` | 8081 | Optional database UI |
| Utility worker | `harmonia-worker` | none | Lightweight Python/orchestration utilities |

The Angular frontend and NestJS backend run through Nx on the host:

- Frontend: `http://localhost:4200`
- Backend/API/WebSocket: `http://localhost:3000`
- Ollama: external/local at `http://localhost:11434` when `USE_OLLAMA=true`

Port 8000 is intentionally not published. Heavy ML frameworks do not live in the
utility worker; MusicGen and DiffSinger run only in their provider-specific images.

## Start everything

Copy `.env.example` to `.env`, set the required passwords and JWT secret, start
Docker Desktop, then run:

```bash
pnpm start:all
```

`start:all` validates configuration and app ports, reconciles Docker services,
waits for health checks, verifies the application MongoDB credentials, checks
Ollama only when enabled, then starts NestJS and Angular.

Docker reconciliation follows this contract:

```text
missing            -> create + start
stopped            -> start
running/unhealthy  -> restart
dirty config/image -> recreate
running/healthy    -> keep running
```

A "dirty" service means its Compose configuration or built image changed. It does
not mean uncommitted Git changes.

## Optional startup modes

```bash
pnpm start:all --gpu
pnpm start:all --no-worker
pnpm start:all --no-tools
pnpm start:all --gpu --no-tools
```

`--gpu` enables NVIDIA runtime settings for provider-specific model containers.
It may be combined with `--no-worker`; the utility worker itself is CPU-only.

## MongoDB

Required values:

```dotenv
MONGO_ROOT_PASSWORD=...
MONGO_HARMONIA_PASSWORD=...
JWT_SECRET=...
```

Workstation defaults:

```dotenv
MONGO_WIREDTIGER_CACHE_GB=2
MONGO_MAX_CONNS=500
```

The application user is created when the MongoDB volume is first initialized.
Changing `MONGO_HARMONIA_PASSWORD` later does not mutate an existing user.

## Utility worker

The canonical utility container is `harmonia-worker`. It intentionally excludes
Torch, AudioCraft, DiffSinger, and other provider-specific model frameworks.
Music generation is executed only in the selected provider container.

```bash
pnpm docker:ml:start
pnpm docker:ml:shell
pnpm docker:ml:stop
pnpm docker:status
```

The `docker:ml:*` names are compatibility aliases; they now operate on
`harmonia-worker`.

## Qualification

```bash
pnpm lint:all
pnpm test:all
pnpm build:all
pnpm test:all:e2e
```

The real Docker lifecycle test is opt-in:

```bash
RUN_DOCKER_START_TESTS=1 pnpm test:startup
```

PowerShell:

```powershell
$env:RUN_DOCKER_START_TESTS='1'
pnpm test:startup
```

The integration test uses a temporary Compose project with no published host ports
or persistent volumes, so it does not interfere with another development stack.
