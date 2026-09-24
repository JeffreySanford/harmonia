# Harmonia Local Model Cache

This directory is the persistent host-side cache for local AI model artifacts.

Large model binaries belong here, not in Git and not in MongoDB.

## Current provider layout

The active local providers currently use:

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
```

Provider containers bind-mount these directories. Recreating a Docker container
therefore does not erase downloaded model weights.

## Desired state vs observed state

Desired model acquisition and verification rules live in:

```text
inventory/model_registry.json
inventory/model_registry.schema.json
```

That registry is portable and contains only relative destinations.

Observed/generated inventory is separate. Historical files such as
`inventory/combined_inventory.json` describe what was found on a workstation
at a point in time and may contain legacy absolute paths. They are not the
download specification.

See:

- `inventory/README.md`
- `docs/MODEL_STORAGE_AND_REHYDRATION.md`
- `docs/planning/MODEL_STORAGE_REHYDRATION_PLAN.md`

## Current qualified model assets

### MusicGen

Qualified application models:

- `musicgen-small` -> `facebook/musicgen-small`
- `musicgen-stereo-small` -> `facebook/musicgen-stereo-small`

MusicGen Medium and Stereo Medium remain catalog-visible and have registry
entries, but are excluded from the default initialization set on the current
10 GB-class workstation because their VRAM guidance is substantially higher.

### DiffSinger

The qualified logical model:

```text
diffsinger-acoustic-hifigan
```

requires three physical packages:

```text
0228_opencpop_ds100_rel
0102_xiaoma_pe
0109_hifigan_bigpopcs_hop128
```

The local vocoder cache directory is named `hifigan/`.

### Stable Audio 3

Qualified model:

```text
stable-audio-3-small-music
```

uses the gated Hugging Face repository:

```text
stabilityai/stable-audio-3-small-music
```

The desired-state registry pins the snapshot that passed Harmonia qualification.

## Git policy

The repository ignores model and dataset payloads:

```text
models/
datasets/
checkpoints/
```

Only documentation/manifest files intentionally force-added to those trees
should ever be versioned.

Never commit:

- model checkpoints;
- Hugging Face blob caches;
- access tokens;
- generated audio;
- temporary download staging files.

## MongoDB policy

MongoDB stores operational metadata and provenance, not checkpoint blobs.

Planned `model_installations` records are keyed by physical `artifactId` and
track:

- source/revision;
- relative storage path;
- status;
- verification state;
- byte/file counts;
- install/verify/use timestamps;
- sanitized errors.

Logical model readiness is derived from the registry binding. This matters for
composite models such as DiffSinger.

## Model lifecycle commands

The canonical operator workflow is being implemented incrementally.

Available now:

```bash
pnpm test:model-registry
pnpm test:model-manager
pnpm models:plan
pnpm models:verify
pnpm models:init
pnpm models:init --model <modelId>
pnpm models:repair --artifact <artifactId>
pnpm models:db-schema
pnpm models:db-sync
```

`models:plan` is marker-level and read-only. `models:verify` performs deeper
read-only byte/link checks. Selector-free `models:init` targets exactly the
registry artifacts marked `defaultInstall=true`; explicit selectors may add
optional models deliberately. Hugging Face and DiffSinger HTTP-ZIP recovery are
locally qualified against an alternate root.

Conservative repair is now available. Verified artifacts are no-ops; incomplete
DiffSinger destinations require `--force` before quarantine + replacement.
Shared Hugging Face cache directories are never destructively quarantined by
the initial repair implementation.

Planned next:

```bash
pnpm models:inventory
```

Ordinary `pnpm start:all --gpu` should never silently download multi-gigabyte
models.

## Recovery goal

A new machine should eventually be able to run:

```bash
git clone <repo>
pnpm install
# restore private .env/secrets
pnpm models:plan
pnpm models:init
pnpm models:verify
pnpm start:all --gpu
```

without relying on undocumented workstation state.

Unique local fine-tunes are different from upstream-reconstructable models and
will require explicit backup/object-storage policy.
