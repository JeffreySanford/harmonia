# Harmonia Model Inventory

Harmonia keeps two different kinds of model inventory in this directory. They
must not be confused.

## Desired state

### `model_registry.json`

This is the committed source of truth for **how Harmonia reconstructs locally
supported model artifacts**.

It describes:

- stable artifact IDs;
- provider IDs;
- provider-native runtime model IDs;
- download source type and source identity;
- gated-access requirements;
- relative destination under the model root;
- verification strategy;
- license/re-distribution metadata;
- whether the artifact belongs in the default initialization set.

The schema is:

```text
inventory/model_registry.schema.json
```

The registry is reviewed code. It must not contain:

- access tokens;
- API keys;
- passwords;
- absolute workstation paths;
- model binary payloads.

Application models are connected to physical artifacts through
`modelBindings`.

This is necessary because one selectable application model may require multiple
downloaded packages. DiffSinger is the first example: its acoustic model,
pitch estimator, and HiFi-GAN vocoder are three separate artifacts but one
Harmonia model selection.

## Observed state

### `combined_inventory.json`

This file is a historical/generated snapshot of files that were observed on a
specific machine.

It currently contains legacy absolute paths and older folder assumptions. It is
useful as evidence of what existed at the time it was generated, but it is **not
the download specification** and must not be used by `models:init`.

The planned `models:inventory` command will modernize observed inventory to
use:

- model/artifact IDs;
- relative paths;
- resolved source revisions;
- byte/file counts;
- verification state;
- verification timestamp.

## Runtime catalog relationship

The NestJS runtime catalog answers what the application can select and run:

```text
apps/backend/src/music-runtime/music-model.catalog.ts
```

The model registry answers where the bytes come from and how to verify them.

A contract test enforces that every model currently marked
`availability: installed` has a registry binding.

A model may be catalog-installed but have `defaultInstall: false` in the
registry. This is intentional for models that the provider runtime supports but
that should not be downloaded automatically for the current workstation
profile. MusicGen Medium and Stereo Medium currently use this rule because they
exceed the target 10 GB-class GPU memory budget.

## Commands

Current commands:

```bash
pnpm test:model-registry
pnpm test:model-manager
pnpm models:plan
```

`models:plan` is read-only with respect to model data. It inspects the
registry and local cache markers, writes a gitignored report under
`generated/model-manager/`, and performs no download or repair.

Planned lifecycle commands:

```bash
pnpm models:init
pnpm models:verify
pnpm models:inventory
pnpm models:repair
```

See:

- `docs/MODEL_STORAGE_AND_REHYDRATION.md`
- `docs/planning/MODEL_STORAGE_REHYDRATION_PLAN.md`
- `docs/planning/MODEL_REGISTRY_DATA_MODEL.md`
- `docs/planning/MODEL_REHYDRATION_FAILURE_RECOVERY.md`
- `docs/planning/MODEL_REHYDRATION_ACCEPTANCE_MATRIX.md`
