# Phase 4 Hugging Face Initialization Adapter

**Status:** Complete and locally qualified
**Date:** September 24, 2026
**Scope:** MusicGen and Stable Audio 3
**Future command:** `pnpm models:init`

## Purpose

Add the first mutation-capable model lifecycle adapter while preserving the
verified developer cache.

The implementation is now present in `scripts/model-manager.cjs`; qualification
remains intentionally scoped to alternate roots before any recovery workflow is
allowed to target the default workstation cache.

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

The adapter invokes `huggingface_hub.snapshot_download` inside a short-lived
container with the selected destination mounted read-write.

For pinned artifacts, the adapter also writes the local `refs/main` cache alias
to the resolved qualified snapshot. This is required because provider loaders
such as Stable Audio 3 resolve the default `main` ref even when Harmonia's
registry pins an exact commit.

The ref file must contain the exact commit SHA with no trailing newline.
Hugging Face Hub 1.32 reads the cached ref without trimming whitespace during
offline fallback; a newline therefore produces a snapshot lookup that cannot
match the real cache path. `models:init` normalizes this metadata on both a
fresh download and an existing verified cache hit.

The alias changes local cache metadata only; it does not alter the remote
repository or registry revision.

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

## Local qualification result

Qualified locally on September 24, 2026.

The alternate-root recovery cache reached approximately 21 GB and proved:

- MusicGen Small rehydrates from an empty root;
- MusicGen Stereo Small rehydrates from an empty root;
- shared MusicGen EnCodec/T5 repositories are restored;
- both MusicGen variants load with Docker networking disabled;
- Stable Audio 3 Small-Music rehydrates at the pinned qualified revision;
- Stable Audio 3 model config, 2.27 GB weights, bundled T5 config/weights,
  and tokenizer all deep-verify;
- Stable Audio 3 loads through the real provider loader with Docker
  networking disabled;
- repeated initialization is a pure cache hit;
- the original workstation `models/` cache remains unchanged and green;
- the full startup/model regression suite remains green.

Qualification also exposed and fixed a Hugging Face Hub 1.32 cache-ref
compatibility detail: pinned `refs/main` must contain the exact commit SHA
without a trailing newline.

`models:init` is now qualified for Harmonia's Hugging Face-backed models.
The next recovery adapter is the DiffSinger HTTP-ZIP source.

## Completion criterion

Phase 4 completion criteria are satisfied:

- [x] MusicGen Small initializes and verifies from an empty alternate root;
- [x] MusicGen Stereo Small initializes and verifies from an empty alternate root;
- [x] shared runtime dependencies are restored;
- [x] Stable Audio 3 initializes at the pinned revision;
- [x] all three HF-backed models load completely offline;
- [x] repeated initialization is idempotent;
- [x] gated/offline failure contracts do not leak credentials;
- [x] the default workstation cache remains untouched.
