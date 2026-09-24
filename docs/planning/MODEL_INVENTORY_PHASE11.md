# Phase 11 Portable Observed Model Inventory

**Status:** Complete and locally qualified  
**Date:** September 24, 2026  
**Command:** `pnpm models:inventory`

## Purpose

Replace legacy machine-specific observed model inventory with a portable,
read-only inventory generated from the same deep verification evidence used by
`models:verify`.

The desired-state registry remains authoritative for acquisition. The observed
inventory is evidence of what is present at generation time.

## Source of truth

`models:inventory` reuses `createVerification()`.

It does not:

- scan arbitrary model folders independently;
- infer readiness from MongoDB;
- download or repair artifacts;
- mutate the model root.

## Default scope

With no selectors, inventory includes all registered physical artifacts:

- verified default artifacts;
- optional artifacts that are currently missing;
- any explicit corrupt/unavailable state.

This preserves the full desired-vs-observed picture.

Existing selectors remain supported:

```text
--model <modelId>
--provider <providerId>
--artifact <artifactId>
--root <alternate-root>
--offline
--json
--verbose
```

Inventory is always read-only; `--dry-run`, `--force`, and
`--require-db` have no inventory meaning.

## Output contract

Schema version:

```text
harmonia-model-inventory-v1
```

Top-level fields:

```text
schemaVersion
generatedAt
modelsRoot
summary
artifacts[]
```

Each artifact includes:

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
requiredForSuccess
defaultInstall
gated
verificationStrategy
filesCount
sizeBytes
verifiedAt
detail
```

## Portability rules

- `modelsRoot` is the registry-relative root label, not the resolved
  workstation path;
- `localPath` is always relative to the configured model root;
- no drive letters or absolute Unix paths are emitted;
- source URLs/repository IDs may be emitted because they are registry
  provenance, not local paths;
- access tokens, credentials, Mongo URIs, and generated payloads are forbidden.

## Size/count semantics

`filesCount` and `sizeBytes` use concrete deep-verification checks with
numeric non-negative size evidence.

They intentionally describe the files used to prove the artifact contract, not
every incidental file in a shared Hugging Face cache.

## Verification timestamps

A verified artifact receives the inventory generation timestamp as
`verifiedAt`.

Missing/corrupt/unavailable artifacts receive `verifiedAt: null`.

## Generated files

The command writes:

```text
generated/model-manager/model-inventory.json
generated/model-manager/<timestamp>-inventory.json
```

Both are gitignored runtime evidence.

The stable path is convenient for operators and future disaster-recovery /
license tooling. The timestamped path preserves qualification evidence.

## Historical inventory

`inventory/combined_inventory.json` remains historical evidence until
downstream license/smoke tooling is deliberately migrated.

Phase 11 does not silently rewrite that legacy file.

## Qualification target

1. all eight registered physical artifacts appear in selector-free inventory;
2. operational root reports six verified and two optional missing artifacts;
3. DiffSinger physical artifacts report concrete size/file evidence;
4. Stable Audio reports its pinned/resolved source revision;
5. no absolute local paths are emitted;
6. no credential/token-shaped fields or values are emitted;
7. alternate-root inventory remains path-portable;
8. repeated inventory generation does not modify model bytes;
9. explicit selectors narrow output correctly;
10. stable and timestamped generated inventory files are written;
11. model manager/startup regression remains green.

## Local qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- selector-free inventory emitted all eight registered physical artifacts;
- operational inventory reported six verified artifacts and two optional missing MusicGen Medium artifacts;
- concrete deep-verification evidence covered 15 files totaling 6,852,319,710 bytes;
- DiffSinger acoustic, pitch, and HiFi-GAN artifacts emitted portable size/file evidence;
- Stable Audio preserved pinned revision `0fef1392cd842149a2b6d445e181c97608faac06`; 
- all local artifact paths were registry-relative and generated report paths were repo-relative;
- secret-shaped values were absent;
- repeated inventory generation preserved observed evidence while advancing generation timestamps;
- explicit DiffSinger selector narrowed inventory to the three composite artifacts;
- alternate recovery-root inventory remained portable;
- pre/post deep verification evidence was unchanged, proving inventory generation did not mutate model bytes;
- full startup/model regression finished with 137 passing tests, zero failures, and one intentionally skipped Compose lifecycle test.

## Completion boundary

Phase 11 is complete when Harmonia can produce a portable, normalized,
read-only observed model inventory from the same evidence that governs runtime
readiness.
