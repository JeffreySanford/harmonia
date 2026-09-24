# Phase 8 Mongo Model Installation Metadata

**Status:** Schema implemented, awaiting live Mongo qualification  
**Date:** September 24, 2026  
**Collection:** `model_installations`

## Purpose

Persist operational metadata for locally installed model artifacts while
keeping model bytes on filesystem storage.

MongoDB is advisory operational state. Filesystem verification remains
authoritative for whether an artifact is actually usable.

## One record per physical artifact

The unique identity is:

```text
artifactId
```

Logical models remain derived from registry bindings and are represented in
each record through `modelIds[]` and `runtimeModelIds[]`.

## Fields

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
fileCount
bytes
verificationStrategy
verifiedAt
installedAt
lastUsedAt
licenseAcceptanceRequired
gated
lastError
createdAt
updatedAt
```

### Status

Initial normalized values:

```text
missing
verified
degraded
corrupt
unavailable
failed
```

`verified` is written only after filesystem verification succeeds.

## Path contract

`localPath` is always relative to the configured model root. Absolute
workstation paths are not stored.

## Source/provenance

`sourceRef` contains a repository identifier or public source URL from the
registry.

`sourceRevision` records the resolved/pinned revision when available.

No access token, authorization header, embedded credential, or signed secret
URL is stored.

## Size evidence

`bytes` and `fileCount` describe filesystem evidence collected during deep
verification.

They are metadata only and may be recalculated.

## Timestamp semantics

- `installedAt`: first successful installation timestamp; preserve on later
  verification upserts when already present.
- `verifiedAt`: most recent successful filesystem verification.
- `lastUsedAt`: provider/runtime use timestamp; initially nullable.
- standard Mongoose `createdAt` / `updatedAt` remain enabled.

## Error handling

`lastError` is nullable and sanitized.

A successful verified upsert clears stale `lastError`.

Mongo unavailability must not make model initialization, verification, or
repair fail unless a future explicit `--require-db` mode is used.

## Fresh-database path

`scripts/mongo-init/01-init-harmonia-db.js` creates the collection validator
and indexes for a new Mongo volume.

## Existing-database path

An idempotent schema sync command creates or updates the collection validator
and indexes through the existing root-authenticated Docker Mongo workflow.

No Mongo volume deletion is required.

## Backend schema

Add:

```text
apps/backend/src/schemas/model-installation.schema.ts
```

The Mongoose schema must mirror the Mongo validator and use collection
`model_installations`.

## Initial indexes

```text
{ artifactId: 1 } unique
{ providerId: 1, status: 1 }
{ status: 1, verifiedAt: -1 }
{ modelIds: 1 }
```

## Qualification target

1. Mongo init script defines the validator and indexes;
2. existing-volume schema sync is idempotent;
3. Mongoose schema matches collection/status/required-field contract;
4. invalid status and missing artifact identity are rejected by Mongo;
5. a valid installation document is accepted;
6. unique `artifactId` is enforced;
7. schema stores only relative local paths;
8. backend TypeScript build remains green;
9. existing jobs/users collections remain unchanged;
10. full startup/model regression remains green.

## Completion boundary

Phase 8 schema work is complete when both fresh and existing databases have the
same validated `model_installations` collection and the backend schema
matches it.

The following subphase then connects model-manager verification/init/repair
reports to idempotent operational upserts.
