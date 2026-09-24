# Model Installation MongoDB Schema Design

**Status:** Planning specification  
**Date:** September 23, 2026  
**Parent architecture:** [../MODEL_STORAGE_AND_REHYDRATION.md](../MODEL_STORAGE_AND_REHYDRATION.md)

## 1. Purpose

Define the operational MongoDB representation of locally installed model
artifacts.

MongoDB is not the binary store. It records what Harmonia believes is installed,
where it is, how it was obtained, how it was verified, and when it was last
used.

## 2. Persistence granularity

One document represents one physical registry `artifactId` on one machine.

This is intentionally different from one document per application model.

Example:

```text
diffsinger-acoustic-hifigan
        |
        +-- diffsinger-opencpop-acoustic
        +-- diffsinger-xiaoma-pitch-estimator
        +-- diffsinger-hifigan-vocoder
```

Each physical artifact can fail, verify, repair, or change revision
independently.

Logical model readiness is derived from the registry binding.

## 3. Initial single-workstation key

Unique:

```text
artifactId
```

Future distributed form:

```text
machineId + artifactId
```

The schema should leave room for `machineId`, but v1 does not need to block
local implementation on fleet identity design.

## 4. Proposed Mongoose fields

```text
artifactId: string
providerId: string
modelIds: string[]
runtimeModelIds: string[]

source:
  kind: string
  ref: string
  revision: string | null
  gated: boolean

storage:
  rootId: string
  relativePath: string
  bytes: number | null
  fileCount: number | null

verification:
  strategy: string
  status: string
  verifiedAt: Date | null
  details: object | null

lifecycle:
  status: string
  installedAt: Date | null
  lastAttemptAt: Date | null
  lastUsedAt: Date | null

license:
  acceptanceRequired: boolean
  commercialUse: string

lastError:
  code: string | null
  message: string | null
  occurredAt: Date | null

createdAt
updatedAt
```

## 5. Status enum

Operational lifecycle:

```text
missing
planning
downloading
verifying
installed
degraded
repairing
failed
```

Verification status:

```text
unknown
verified
degraded
missing
corrupt
```

Separate fields avoid conflating "currently downloading" with "last
verification result".

## 6. Source reference

Normalize source identity into non-secret values.

Hugging Face:

```text
kind = huggingface
ref = stabilityai/stable-audio-3-small-music
revision = 0fef1392...
```

HTTP ZIP:

```text
kind = http-zip
ref = https://github.com/.../0228_opencpop_ds100_rel.zip
revision = pretrain-model/0228_opencpop_ds100_rel
```

No query-string secrets are permitted in `ref`.

## 7. Storage identity

`rootId` allows Mongo records to avoid absolute workstation paths.

Initial value:

```text
local-default
```

Stored path:

```text
stable-audio-3/huggingface
```

not:

```text
D:\repos\harmonia\models\stable-audio-3\huggingface
```

The running application resolves `rootId + relativePath` through configuration.

This keeps Mongo portable across workstation restore.

## 8. Verification details

Verification details are provider/source-specific but bounded.

Examples:

Hugging Face:

```json
{
  "snapshotRevision": "0fef1392...",
  "requiredFilesPresent": true
}
```

DiffSinger:

```json
{
  "configPresent": true,
  "checkpointFiles": [
    "model_ckpt_steps_160000.ckpt"
  ]
}
```

Do not store giant file manifests in the primary document.

Large detailed verification evidence belongs in generated reports or a future
audit collection.

## 9. Error sanitization

Before persistence:

- redact `hf_...`;
- redact bearer tokens;
- redact known environment secret values;
- strip authentication headers;
- bound message length.

Suggested maximum persisted message:

```text
4000 characters
```

Use stable error codes such as:

```text
MISSING_CREDENTIAL
GATED_ACCESS_DENIED
NETWORK_FAILURE
INSUFFICIENT_DISK
VERIFICATION_FAILED
REVISION_MISMATCH
PROVIDER_ACTIVE
```

## 10. Indexes

v1:

```text
unique artifactId
providerId + lifecycle.status
modelIds
verification.status + updatedAt
lifecycle.lastUsedAt
```

Future fleet:

```text
unique machineId + artifactId
machineId + providerId + lifecycle.status
```

## 11. Upsert semantics

The model manager owns installation-state writes.

Upsert key:

```text
artifactId
```

On successful verification:

- source revision;
- relative path;
- bytes/fileCount;
- verification status/details;
- verifiedAt;
- lifecycle status=installed;
- installedAt set on first successful install only;
- lastError cleared.

On failed attempt:

- do not erase last known verified metadata unnecessarily;
- lifecycle status reflects failure;
- lastError updated;
- verification status reflects filesystem truth.

## 12. Model readiness derivation

Given registry binding:

```text
modelId -> artifactIds[]
```

A logical model is ready when every required artifact satisfies:

```text
lifecycle.status = installed
AND verification.status = verified
```

However, filesystem verification remains authoritative.

If Mongo says installed but disk inspection says missing:

1. model is not ready;
2. reconcile Mongo to missing/degraded;
3. do not launch provider.

If disk verifies but Mongo record is absent:

1. model may be considered locally usable;
2. upsert Mongo asynchronously/explicitly;
3. do not redownload solely because DB state is absent.

## 13. Provider use tracking

When a model generation begins successfully, update `lastUsedAt` for each
artifact required by its registry binding.

This supports future:

- cache pruning decisions;
- storage reporting;
- operational dashboards.

Failure to update `lastUsedAt` must not fail inference.

## 14. Startup reconciliation

Startup may perform a lightweight reconciliation:

- load registry;
- read Mongo installation records;
- inspect only inexpensive local markers;
- flag obvious drift.

Startup must not:

- hash multi-GB files;
- download models;
- block for full verification;
- require gated remote access.

Deep verification remains an explicit model-manager command.

## 15. Mongo availability

Model manager commands work without Mongo unless `--require-db` is set.

When DB is unavailable:

```text
filesystem result = authoritative
local report = written
Mongo sync = warning
command success = allowed
```

This is essential for disaster recovery.

## 16. Migration from current state

No existing collection needs destructive migration.

Initial rollout:

1. create schema/module;
2. run `models:verify` against current local caches;
3. upsert resulting artifact records;
4. compare logical model readiness with current runtime catalog;
5. only later make runtime selection consume this state.

This means Mongo adoption begins as observational metadata, then becomes part of
readiness gating only after qualification.

## 17. API exposure

Potential future read endpoints:

```text
GET /api/music/models/installations
GET /api/music/models/:modelId/readiness
```

Mutating download/repair APIs are out of scope for initial implementation.
Model initialization remains an operator CLI until authentication,
authorization, concurrency, disk quotas, and UX are fully designed.

## 18. Security

Mongo documents must never include:

- Hugging Face tokens;
- API keys;
- Authorization headers;
- signed download URLs with credentials;
- model checkpoint bytes.

Access to installation inventory should follow ordinary authenticated operator
permissions if/when exposed through HTTP.
