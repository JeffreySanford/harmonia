# Phase 2 Model Plan Semantics

**Status:** Implemented, awaiting local qualification  
**Date:** September 23, 2026  
**Command:** `pnpm models:plan`

## Purpose

Phase 2 introduces the first executable model-lifecycle command.

It is intentionally read-only with respect to model state:

- no network requests;
- no provider startup;
- no Docker mutation;
- no model download;
- no repair;
- no Mongo writes.

The only write is a gitignored JSON report under
`generated/model-manager/`.

## Planning inspection vs deep verification

`models:plan` answers:

> Based on the registry and inexpensive local markers, what action would
> Harmonia take?

It does **not** answer:

> Have every byte/checksum and every provider-specific compatibility invariant
> been deeply verified?

That second question belongs to the planned `models:verify` command.

For Phase 2, the state label `verified` means:

- the expected local artifact/snapshot exists;
- registry-required marker files exist;
- required checkpoint filename patterns resolve;
- a pinned Hugging Face snapshot matches when applicable.

It does not yet mean:

- every large blob has been hashed;
- every model can be instantiated;
- CUDA/provider runtime compatibility has been retested;
- remote access remains available.

Provider runtime qualifications remain independent evidence.

## States

### verified

Marker-level evidence is complete.

Planned action:

```text
none
```

unless policy changes later.

### missing

No usable local artifact/snapshot was found.

Default installed artifact:

```text
download
```

Gated artifact without configured credential:

```text
authenticate
```

Optional artifact not explicitly selected:

```text
skipped-default
```

### degraded

Artifact/cache exists but required marker files or checkpoint patterns are
missing.

Action:

```text
repair
```

The Phase 2 planner only reports this; it performs no repair.

### revision-mismatch

A pinned source revision is required, but the cache resolves another revision.

Action:

```text
review-revision
```

Phase 2 never silently upgrades or downgrades.

### unknown

The registry uses a verification strategy the current planner does not
understand.

Action:

```text
inspect
```

Unknown is never promoted to ready.

## Default versus explicit selection

Without selectors, the plan includes all current installed model bindings so
operators can see optional models too.

For artifacts with:

```text
defaultInstall=false
```

the planner reports their real local state but gives:

```text
action=skipped-default
```

when they are not explicitly requested.

An explicit:

```text
--model
--provider
--artifact
```

selection authorizes the planner to show the action that would be required for
that optional artifact.

It still performs no mutation.

## Current workstation policy

The default installation set contains:

- MusicGen Small;
- MusicGen Stereo Small;
- DiffSinger OpenCpop acoustic;
- DiffSinger Xiaoma pitch estimator;
- DiffSinger HiFi-GAN vocoder;
- Stable Audio 3 Small-Music.

MusicGen Medium and Stereo Medium remain known registry artifacts but are
`defaultInstall=false` on the current workstation profile.

## Hugging Face inspection

For a Hugging Face artifact, the planner examines the provider's persistent
cache root:

```text
<destination>/hub/models--<org>--<repo>/
```

It resolves:

1. pinned registry revision when present;
2. otherwise `refs/main` when available;
3. otherwise an available snapshot directory.

It then checks the registry's required marker files.

For Stable Audio 3 Small-Music, the registry is pinned to the exact snapshot
that passed Harmonia qualification.

## DiffSinger inspection

For direct checkpoint packages, the planner checks:

- artifact directory exists;
- required files such as `config.yaml` exist;
- configured checkpoint patterns such as
  `model_ckpt_steps_*.ckpt` resolve recursively.

All three DiffSinger physical artifacts must be present for the logical model
to report marker-level verified.

## Authentication semantics

Planning never authenticates remotely.

For gated Hugging Face artifacts it reports only whether a supported local
credential appears configured.

If the gated artifact is already locally complete, missing credentials do not
turn the cached model into missing.

If the gated artifact is missing and no credential is configured, action is:

```text
authenticate
```

Actual identity/access validation belongs to initialization.

## Report contract

Each plan writes:

```text
generated/model-manager/<timestamp>-plan.json
```

The report contains:

- command/result schema version;
- selected models/artifacts;
- state and action;
- source kind/reference;
- expected/resolved revision;
- relative storage path;
- gated/auth presence;
- summary counts;
- current implementation warnings.

It does not contain tokens or absolute destination paths from registry state.

## Selector qualification

Phase 2 qualification must exercise:

1. default plan against the real workstation cache;
2. `--provider diffsinger`;
3. `--model stable-audio-3-small-music`;
4. explicit optional `--model musicgen-medium`;
5. alternate empty `--root`;
6. `--json` output;
7. invalid selector failure;
8. script/startup contract gates.

The alternate-root run is especially important because it proves planning can
describe recovery without touching the real cache.

## Phase 2 completion criterion

Phase 2 is complete when:

- fixture tests pass;
- the command parses and is package-exposed;
- real cache plan is accurate enough to explain all eight artifacts;
- current qualified Small/DiffSinger/Stable assets are detected correctly;
- optional Medium artifacts are not scheduled by default;
- empty alternate root produces download/authenticate/skipped actions without
  creating model data;
- no secrets appear in output/reports.
