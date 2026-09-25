# Model Storage, Inventory, and Rehydration Architecture

**Status:** Planned architecture
**Date:** September 23, 2026
**Scope:** Local model binaries, model provenance, inventory, verification, and deterministic restoration.

## 1. Purpose

Harmonia now supports multiple local model providers with materially different
download mechanisms:

- MusicGen models downloaded through Hugging Face.
- DiffSinger acoustic, pitch, and vocoder packages downloaded from release ZIPs.
- Stable Audio 3 models downloaded through gated Hugging Face repositories.
- Additional providers will add more Hugging Face, direct-release, and
  provider-specific download strategies.

The system needs one durable rule for where large model assets live, how their
state is recorded, and how a replacement workstation can reconstruct the local
model cache without relying on undocumented manual steps.

## 2. Architectural decision

Large model binaries are **filesystem assets**, not MongoDB blobs.

MongoDB is the operational control plane for model installation metadata,
provenance, status, verification, and errors. Git contains the desired-state
manifests and code needed to reconstruct the cache. The filesystem contains the
actual large model data.

### Sources of truth

| Concern | Source of truth |
| --- | --- |
| Which models Harmonia supports | `MUSIC_MODELS` application catalog |
| How an installed model is obtained | committed model registry under `inventory/` |
| Actual model bytes | local `models/` tree |
| Current machine installation state | MongoDB `model_installations` |
| Historical/generated inventory evidence | generated inventory/report artifacts |
| User generation jobs | MongoDB `jobs` |
| Generated audio | local `exports/jobs/<jobId>/` with MongoDB pointers |

The rehydration process must work even when MongoDB is empty or unavailable.
This is necessary for disaster recovery. MongoDB is updated after filesystem
reconciliation when it is available.

## 3. Current persistent layout

Current provider containers already bind-mount persistent host directories:

```text
models/
├── musicgen/
│   ├── huggingface/
│   └── torch/
├── diffsinger/
│   ├── 0228_opencpop_ds100_rel/
│   ├── 0102_xiaoma_pe/
│   └── hifigan/
└── stable-audio-3/
    └── huggingface/

exports/
└── jobs/
    └── <jobId>/
        └── music.wav

artifacts/
generated/
```

Container recreation therefore does not destroy downloaded model weights.

MongoDB persists separately through the Compose named volumes:

- `mongo-data`
- `mongo-config`

The repository intentionally ignores large local model and dataset content.

## 4. Desired-state model registry

The existing `inventory/combined_inventory.json` is an observed machine
snapshot. It should not become the download specification because it contains
machine-specific paths, sizes, and discovered folders.

Add a committed desired-state registry:

```text
inventory/
├── model_registry.json
├── model_registry.schema.json
├── combined_inventory.json
├── combined_inventory.example.json
└── manifest_schema.json
```

Each `model_registry.json` entry is keyed by the same `modelId` used by
`MUSIC_MODELS`.

Example conceptual entry:

```json
{
  "modelId": "stable-audio-3-small-music",
  "providerId": "stable-audio-3",
  "runtimeModelId": "small-music",
  "availability": "installed",
  "source": {
    "kind": "huggingface",
    "repoId": "stabilityai/stable-audio-3-small-music",
    "revision": null,
    "gated": true
  },
  "destination": "models/stable-audio-3/huggingface",
  "verification": {
    "strategy": "huggingface-snapshot",
    "requiredFiles": ["model_config.json"]
  },
  "license": {
    "acceptanceRequired": true,
    "redistributionAllowed": false
  }
}
```

### Supported source strategies

Initial implementation:

1. `huggingface`
   - MusicGen
   - Stable Audio 3
   - future Hugging Face model repositories
2. `http-zip`
   - DiffSinger acoustic model
   - DiffSinger pitch estimator
   - DiffSinger HiFi-GAN vocoder

Future strategies may include:

- `http-file`
- `git-lfs`
- `s3`
- provider-specific adapters

A provider-specific downloader may exist, but the registry remains the
declarative entry point.

## 5. Availability rules

Default initialization downloads only models that Harmonia considers locally
installed:

```text
availability = installed
```

The initializer must skip:

- `planned`
- `unreleased`
- `api-only`

A future explicit flag may permit additional optional models, but ordinary
rehydration must not unexpectedly download every model listed in the catalog.

The build/test pipeline must validate that every `installed` local model has a
matching registry entry.

## 6. Model lifecycle commands

The target command surface is:

```bash
pnpm models:plan
pnpm models:init
pnpm models:verify
pnpm models:inventory
pnpm models:repair
```

### `models:plan`

Read-only. Shows what would be required.

Example:

```text
MODEL                              STATUS       ACTION
musicgen-small                     installed    none
musicgen-stereo-small              installed    none
diffsinger-acoustic-hifigan        installed    none
stable-audio-3-small-music         missing      download
```

### `models:init`

Idempotently reconciles all `installed` desired models.

For each model:

1. Read the registry entry.
2. Check authentication prerequisites without printing secrets.
3. Inspect local cache markers.
4. Skip a complete verified cache.
5. Download missing assets into a temporary/staging path.
6. Verify required files and source revision.
7. Atomically promote completed downloads where practical.
8. Record size, file count, source revision, and verification status.
9. Upsert MongoDB installation metadata when MongoDB is reachable.
10. Emit a machine-readable initialization report.

Repeated execution on a complete machine should perform no large downloads.

### `models:verify`

Never downloads.

It validates:

- expected provider directory exists;
- required files/checkpoints exist;
- source revision or Hugging Face snapshot is known when available;
- optional checksums match;
- gated assets remain readable from their local cache;
- catalog and registry IDs remain consistent.

### `models:inventory`

Produces observed-state information:

- model ID;
- provider;
- local path;
- source/snapshot revision;
- bytes;
- file count;
- verification state;
- timestamp.

This replaces reliance on old absolute machine paths in historical inventory
snapshots.

### `models:repair`

Repairs incomplete installations without redownloading already verified data.
It may remove temporary/incomplete staging directories, but must not delete a
verified installation unless an explicit destructive flag is supplied.

## 7. MongoDB model installation registry

Add a `model_installations` collection for current operational state.

The collection is keyed by physical `artifactId`, not only by application
`modelId`. This is required because one application model can depend on
multiple separately downloadable artifacts. DiffSinger is the first concrete
example.

Recommended document shape:

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
createdAt
updatedAt
```

Logical model readiness is derived from the registry binding: a model is ready
only when every required `artifactId` is verified/installed.

Recommended status values:

```text
missing
downloading
verifying
installed
degraded
failed
```

Recommended indexes:

- unique `artifactId` for the first single-workstation implementation
- `modelIds`
- `providerId + status`
- `status + updatedAt`

For a future multi-worker deployment, use a compound unique key such as
`machineId + artifactId`. The logical model status remains a derived view over
its required physical artifacts.

### What MongoDB must not contain

- Hugging Face tokens
- API keys
- multi-gigabyte checkpoint binaries
- duplicated audio binaries
- secrets copied from `.env`

MongoDB stores pointers and provenance, not the model payload.

## 8. Download safety

All download adapters must follow these rules:

1. Never print authentication tokens.
2. Never commit model binaries.
3. Do not download into the final verified location until the asset is known to
   be complete, when the source strategy permits staging.
4. Retry transient network failures with bounded retries.
5. Preserve valid cache content between retries.
6. Fail explicitly on gated-license/authorization failures.
7. Do not bypass upstream licensing or access controls.
8. Prefer pinned source revisions where a provider requires compatibility.
9. Capture source revision/snapshot IDs after download.
10. Never silently replace a known-good model with a different revision.

## 9. Provider-specific initial behavior

### MusicGen

Storage:

```text
models/musicgen/huggingface
models/musicgen/torch
```

Rehydration should use Hugging Face snapshot/cache APIs for each installed
MusicGen runtime model rather than requiring a first inference to trigger the
download.

Initial desired models:

- `facebook/musicgen-small`
- `facebook/musicgen-stereo-small`

Models that exceed the current workstation hardware may remain catalog-visible
without being downloaded by the default workstation profile.

### DiffSinger

Storage:

```text
models/diffsinger/0228_opencpop_ds100_rel
models/diffsinger/0102_xiaoma_pe
models/diffsinger/hifigan
```

The existing DiffSinger entrypoint already demonstrates the desired
idempotent behavior: verify the package, download when absent, and reuse the
cache afterward.

The new initializer should extract this behavior into a reusable adapter rather
than maintaining two independent implementations.

### Stable Audio 3

Storage:

```text
models/stable-audio-3/huggingface
```

The Small-Music repository is gated. Initialization must:

- detect a supported Hugging Face credential;
- verify the token identity without printing the token;
- surface gated-access denial clearly;
- download/cache the required snapshot only after account authorization exists.

## 10. Startup behavior

`pnpm start:all --gpu` should **not** automatically download multi-gigabyte
models.

Startup should eventually perform only a lightweight model readiness
reconciliation:

```text
catalog -> registry -> local cache -> Mongo installation state
```

If a selected model is missing, the backend should report an actionable state
such as:

```text
Model is not initialized locally. Run:
pnpm models:init --model stable-audio-3-small-music
```

This keeps normal application startup deterministic and prevents unexpected
network usage or license prompts.

## 11. Disaster recovery

A replacement machine should be reconstructable from:

1. Git checkout.
2. Private `.env`/secret restoration.
3. Docker and GPU runtime prerequisites.
4. Mongo restore when historical application state is required.
5. `pnpm install`.
6. `pnpm models:init`.
7. `pnpm models:verify`.
8. `pnpm start:all --gpu`.

Model binaries do not have to be backed up when their upstream source remains
available and licensing permits re-download. Unique fine-tunes or locally
trained checkpoints are different: they require backup/object-storage policy
and must not be treated as reconstructable upstream assets.

## 12. Generated audio and job records

Generation artifacts continue to use:

```text
exports/jobs/<jobId>/music.wav
```

MongoDB `jobs` stores the durable job state and result metadata including the
download path, provider/model identity, audio metadata, timestamps, and errors.

This provides a clean division:

```text
MongoDB = metadata, workflow state, provenance
Filesystem/object storage = large binaries
```

A future object-storage backend can replace local `exports/` without changing
the job metadata contract.

## 13. Testing requirements

The initializer must be testable without deleting the developer's real model
cache.

Required test layers:

- manifest/schema unit tests;
- catalog-to-registry consistency tests;
- dry-run tests;
- temporary-directory download adapter tests;
- cache-hit/idempotency tests;
- partial-cache repair tests;
- authentication failure tests with sanitized output;
- Mongo upsert tests;
- provider runtime smoke tests after initialization.

A destructive full-cache recovery test must be opt-in and must never run as an
ordinary CI job.

## 14. Definition of done

The model-storage/rehydration capability is complete when:

- every locally installed model has a declarative registry entry;
- `pnpm models:init` can populate an empty alternate model root;
- running `models:init` again performs no unnecessary downloads;
- `models:verify` reports a complete verified installation;
- MongoDB reflects installation status without containing model blobs/secrets;
- all provider containers consume the same persistent host model cache;
- startup reports missing models without silently downloading them;
- recovery documentation is validated on an alternate empty model root;
- generated and exported artifacts are excluded from source control.
