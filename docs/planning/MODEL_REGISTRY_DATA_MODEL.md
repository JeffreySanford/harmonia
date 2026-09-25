# Model Registry Data Model Design

**Status:** Planning specification
**Date:** September 23, 2026
**Parent architecture:** [../MODEL_STORAGE_AND_REHYDRATION.md](../MODEL_STORAGE_AND_REHYDRATION.md)

## 1. Goal

Define the committed desired-state registry that tells Harmonia exactly how a
locally supported model is acquired, stored, verified, licensed, and restored.

The registry is declarative. It does not contain secrets and it does not contain
large model binaries.

## 2. Relationship to the runtime catalog

The runtime catalog and model registry have different responsibilities.

### Runtime catalog

Answers:

- what users can select;
- provider display name;
- capabilities;
- duration limits;
- hardware fit;
- provider image/service identity;
- runtime model ID.

### Model registry

Answers:

- where model bytes come from;
- whether access is gated;
- exact revision or release identity when pinned;
- destination under the local model root;
- required files/checkpoints;
- verification strategy;
- licensing/re-distribution constraints;
- whether one logical runtime model is composed of multiple physical packages.

Neither file should duplicate the other's full responsibility.

## 3. Registry identity

Every entry has a stable `artifactId`.

For simple one-repository models:

```text
artifactId = modelId
```

For composite models, such as DiffSinger, one application model maps to several
physical artifacts:

```text
modelId: diffsinger-acoustic-hifigan

artifactIds:
- diffsinger-opencpop-acoustic
- diffsinger-xiaoma-pitch-estimator
- diffsinger-hifigan-vocoder
```

The registry therefore contains:

1. `artifacts[]` — physical downloadable units;
2. `modelBindings[]` — mappings from application model IDs to required
   artifacts.

This avoids pretending that one logical model always equals one remote
repository.

## 4. Proposed top-level shape

```json
{
  "schemaVersion": "harmonia-model-registry-v1",
  "modelsRoot": "models",
  "artifacts": [],
  "modelBindings": []
}
```

`modelsRoot` is descriptive only. CLI `--root` may override it during
qualification or recovery testing.

## 5. Artifact shape

Required:

```text
artifactId
providerId
displayName
source
destination
verification
license
defaultInstall
```

Recommended:

```text
runtimeModelIds[]
notes
estimatedBytes
platforms[]
tags[]
```

### source

Common fields:

```text
kind
revision
gated
```

Hugging Face:

```json
{
  "kind": "huggingface",
  "repoId": "stabilityai/stable-audio-3-small-music",
  "revision": null,
  "gated": true
}
```

HTTP ZIP:

```json
{
  "kind": "http-zip",
  "url": "https://...",
  "revision": "release-name-or-checksum",
  "gated": false
}
```

## 6. Revision policy

Revision rules are explicit:

### Compatibility-pinned provider

If Harmonia relies on a historical code/model compatibility combination,
registry revision is required.

Example:

```text
DiffSinger runtime source revision:
017bd488a61ebdb8909a8d272ec6211076fa4a7e
```

### Hugging Face snapshots

The registry may initially specify a branch/tag such as `main`, but after
download Harmonia records the resolved immutable snapshot revision in observed
inventory and MongoDB.

For release qualification, prefer a pinned snapshot once compatibility is
known.

### Unpinned revisions

An unpinned source must be visible as such in `models:plan` and inventory.
There must never be a silent assumption that `main` equals a reproducible
version.

## 7. Destination rules

Registry destinations are:

- relative to model root;
- forward-slash normalized;
- forbidden from containing `..`;
- forbidden from being absolute;
- unique per physical artifact unless the source strategy explicitly shares a
  cache root.

Example:

```text
stable-audio-3/huggingface
diffsinger/0228_opencpop_ds100_rel
```

Hugging Face repositories may share a provider cache root because their own
cache layout isolates repositories/snapshots.

## 8. Verification strategies

Initial strategies:

### huggingface-snapshot

Evidence:

- snapshot directory exists;
- expected repo ID cache path exists;
- required metadata files exist;
- resolved snapshot SHA is captured;
- all expected symlink/blob targets resolve.

### required-files

Evidence:

- configured required files all exist;
- minimum file sizes may be declared;
- optional SHA256 values may be declared.

### checkpoint-config-pair

Used for DiffSinger-style packages:

- config file exists;
- checkpoint glob resolves exactly/at least as specified;
- files are non-empty;
- optional compatibility markers pass.

### sha256

For direct release packages when stable checksums are available.

## 9. Verification severity

Each verification result is one of:

```text
verified
degraded
missing
corrupt
unknown
```

Definitions:

- `verified`: all required invariants pass.
- `degraded`: usable cache exists but optional evidence is missing.
- `missing`: required package absent.
- `corrupt`: package exists but required integrity checks fail.
- `unknown`: inspection could not complete.

Only `verified` is sufficient for a strict provider launch once model-manager
integration is complete.

## 10. License and gated-access metadata

Registry license block:

```text
acceptanceRequired
redistributionAllowed
commercialUse
sourceUrl
notes
```

The registry records policy metadata only.

It must never contain:

- accepted-user identity as authorization proof;
- access tokens;
- copied private license credentials.

For gated models, authorization is tested at initialization time against the
upstream provider.

## 11. Default install behavior

`defaultInstall` controls whether `models:init` without filters attempts the
artifact.

Rules:

- installed/local runtime models => true unless explicitly hardware-profiled;
- planned models => false;
- API-only models => false;
- unreleased models => false;
- optional heavyweight models => false until a workstation profile opts in.

Future workstation profiles may be introduced:

```text
small
workstation-10gb
workstation-24gb
server
```

but v1 should keep selection simple and explicit.

## 12. Model bindings

Example:

```json
{
  "modelId": "diffsinger-acoustic-hifigan",
  "artifacts": [
    "diffsinger-opencpop-acoustic",
    "diffsinger-xiaoma-pitch-estimator",
    "diffsinger-hifigan-vocoder"
  ]
}
```

A model is initialized only when all required artifacts verify.

Bindings also allow multiple application models to share one artifact without
duplicating download definitions.

## 13. Registry/catalog consistency rules

CI/runtime contract tests should fail when:

1. an `installed` local catalog model has no model binding;
2. a binding refers to an unknown catalog model;
3. a binding refers to an unknown artifact;
4. two artifacts claim conflicting exclusive destinations;
5. a local installed model has no verification strategy;
6. a gated artifact omits license/access metadata;
7. an absolute local path appears in the desired-state registry;
8. a secret-like field name appears in registry content.

## 14. Initial v1 registry contents

### MusicGen

Artifacts:

- `facebook/musicgen-small`
- `facebook/musicgen-stereo-small`

Bindings:

- `musicgen-small`
- `musicgen-stereo-small`

### DiffSinger

Artifacts:

- OpenCpop acoustic checkpoint
- Xiaoma pitch estimator
- HiFi-GAN vocoder

Binding:

- `diffsinger-acoustic-hifigan`

### Stable Audio 3

Artifact:

- `stabilityai/stable-audio-3-small-music`

Binding:

- `stable-audio-3-small-music`

## 15. Schema evolution

Schema version starts:

```text
harmonia-model-registry-v1
```

Breaking changes require a new schema version and explicit migration.

The model manager must reject unsupported schema versions rather than guessing.

## 16. Non-goals for v1

- automatic cloud mirroring;
- automatic license acceptance;
- model binary uploads to MongoDB;
- deduplication across unrelated provider cache formats;
- automatic pruning of old snapshots;
- distributed worker synchronization;
- background downloads during application startup.
