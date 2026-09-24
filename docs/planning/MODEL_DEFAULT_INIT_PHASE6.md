# Phase 6 Default-Set Initialization Orchestration

**Status:** Planned  
**Date:** September 24, 2026  
**Command:** `pnpm models:init`

## Purpose

Finish the canonical initialization workflow promised by the model-manager CLI:

```bash
pnpm models:init
pnpm models:init --root generated/qualification-runtime/models
```

Without explicit selectors, `models:init` initializes exactly the registry
artifacts marked `defaultInstall=true`.

Explicit selectors continue to override default-install filtering so optional
artifacts such as MusicGen Medium can be initialized deliberately.

## Default selection

The current default physical artifact set is:

1. MusicGen Small;
2. MusicGen Stereo Small;
3. DiffSinger OpenCpop acoustic;
4. DiffSinger Xiaoma pitch estimator;
5. DiffSinger HiFi-GAN vocoder;
6. Stable Audio 3 Small-Music.

The two MusicGen Medium variants remain excluded because
`defaultInstall=false`.

The default logical model set therefore contains:

- `musicgen-small`;
- `musicgen-stereo-small`;
- `diffsinger-acoustic-hifigan`;
- `stable-audio-3-small-music`.

## Safety contract

Selector-free init must preserve all previously qualified source-adapter
behavior.

In addition:

- missing gated prerequisites are evaluated before any network mutation;
- if Stable Audio is missing and no supported Hugging Face credential is
  configured, the default initialization returns a structured authentication
  prerequisite result without downloading any other missing default artifact;
- `--dry-run` remains mutation-free and may report all planned downloads plus
  authentication prerequisites;
- `--offline` performs no network access;
- a complete default root requires no credential and returns cache hits;
- optional `defaultInstall=false` artifacts are never selected implicitly.

## Result semantics

When a selector-free mutating init is blocked by a missing gated credential:

- the gated artifact uses `action=authenticate`;
- other missing default artifacts use `action=blocked-prerequisite`;
- verified artifacts remain `action=cache-hit`;
- no source adapter executor is invoked;
- `summary.authenticationRequired` reflects gated prerequisites;
- `summary.prerequisiteBlocked` reflects deferred artifacts;
- `ok=false`.

This keeps the result machine-readable while guaranteeing all-or-nothing
network startup for the default recovery operation.

## Qualification target

1. fixture: bare init selects six physical default artifacts, not eight;
2. fixture: complete default root returns six cache hits;
3. fixture: empty root without HF credentials invokes zero download executors;
4. fixture: missing Stable Audio credential reports one authentication
   prerequisite and blocks the other five default artifacts;
5. fixture: dry-run reports five public/source downloads plus gated auth without
   mutation;
6. fixture: explicit optional MusicGen Medium selection still works;
7. real complete 23 GB recovery root returns six cache hits from bare init;
8. real working cache remains unchanged;
9. full startup/model regression remains green.

## Completion criterion

Phase 6 is complete when selector-free `models:init` safely represents and
operates the default registry set, blocks before mutation when required gated
credentials are unavailable, remains idempotent on the fully reconstructed
recovery root, and never selects optional Medium artifacts implicitly.
