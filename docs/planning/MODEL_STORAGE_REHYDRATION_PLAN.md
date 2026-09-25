# Model Storage and Rehydration Implementation Plan

**Status:** Planned
**Created:** September 23, 2026
**Updated:** September 24, 2026
**Architecture:** [../MODEL_STORAGE_AND_REHYDRATION.md](../MODEL_STORAGE_AND_REHYDRATION.md)

## Supporting planning specifications

This implementation plan is intentionally split from the detailed behavioral
contracts:

- [MODEL_REGISTRY_DATA_MODEL.md](MODEL_REGISTRY_DATA_MODEL.md) — registry and
  binding schema.
- [MODEL_REHYDRATION_FAILURE_RECOVERY.md](MODEL_REHYDRATION_FAILURE_RECOVERY.md)
  — safe failure/retry/repair semantics.
- [MODEL_REHYDRATION_ACCEPTANCE_MATRIX.md](MODEL_REHYDRATION_ACCEPTANCE_MATRIX.md)
  — qualification evidence required by phase and provider.

## Current implementation status

As of September 24, 2026:

- Phase 0 architecture/documentation contract: **complete**.
- Phase 1 desired-state registry: **complete and locally qualified**.
  - `inventory/model_registry.json`
  - `inventory/model_registry.schema.json`
  - `scripts/model-registry-contract.test.cjs`
  - `pnpm test:model-registry`
- Phase 2 core model lifecycle CLI: **complete and locally qualified**.
  - `scripts/model-manager.cjs`
  - `scripts/model-manager.test.cjs`
  - `pnpm models:plan`
  - `pnpm test:model-manager`
  - [MODEL_PLAN_PHASE2.md](MODEL_PLAN_PHASE2.md)
- Phase 3 read-only deep verification: **complete and locally qualified**.
- Phase 4 Hugging Face initialization adapter: **complete and locally qualified**.
- Phase 5 DiffSinger HTTP-ZIP initialization adapter: **complete and locally qualified**.
- Phase 6 default-set `models:init` orchestration: **complete and locally qualified**.
- Phase 7 conservative `models:repair`: **complete and locally qualified**.
- Phase 8A Mongo `model_installations` schema: **complete and locally qualified**.
- Phase 8B filesystem-to-Mongo installation synchronization: **complete and locally qualified**.
- Phase 8C automatic lifecycle-to-Mongo synchronization: **complete and locally qualified**.
- Phase 9 runtime readiness enforcement and `lastUsedAt`: **complete and locally qualified**.
- Phase 10 catalog installation awareness: **complete and locally qualified**.
- Phase 11 portable observed inventory (`models:inventory`): **complete and locally qualified**.
- Model lifecycle foundation through portable observed inventory: **complete**.
- Later download/Mongo/runtime/recovery phases: **not started**.

Phase 1 intentionally includes all application models currently marked
`availability: installed`. MusicGen Medium and Stereo Medium are represented
but use `defaultInstall: false` because they are not appropriate default
downloads for the current 10 GB-class workstation.

No model bytes have moved as part of Phase 1. The registry is declarative only.

## Objective

Create a deterministic, idempotent model lifecycle for Harmonia so every
locally supported model can be inventoried, verified, restored, and repaired
without relying on first-inference downloads or undocumented workstation state.

The implementation must preserve the existing rule that large model binaries
live on persistent local storage while MongoDB records operational metadata and
provenance.

## Current baseline

Already working:

- provider model directories are bind-mounted from host `models/`;
- `models/` is excluded from Git;
- MongoDB uses persistent Docker volumes;
- generation jobs persist durable metadata in MongoDB;
- generated WAV files persist under `exports/jobs/`;
- DiffSinger can download and validate missing acoustic/pitch/vocoder packages;
- MusicGen caches Hugging Face assets locally;
- Stable Audio 3 caches gated Hugging Face assets locally;
- `inventory/` already contains a combined observed-state inventory and JSON
  schema.

Gaps:

- no unified desired-state model registry;
- no single initializer for all providers;
- no MongoDB `model_installations` operational collection;
- MusicGen and Stable Audio currently depend on model load/inference to trigger
  initial model downloads;
- current inventory includes historical machine-specific absolute paths;
- old `download:model` is a conservative placeholder rather than the system
  rehydration mechanism;
- no explicit `models:plan/verify/repair` command family.

## Phase 0 — Contract and repository hygiene

### Deliverables

- `docs/MODEL_STORAGE_AND_REHYDRATION.md`
- this planning document
- `docs/planning/README.md`
- docs index links
- update persistent-storage guidance
- define `generated/` and `exports/` as local-only runtime output

### Acceptance

- architecture explicitly separates model bytes from Mongo metadata;
- no documentation instructs developers to store checkpoint blobs in Mongo;
- recovery path is documented before implementation begins.

## Phase 1 — Desired-state registry

### Files

Create:

```text
inventory/model_registry.json
inventory/model_registry.schema.json
```

### Initial registry coverage

Include only currently qualified/local provider assets first:

1. MusicGen Small
2. MusicGen Stereo Small
3. DiffSinger OpenCpop acoustic
4. DiffSinger pitch estimator
5. DiffSinger HiFi-GAN vocoder
6. Stable Audio 3 Small-Music

The application-level DiffSinger model maps to three physical packages.

### Required fields

At minimum:

```text
modelId
providerId
runtimeModelId
availability
source.kind
source.repoId/url
source.revision
source.gated
destination
verification.strategy
verification.requiredFiles
license.acceptanceRequired
license.redistributionAllowed
```

### Tests

- JSON Schema validation;
- every registry `modelId` exists in `MUSIC_MODELS`;
- every local `availability=installed` catalog entry has registry coverage or
  an explicitly documented composite mapping;
- planned/unreleased/API-only models are not in the default download set.

## Phase 2 — Core model lifecycle CLI

### New scripts

Preferred entry point:

```text
scripts/model-manager.cjs
```

Package commands:

```json
{
  "models:plan": "node scripts/model-manager.cjs plan",
  "models:init": "node scripts/model-manager.cjs init",
  "models:verify": "node scripts/model-manager.cjs verify",
  "models:inventory": "node scripts/model-manager.cjs inventory",
  "models:repair": "node scripts/model-manager.cjs repair"
}
```

### CLI filters

Support:

```text
--model <modelId>
--provider <providerId>
--root <alternate-model-root>
--dry-run
--offline
--force
```

`--root` is important for qualification because tests must never delete or
overwrite the developer's production cache.

### Core responsibilities

- load `.env` safely;
- normalize Hugging Face token aliases;
- read/validate registry;
- select desired models;
- inspect cache;
- invoke source adapter;
- verify installation;
- emit structured report;
- optionally synchronize Mongo state.

## Phase 3 — Download adapters

Implement source adapters behind one interface.

### Hugging Face adapter

Used by:

- MusicGen
- Stable Audio 3
- future HF providers

Responsibilities:

- authenticate without printing secrets;
- support gated repositories;
- resolve/capture snapshot revision;
- download only required repository content or full snapshot as configured;
- reuse HF cache on repeat execution.

### HTTP ZIP adapter

Used initially by DiffSinger.

Responsibilities:

- bounded retry;
- download to temporary location;
- extract safely;
- verify expected config/checkpoint markers;
- atomically promote completed package;
- reuse verified package on repeat execution.

### Acceptance

For each adapter:

- empty alternate root downloads successfully;
- second run is a cache hit;
- partial/incomplete cache is detected;
- repair restores completeness;
- failed authentication never leaks secrets.

## Phase 4 — MongoDB operational inventory

### New collection

`model_installations`

### Backend schema

Add a Mongoose schema with:

```text
artifactId
providerId
modelIds[]
runtimeModelIds[]
sourceKind
sourceRef
sourceRevision
localPath
status
fileCount
bytes
verificationStrategy
verifiedAt
installedAt
lastUsedAt
licenseAcceptanceRequired
gated
lastError
timestamps
```

### Behavior

- model CLI upserts one operational record per physical `artifactId` when Mongo is reachable;
- logical model readiness is derived from the registry binding's required artifact IDs;
- CLI still works when Mongo is unavailable;
- backend startup can reconcile DB state against disk;
- provider selection can update `lastUsedAt` for every artifact required by the selected model;
- model download errors are stored in sanitized form.

### Non-goal

Do not store model checkpoint bytes, access tokens, or generated WAV payloads in
MongoDB.

## Phase 5 — Runtime integration

### Runtime selection

Before starting a provider:

1. resolve selected model;
2. verify required local installation;
3. return actionable missing/degraded state when absent;
4. do not silently launch a multi-gigabyte download.

Suggested error:

```text
Stable Audio 3 Small Music is not initialized locally.
Run: pnpm models:init --model stable-audio-3-small-music
```

### Provider entrypoints

Provider entrypoints should become consumers/verifiers of the shared model
cache rather than independent download implementations.

Migration order:

1. DiffSinger: extract existing downloader into shared adapter.
2. Stable Audio 3: prefetch gated snapshot via model manager.
3. MusicGen: prefetch selected AudioCraft/HF snapshots via model manager.

Keep provider-local readiness checks even after download behavior moves out.

## Phase 6 — Inventory modernization

The current `inventory/combined_inventory.json` is useful historical evidence
but contains absolute machine paths and old folder assumptions.

Modernize inventory generation to use model IDs and relative paths.

Example observed entry:

```json
{
  "modelId": "stable-audio-3-small-music",
  "providerId": "stable-audio-3",
  "runtimeModelId": "small-music",
  "localPath": "models/stable-audio-3/huggingface",
  "sourceRevision": "0fef1392cd842149a2b6d445e181c97608faac06",
  "status": "installed",
  "sizeBytes": 0,
  "filesCount": 0,
  "verifiedAt": "..."
}
```

The observed inventory is generated evidence, not the desired-state download
specification.

## Phase 7 — Recovery qualification

### Non-destructive qualification

Use an alternate root:

```bash
pnpm models:init --root generated/qualification-runtime/models
pnpm models:verify --root generated/qualification-runtime/models
```

This proves rehydration without deleting the real `models/` cache.

### Required qualification scenarios

1. empty root;
2. complete root;
3. partial package;
4. invalid/missing checksum marker;
5. unavailable network;
6. missing Hugging Face token;
7. gated Hugging Face access denied;
8. successful gated access;
9. Mongo unavailable;
10. Mongo available and state upserted.

### Heavy test policy

Actual multi-GB rehydration is a local/manual qualification and must not run in
ordinary GitHub Actions. CI validates schemas, plans, mocks, and fixtures.

## Phase 8 — Disaster recovery integration

Update:

- `docs/DISASTER_RECOVERY.md`
- `docs/SETUP.md`
- `docs/DEV_ONBOARDING.md`
- `models/README.md`

Canonical rebuild sequence:

```bash
git clone ...
pnpm install
# restore .env / secrets
pnpm models:plan
pnpm models:init
pnpm models:verify
pnpm start:all --gpu
```

Historical Mongo backups may then be restored when job/user history is needed.

## Dependency graph

```text
Architecture/docs
      |
      v
Registry schema + bindings
      |
      +--------------------+
      |                    |
      v                    v
models:plan           models:verify
      |                    |
      +----------+---------+
                 |
                 v
        source adapters
        /             \
       v               v
Hugging Face         HTTP ZIP
       \               /
        +------+-------+
               |
               v
          models:init
               |
               v
          models:repair
               |
               v
   Mongo model_installations
               |
               v
      runtime readiness gate
               |
               v
   recovery qualification
               |
               v
 setup/disaster recovery docs
```

The sequencing is deliberate: read-only planning and verification must exist
before mutation; mutation must be safe before runtime selection starts relying
on it; recovery qualification comes only after both filesystem and Mongo
contracts are stable.

## Proposed delivery order

1. Registry schema + initial registry.
2. Read-only `models:plan`.
3. Read-only `models:verify`.
4. Hugging Face adapter.
5. DiffSinger ZIP adapter.
6. `models:init`.
7. `models:repair`.
8. Mongo `model_installations`.
9. Runtime readiness integration.
10. Inventory modernization.
11. Recovery qualification.
12. Setup/disaster-recovery documentation updates.

This order deliberately implements read-only visibility before mutation.

## Definition of done

- [x] All installed local catalog models map to registry entries.
- [x] `models:plan` identifies missing/cached models without mutation.
- [x] `models:init` can populate an empty alternate root.
- [x] `models:init` is idempotent on a complete root.
- [x] `models:verify` performs no downloads.
- [ ] `models:repair` fixes an incomplete root without deleting unrelated data.
- [x] Gated model failures are explicit and secret-safe.
- [ ] Mongo records installation state and provenance.
- [ ] No large model binary is stored in Mongo or Git.
- [ ] Startup never performs surprise multi-GB downloads.
- [ ] Provider runtimes use persistent local model mounts.
- [x] Recovery is qualified using an alternate empty root.
- [ ] Generated/exported runtime artifacts remain outside source control.
