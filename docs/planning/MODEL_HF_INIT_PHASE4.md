# Phase 4 Hugging Face Initialization Adapter

**Status:** Planned  
**Date:** September 24, 2026  
**Scope:** MusicGen and Stable Audio 3  
**Future command:** `pnpm models:init`

## Purpose

Add the first mutation-capable model lifecycle adapter while preserving the
verified developer cache.

Phase 4 is limited to Hugging Face sources. DiffSinger HTTP ZIP recovery,
MongoDB installation state, and runtime gating remain later work.

## Safety contract

Qualification must use an alternate model root. The default developer
`models/` cache must not be modified.

Initialization must:

- resolve only selected registry artifacts;
- honor `--root`;
- support `--offline` without network access;
- require credentials for gated repositories before download;
- never print or persist access tokens;
- reuse complete existing snapshots;
- capture the resolved source revision;
- verify downloaded content with the Phase 3 verifier;
- return failure rather than declaring success when verification fails.

## Hugging Face adapter

Use the provider-compatible Linux environment so cache layout matches runtime:

- MusicGen: `harmonia/musicgen:dev`;
- Stable Audio 3: `harmonia/stable-audio-3:dev`.

The adapter may invoke `huggingface_hub.snapshot_download` inside a short-lived
container with the selected destination mounted read-write.

For qualification, downloads go only to an alternate root under
`generated/model-manager/`.

## Authentication

Public MusicGen repositories require no token.

Stable Audio 3 is gated. The adapter accepts existing supported aliases without
printing their values:

- `HF_TOKEN`
- `HUGGINGFACE_API_KEY`
- `HUGGING_FACE_HUB_TOKEN`
- `HUGGINGFACE_HUB_TOKEN`

Missing credential must fail before network mutation for gated artifacts.

## Idempotence

A second initialization of an already verified selected artifact must be a
cache hit and perform no unnecessary download.

## Initial qualification target

1. unit tests with injected adapter executor;
2. dry-run against an empty alternate root;
3. real MusicGen Small initialization into an empty alternate root;
4. Phase 3 verify succeeds against that alternate root;
5. second init reports cache hit;
6. offline init of missing artifact fails without mutation;
7. gated Stable Audio missing-token path fails secret-safely;
8. default developer `models/` tree remains unchanged.

Large Stable Audio rehydration may be qualified separately after public
MusicGen initialization proves the adapter mechanics.

## Completion criterion

Phase 4 is complete when the public MusicGen Small adapter can populate and
re-verify an empty alternate root idempotently, and the gated/offline failure
contracts are covered without leaking credentials or touching the working
cache.
