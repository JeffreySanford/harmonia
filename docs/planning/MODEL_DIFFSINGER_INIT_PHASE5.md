# Phase 5 DiffSinger HTTP-ZIP Initialization Adapter

**Status:** Implemented, awaiting alternate-root qualification  
**Date:** September 24, 2026  
**Scope:** DiffSinger acoustic, pitch-estimator, and HiFi-GAN packages  
**Command:** `pnpm models:init --provider diffsinger`

## Purpose

Extend `models:init` beyond Hugging Face caches so Harmonia can rebuild the
three physical packages required by the logical
`diffsinger-acoustic-hifigan` model.

The adapter must use the desired-state registry as the source of truth and must
not reuse the destructive extraction behavior from the provider entrypoint.

## Source packages

The registry defines three public HTTP ZIP sources:

- `diffsinger-opencpop-acoustic`;
- `diffsinger-xiaoma-pitch-estimator`;
- `diffsinger-hifigan-vocoder`.

The vocoder archive root is named
`0109_hifigan_bigpopcs_hop128` while the canonical Harmonia cache destination
is `diffsinger/hifigan`.

## Safety contract

Each package initialization must:

1. download into a root-local staging area;
2. use bounded retry for transient HTTP failures;
3. reject unsafe ZIP paths before extraction;
4. reject ZIP symlink entries;
5. extract only inside staging;
6. locate the expected archive root or an unambiguous package root;
7. require the configured files and checkpoint globs;
8. require verified files to be non-empty;
9. refuse to replace a non-empty final destination during ordinary init;
10. atomically rename verified staged content into the final destination;
11. clean successful staging data;
12. preserve the existing final cache if any step fails.

Staging lives under:

```text
<modelsRoot>/.staging/<artifactId>/<operationId>/
```

## Runtime environment

Use the pinned Harmonia DiffSinger compatibility image:

```text
harmonia/diffsinger:dev
```

The image already contains:

- Python 3.8;
- `curl`;
- `unzip`;
- the pinned OpenVPI DiffSinger source revision.

The alternate model root is mounted read-write at `/workspace/models`.

## Archive validation

Before extraction, every ZIP member is normalized to POSIX separators.

Reject a member when:

- it is absolute;
- it contains a `..` path segment;
- it encodes a Windows drive path;
- it is a symbolic link.

No archive member may resolve outside the staging extraction directory.

## Verification before promotion

The staged candidate must satisfy the same registry contract as
`models:verify`.

For each current package this means:

- `config.yaml` exists, is a regular file, and is non-empty;
- at least one `model_ckpt_steps_*.ckpt` exists;
- every selected checkpoint used as evidence is a regular non-empty file.

Only then may the candidate be renamed into its final destination.

## Idempotence

A verified existing package is a `cache-hit` and performs no download.

A non-empty but incomplete destination is not automatically overwritten by
`models:init`. It returns a repair-required failure; destructive/quarantine
semantics belong to `models:repair`.

## Offline behavior

`models:init --offline`:

- succeeds for verified existing packages;
- fails for missing/incomplete packages;
- makes no network request;
- makes no final model mutation.

## Python 3.8 qualification preflight

The pinned DiffSinger image uses Python 3.8. Qualification should parse the
initializer without attempting to write bytecode beside the read-only
`/workspace/scripts` mount. Use either in-memory `compile(...)` or direct
`py_compile.compile(..., cfile="/tmp/...")`.

Do not use the default `py_compile` output path against a read-only scripts
mount because it tries to create `/workspace/scripts/__pycache__`.

## Qualification target

Use a fresh alternate root and prove:

1. fixture tests for all adapter states;
2. dry-run does not create model payloads;
3. the three real release ZIPs download;
4. each package deep-verifies;
5. the logical DiffSinger model verifies only when all three packages verify;
6. second initialization is three cache hits;
7. a deliberately incomplete destination is not overwritten;
8. the recovered package tree can be mounted into the pinned DiffSinger image;
9. the provider bootstrap reaches its readiness sentinel without downloading;
10. the original workstation `models/` cache remains unchanged;
11. the full startup/model regression suite remains green.

## Completion criterion

Phase 5 is complete when an empty alternate root can be populated with all
three DiffSinger packages through `models:init --provider diffsinger`,
deep-verified, mounted into the pinned provider image without further package
download, and reinitialized idempotently while the working cache remains
untouched.
