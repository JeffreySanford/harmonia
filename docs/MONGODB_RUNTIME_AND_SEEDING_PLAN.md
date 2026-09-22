# MongoDB Runtime and Seeding Plan

**Last reviewed:** September 22, 2026  
**Status:** Architecture plan plus current-state record  
**Canonical runtime branch at time of review:** `chore/unify-runtime-lifecycle`

## 1. Decision

Harmonia's local development MongoDB should be **Docker-managed**, not a separately installed Windows MongoDB service.

The canonical container is:

```text
harmonia-mongo-i9
```

The canonical host endpoint is:

```text
127.0.0.1:27017
```

Mongo Express is optional tooling:

```text
harmonia-mongo-ui
127.0.0.1:8081
```

This gives Harmonia one reproducible database runtime across developer machines and avoids configuration drift between native Mongo installations and Docker.

## 2. Current Docker Topology

The lifecycle branch defines:

```yaml
mongo:
  image: mongo:7.0
  container_name: harmonia-mongo-i9
  ports:
    - "127.0.0.1:27017:27017"
```

Persistent state is stored in named Docker volumes:

```text
mongo-data
mongo-config
```

Therefore:

- replacing/recreating the container does not normally erase database data;
- changing the image does not automatically recreate application data;
- deleting the named volume is destructive and should never be used casually as a troubleshooting step.

## 3. Current First-Start Initialization

On an **empty Mongo data volume**, Docker's Mongo entrypoint executes:

```text
scripts/mongo-init/01-init-harmonia-db.js
```

That script currently creates:

- the `harmonia` database;
- application user `harmonia_app`;
- limited `readWrite` permissions for that user;
- collections:
  - `model_artifacts`
  - `licenses`
  - `inventory_versions`
  - `jobs`
  - `events`
- validation rules;
- indexes;
- one `_setup_test` model artifact used as a bootstrap sentinel.

This is **database bootstrap**, not a complete application/demo seed.

Important Mongo behavior:

> Scripts under `/docker-entrypoint-initdb.d` execute only when Mongo initializes an empty `/data/db` volume.

Changing `.env` passwords later does not update an application user already stored in an existing Mongo volume.

## 4. Current Seed Mechanisms Are Separate

Harmonia currently has three different data-initialization concepts.

### 4.1 Infrastructure bootstrap

File:

```text
scripts/mongo-init/01-init-harmonia-db.js
```

Purpose:

- database/user creation;
- collection structure;
- indexes;
- minimal bootstrap sentinel.

Runs automatically only for a new Mongo volume.

### 4.2 E2E user seed

File:

```text
scripts/setup-e2e-tests.sh
scripts/add-test-user.js
```

Purpose:

- create E2E users;
- seed `harmonia_test`;
- optionally place the E2E user into the runtime database.

This is test support and should **not** become the normal development-data seed.

### 4.3 Disaster-recovery seed

Files:

```text
seeds/disaster-recovery-seed.json
scripts/generate-seed.js
scripts/restore-from-seed.js
```

Current snapshot contains eight records across:

- `model_artifacts`;
- `licenses`;
- `inventory_versions`;
- `jobs`;
- `events`.

The snapshot dates from December 2025 and contains workstation-specific paths such as:

```text
C:/repos/harmonia/models/facebook
```

It also describes the old MusicGen-focused model inventory.

Therefore the disaster-recovery seed **must not be automatically restored on every fresh development startup**.

It is a recovery artifact, not the canonical development seed.

## 5. Why the Current Port Collision Happens

The canonical Docker Mongo publishes:

```text
127.0.0.1:27017
```

Only one host process/container can bind that address/port.

If a native Windows MongoDB service or an older Docker container already owns 27017, Compose cannot start `harmonia-mongo-i9`.

This exact condition produces an error similar to:

```text
ports are not available:
listen tcp4 127.0.0.1:27017:
Only one usage of each socket address is normally permitted
```

The correct response is to identify the owner before stopping or deleting anything.

Useful Windows/Git Bash diagnostics:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep -E '27017|mongo'

cmd.exe /c "netstat -ano | findstr :27017"

powershell.exe -NoProfile -Command "Get-Service *Mongo* | Format-Table Name,Status,DisplayName"
```

If `netstat` returns a PID:

```bash
cmd.exe /c "tasklist /FI \"PID eq <PID>\""
```

Do not delete `mongo-data` merely to resolve a host-port collision.

## 6. Target Seeding Architecture

Harmonia should explicitly separate **schema/bootstrap**, **reference seed**, **developer seed**, and **recovery restore**.

### Layer A — automatic database bootstrap

Runs on a new volume.

Responsible only for:

- application DB user;
- required indexes;
- hard validation contracts;
- seed-state collection/sentinel.

It should contain no machine-specific paths and no passwords beyond values supplied through environment variables.

### Layer B — idempotent reference-data seed

New command:

```text
pnpm seed:reference
```

Safe to run repeatedly.

Candidate records:

- license metadata:
  - MIT
  - Apache-2.0
  - CC-BY-NC-4.0
  - Stability Community License metadata
  - other licenses introduced by supported providers;
- provider/model catalog version metadata if persisted;
- stable system configuration records.

Reference seeding must use deterministic natural keys/upserts.

### Layer C — optional development/demo seed

New command:

```text
pnpm seed:dev
```

Purpose:

- create optional local demo user from environment-provided credentials;
- create example song/project/job records;
- install useful non-secret local defaults;
- make a freshly cloned Harmonia instance immediately explorable.

Rules:

- no committed plaintext passwords;
- credentials come from `.env`;
- idempotent upserts;
- never drop existing data;
- clearly marked development records;
- can be rerun after schema evolution.

Suggested environment variables:

```text
DEV_SEED_ENABLED=true
DEV_SEED_USER_USERNAME=
DEV_SEED_USER_EMAIL=
DEV_SEED_USER_PASSWORD=
```

### Layer D — disaster recovery

Existing commands remain conceptually separate:

```text
pnpm seed:generate
pnpm seed:restore
```

Recovery seed should represent an explicit snapshot and must never run implicitly from `start:all`.

## 7. Start-All Behavior

The desired lifecycle is:

```text
pnpm start:all
   |
   +--> validate .env
   |
   +--> preflight ports
   |      3000 backend
   |      4200 frontend
   |      27017 Mongo
   |      8081 Mongo Express when enabled
   |
   +--> reconcile Docker
   |      mongo
   |      mongo-express (optional)
   |      worker (optional)
   |
   +--> wait for Mongo health
   |
   +--> verify harmonia_app credentials
   |
   +--> inspect seed state
   |
   +--> ensure safe reference seed is current
   |
   +--> optionally run development seed
   |
   +--> start NestJS + Angular
```

The lifecycle branch now preflights Harmonia-managed Mongo/Mongo Express ports before expensive ML container reconciliation.

A port already owned by Harmonia's own managed container is valid.

A port owned by an unrelated container or host process should fail immediately with an actionable message.

## 8. Proposed Seed-State Collection

Add a lightweight collection such as:

```text
seed_state
```

Example:

```json
{
  "_id": "reference",
  "version": "2026.09.22",
  "appliedAt": "2026-09-22T00:00:00.000Z"
}
```

And optionally:

```json
{
  "_id": "development",
  "version": "1",
  "appliedAt": "2026-09-22T00:00:00.000Z"
}
```

This gives `start:all` an explicit way to distinguish:

- a database that has never been seeded;
- a database with old reference data;
- a database with optional dev content.

## 9. Model Catalog Relationship

The planned free/local music-model catalog should not depend on a DR snapshot.

Canonical provider/model definitions should initially live in version-controlled application configuration/code.

Mongo can record runtime state such as:

- model installed/not installed;
- downloaded artifact path;
- artifact hash;
- disk size;
- provider/model version;
- license record;
- installation timestamp;
- benchmark results.

This keeps Harmonia able to reconstruct current model availability even when an old database snapshot does not know about newer providers such as:

- ACE-Step 1.5;
- Stable Audio 3.0;
- DiffRhythm;
- HeartMuLa;
- newer MusicGen variants.

## 10. Future Developer Commands

Target command surface:

```text
pnpm start:all
pnpm seed:status
pnpm seed:reference
pnpm seed:dev
pnpm seed:generate
pnpm seed:restore
```

Potential destructive reset should be intentionally verbose and separate, for example:

```text
pnpm db:reset:dev
```

It should require explicit confirmation and must never be invoked by normal startup.

## 11. Implementation Sequence

Do not broaden the current runtime-recovery branch unnecessarily.

### Current lifecycle branch

Finish only:

- Docker runtime reliability;
- port ownership diagnostics;
- Mongo connectivity;
- worker qualification;
- startup tests.

### After lifecycle merge

Create:

```text
feat/database-seeding
```

Implement:

1. `seed_state`;
2. reference-data seed;
3. `seed:status`;
4. optional `seed:dev`;
5. startup integration for safe reference data;
6. tests proving reruns are idempotent;
7. documentation update.

Then create the separate music-provider catalog implementation branch.

## 12. Acceptance Criteria

Database lifecycle work is complete when:

- Mongo is Docker-managed for normal Harmonia development;
- native Mongo is not required;
- fresh `mongo-data` initializes automatically;
- existing volumes survive ordinary container recreation;
- reference seed is deterministic and idempotent;
- dev seed is optional and idempotent;
- no seed contains committed plaintext credentials;
- DR restore remains explicit;
- startup detects unrelated port owners before Docker build/reconcile;
- startup validates application credentials;
- model artifact state can be reconstructed without restoring the 2025 DR snapshot;
- documentation clearly distinguishes bootstrap, seed and restore.

## 13. Decision Record — September 22, 2026

- Docker MongoDB is the canonical local Harmonia database.
- `harmonia-mongo-i9` is the managed Mongo container.
- Current automatic initialization is structural/bootstrap seeding only.
- The existing December 2025 recovery seed is not suitable as an automatic development seed.
- Harmonia should gain an idempotent reference seed plus an optional development seed after the runtime lifecycle branch is merged.
- Persistent Docker volumes should never be deleted merely to fix a host-port conflict.
