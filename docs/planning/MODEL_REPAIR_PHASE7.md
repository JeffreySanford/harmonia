# Phase 7 Conservative Model Repair

**Status:** Complete and locally qualified  
**Date:** September 24, 2026  
**Command:** `pnpm models:repair`  
**Engine:** `scripts/model-repair.cjs`

## Purpose

Add a conservative repair workflow after model planning, deep verification,
safe initialization, and complete default-set recovery have all been locally
qualified.

The governing rule remains:

> Never turn a known-good verified model cache into a worse state as a side
> effect of repair.

## Selection

Repair uses the same selector contract as plan/init/verify:

```text
--model <modelId>
--provider <providerId>
--artifact <artifactId>
--root <path>
--offline
--dry-run
--force
--json
--verbose
```

Without explicit selectors, repair targets the same `defaultInstall=true`
artifact set as selector-free `models:init`.

## Artifact behavior

### verified

A deeply verified artifact is a no-op:

```text
state=verified
action=none
```

Repair never replaces or re-downloads a verified artifact.

### missing with no final destination

A truly absent artifact may be restored through the already-qualified source
adapter without `--force`.

### incomplete HTTP-ZIP destination

A non-empty/incomplete DiffSinger final destination is preserved by default.

Without `--force`:

```text
action=force-required
```

No downloader runs and no final path changes.

With `--force`:

1. move the existing final destination into a root-local quarantine path;
2. run the qualified staged HTTP-ZIP initializer;
3. deep-verify the new final artifact;
4. retain the quarantined original as recovery evidence.

### Hugging Face cache repair

Missing HF blobs/runtime dependency repositories may be resumed by the existing
HF adapter because the cache itself is resumable.

A verified pinned snapshot is never replaced.

Pinned revision mismatch or an existing non-empty cache that cannot be safely
reconciled automatically remains a force-required condition in this initial
phase.

## Quarantine

Forced replacement uses:

```text
<modelsRoot>/.quarantine/<artifactId>/<operationId>/
```

The quarantined directory is never silently deleted by the same repair
operation.

Report fields include:

```text
quarantinePath
operationId
beforeState
afterState
```

Paths stored in reports remain relative to the configured model root.

## Failure behavior

If replacement download/verification fails after quarantine:

- the new final destination must not be reported verified;
- the quarantine remains available;
- the result identifies the failed repair;
- unrelated artifact directories remain untouched.

Automatic rollback may be added later, but Phase 7 must never destroy the
quarantined original.

## Offline behavior

`models:repair --offline`:

- verified artifacts succeed as no-ops;
- missing/incomplete artifacts fail without network access;
- no quarantine or source mutation occurs.

## Dry run

`--dry-run` must report:

- no-op verified artifacts;
- missing artifacts that would be restored;
- incomplete artifacts that require `--force`;
- forced repairs that would quarantine and replace;

without mutating the model root.

## Initial qualification

1. verified fixture is untouched;
2. absent public HF artifact repairs through the HF adapter;
3. partial DiffSinger destination returns `force-required` without force;
4. partial DiffSinger destination is quarantined with `--force`;
5. forced DiffSinger replacement verifies after staged initialization;
6. quarantine retains the sentinel from the old partial directory;
7. offline partial repair performs no mutation;
8. dry-run performs no mutation;
9. complete 23 GB recovery root returns six no-op verified artifacts;
10. original workstation cache remains green;
11. full startup/model regression remains green.

## Local qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- a complete reconstructed default root returned six repair no-ops;
- missing MusicGen runtime dependencies repaired safely through the resumable
  Hugging Face cache path without requiring force;
- incomplete DiffSinger content returned `force-required` without mutation;
- forced DiffSinger repair quarantined the old directory before replacement;
- the quarantine preserved the original sentinel evidence;
- the replacement deep-verified successfully;
- a second repair was an offline no-op;
- offline incomplete repair preserved the original directory and created no
  quarantine content;
- the complete 23 GB recovery root and original workstation cache remained
  unchanged and green;
- the full startup/model suite finished with 110 passing tests, zero failures,
  and one intentionally skipped Compose lifecycle test.

`models:repair` is now qualified for the Phase 7 conservative repair scope.

## Completion criterion

Phase 7 completion criteria are satisfied:

- [x] verified artifacts remain untouched;
- [x] missing resumable HF content repairs safely;
- [x] suspect DiffSinger destinations require explicit force;
- [x] forced replacement quarantines rather than deletes;
- [x] offline and dry-run paths do not mutate incomplete content;
- [x] the fully reconstructed default root is a repair no-op.
