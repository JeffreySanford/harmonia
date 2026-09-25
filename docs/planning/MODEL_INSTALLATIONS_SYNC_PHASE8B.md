# Phase 8B Filesystem-to-Mongo Installation Synchronization

**Status:** Complete and locally qualified
**Date:** September 24, 2026
**Command:** `pnpm models:db-sync`

## Purpose

Project deep filesystem verification evidence into MongoDB operational metadata
without making MongoDB authoritative for model readiness.

Filesystem verification remains the source of truth. MongoDB is a queryable,
durable cache of the most recently observed installation state.

## Source of truth

Phase 8B synchronizes from the same artifact rows produced by
`models:verify`.

It does not infer installation state from:

- a prior init action;
- a repair action label;
- a provider process being present;
- MongoDB's previous record.

This means synchronization always records the state that deep verification can
currently prove.

## Explicit command first

Initial operator command:

```bash
pnpm models:db-sync
pnpm models:db-sync --model musicgen-small
pnpm models:db-sync --root generated/model-manager/phase4-hf-recovery/models
```

Selectors use the existing model-manager contract.

The default command inspects all registered artifacts so optional models may be
represented as `missing` rather than silently disappearing from operational
inventory.

## Evidence projection

For each physical artifact:

```text
artifactId              registry + verification
providerId              registry
modelIds[]              registry bindings
runtimeModelIds[]       registry
sourceKind              registry
sourceRef               registry
sourceRevision          resolved revision, then pinned revision, else null
localPath               registry-relative destination
status                  verification state
fileCount               number of concrete file checks with numeric size evidence
bytes                   sum of non-negative numeric check sizes
verificationStrategy    registry
verifiedAt              sync time only when state=verified
installedAt             first time the record reaches verified; preserved forever
lastUsedAt              preserved by synchronization
licenseAcceptanceRequired registry
gated                   registry
lastError               sanitized verification detail when not verified; null when verified
createdAt               first insert
updatedAt               each synchronization
```

## Timestamp rules

### installedAt

If a record is already present:

- preserve any existing `installedAt`;
- if it has never been installed and the new state is `verified`, set it now;
- later missing/corrupt states do not erase it.

### verifiedAt

- refresh on every successful verified synchronization;
- set to null for the current observation when verification is not successful.

### lastUsedAt

Phase 8B never modifies `lastUsedAt`.

Runtime/provider integration owns that field later.

## Error sanitization

`lastError` is bounded and sanitized before storage.

At minimum:

- URI userinfo/password material is redacted;
- common token-shaped key/value forms are redacted;
- whitespace is normalized;
- stored error text is length-bounded.

A verified observation clears stale `lastError`.

## Mongo availability

Default behavior is advisory:

- verification still completes when MongoDB is unavailable;
- the command returns the filesystem result plus a database warning;
- no model filesystem content is changed.

With `--require-db`, MongoDB synchronization failure is fatal.

## Connection configuration

Connection resolution order:

1. process `MONGODB_URI`;
2. repository `.env` `MONGODB_URI`;
3. construct the established local application URI from
   `MONGO_HARMONIA_PASSWORD`.

Connection strings are never emitted in normal or JSON output.

## Idempotence

Repeated synchronization of unchanged verified filesystem state:

- updates `verifiedAt` / `updatedAt`;
- preserves `installedAt`;
- preserves `lastUsedAt`;
- leaves exactly one record per `artifactId`.

## Phase 8B qualification

1. projection from fixture verification produces portable metadata;
2. fileCount/bytes use only concrete deep-verification checks;
3. first verified upsert sets installedAt;
4. repeated verified upsert preserves installedAt;
5. later missing state preserves installedAt and stores sanitized lastError;
6. later successful verification clears lastError;
7. Mongo outage is advisory by default;
8. `--require-db` makes outage fatal;
9. live sync against the operational `models/` root upserts all eight registry
   artifacts;
10. six installed defaults are verified and two optional Medium variants are
    missing;
11. second live sync remains eight records with preserved installedAt;
12. no model cache files are modified;
13. the separate reconstructed recovery root remains untouched;
14. full startup/model regression remains green.

## Local qualification result

Qualified against the operational `models/` root and live MongoDB on
September 24, 2026.

Observed behavior:

- eight operational artifact records were synchronized;
- six installed/default artifacts were `verified` and the two optional
  MusicGen Medium variants were `missing`;
- a second sync preserved `installedAt` and `lastUsedAt` while refreshing
  verification metadata;
- Mongo unavailability remained advisory by default;
- `--require-db` made the same outage fatal;
- operational and recovery model roots both remained green;
- jobs/users counts remained unchanged;
- the full startup/model suite finished with 119 passing tests, zero
  failures, and one intentionally skipped Compose lifecycle test.

Phase 8B is complete. Automatic post-init/post-repair synchronization is
the next integration boundary.

## Completion boundary

Phase 8B is complete when deep verification evidence can be synchronized
idempotently into the live `model_installations` collection while Mongo
remains advisory to filesystem recovery.

Automatic post-init/post-repair synchronization is the next integration step
after this command is qualified.
