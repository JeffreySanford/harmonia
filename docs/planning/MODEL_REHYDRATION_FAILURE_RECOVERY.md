# Model Rehydration Failure and Recovery Semantics

**Status:** Planning specification
**Date:** September 23, 2026

## 1. Purpose

Define what Harmonia does when model initialization is interrupted, denied,
corrupt, partially complete, low on disk space, or unable to update MongoDB.

The core rule is:

> Never turn a known-good verified model cache into a worse state as a side
> effect of initialization or repair.

## 2. Lifecycle state machine

Operational state:

```text
missing
  |
  v
planning
  |
  v
downloading
  |
  v
verifying
  |
  +----> installed
  |
  +----> degraded
  |
  +----> failed
```

Repair path:

```text
degraded/corrupt/failed
        |
        v
     repairing
        |
        v
     verifying
        |
        +----> installed
        +----> failed
```

MongoDB state is advisory/operational. Filesystem verification is authoritative
for whether bytes are actually present.

## 3. Temporary download strategy

Direct downloads should use staging paths:

```text
models/.staging/<artifactId>/<operationId>/
```

Only after verification succeeds is content promoted into the final destination.

For cache systems such as Hugging Face that already implement resumable blob
caches, Harmonia may use the provider cache directly but must still verify the
resolved snapshot before declaring installation complete.

## 4. Interruption recovery

If the process is terminated:

- known-good final directories remain untouched;
- staging content may remain;
- next `models:plan` identifies abandoned staging operations;
- `models:repair` may resume or discard only incomplete staging content;
- automatic deletion of final verified data is forbidden.

A staging operation includes metadata:

```text
operationId
artifactId
startedAt
source
target
state
```

This may be a small JSON file within staging; it does not need MongoDB.

## 5. Disk-space failure

Before download, estimate required free space when source size is known.

Policy:

- refuse to start when known required bytes exceed available safety margin;
- if exact source size is unknown, warn and monitor;
- preserve already downloaded resumable cache content;
- report required/available bytes without exposing unrelated filesystem data.

Recommended safety margin:

```text
max(2 GiB, estimated download size * 15%)
```

This should remain configurable.

## 6. Authentication failures

Categories:

```text
missing-credential
invalid-credential
gated-access-denied
rate-limited
network-unreachable
```

Messages must distinguish them.

For gated access:

- identify repository/model;
- identify authenticated username when safely available;
- do not print token;
- tell user to accept access terms or adjust token permissions;
- leave cache intact.

## 7. Network failures

Use bounded retry with exponential backoff for transient failures.

Do not retry indefinitely.

Suggested initial policy:

```text
attempts: 4
base delay: 2s
max delay: 20s
```

HTTP 401/403 are not transient retries.

HTTP 429 and 5xx may be retried according to Retry-After where provided.

## 8. Checksum/integrity failure

If downloaded content fails verification:

- mark artifact `corrupt`;
- retain failure evidence;
- do not promote staging content;
- do not overwrite verified final data;
- `models:repair` redownloads only failed/missing portions when supported.

If a previously verified final cache later fails integrity checks, repair must
require explicit action and should preserve/quarantine suspect data before
replacement where disk permits.

## 9. Source revision drift

If registry requests revision A but local cache resolves revision B:

```text
status = degraded or corrupt
reason = revision-mismatch
```

Default init does not silently replace a complete but mismatched installation
unless the operation is explicitly an upgrade/repair.

Version upgrades should eventually become a separate command or explicit flag.

## 10. MongoDB unavailable

`models:init` and `models:verify` must still work when MongoDB is down.

Behavior:

1. reconcile/verify disk;
2. write local machine-readable report;
3. warn that operational DB state could not be updated;
4. exit success if model initialization itself succeeded.

Later reconciliation can upsert Mongo state.

Mongo must not become a dependency required to recover Mongo's own environment.

## 11. Provider running during repair

Never modify the final model files of an actively running provider.

Before destructive repair:

- detect provider/container ownership;
- refuse with actionable message, or
- require provider shutdown through the runtime orchestrator.

Read-only verification may run while provider is active.

## 12. Concurrent initialization

Use a model-manager lock.

Suggested:

```text
generated/model-manager/model-manager.lock
```

or a root-specific lock adjacent to the configured model root.

Lock contains:

```text
pid
hostname
startedAt
command
```

Stale lock handling must verify process absence before removal.

Per-artifact locking may be added later if parallel downloads become useful.

## 13. Repair semantics

`models:repair` is conservative by default.

Allowed automatically:

- complete missing resumable HF blobs;
- redownload missing required direct files into staging;
- recreate symlinks/metadata;
- clean abandoned staging content;
- update inventory/Mongo after verification.

Requires explicit `--force`:

- delete/replace a final non-empty model directory;
- change pinned source revision;
- discard unknown local files;
- prune older HF snapshots.

## 14. Offline mode

`models:verify --offline`:

- makes no network requests;
- validates local bytes/evidence only.

`models:init --offline`:

- succeeds only for already complete caches;
- reports missing assets without attempting download.

This is useful for field/offline deployments.

## 15. Reporting

Every command writes a report under:

```text
generated/model-manager/<timestamp>-<command>.json
```

Report contains:

- schema version;
- command;
- model root;
- selected artifacts;
- before/after state;
- actions taken;
- bytes downloaded when known;
- resolved revisions;
- sanitized errors;
- elapsed time.

No secret values are written.

## 16. Exit code contract

Proposed:

```text
0  success
2  invalid CLI/manifest
3  missing authentication
4  gated access denied
5  verification/integrity failure
6  network/download failure
7  insufficient disk space
8  lock/concurrency conflict
9  Mongo synchronization warning promoted to strict failure
10 provider-active conflict
```

Ordinary Mongo unavailability should be a warning, not exit 9, unless
`--require-db` is explicitly used.

## 17. Recovery invariants

At all times:

1. a verified final cache is never overwritten before replacement verifies;
2. secrets never appear in logs/reports;
3. interruption cannot make verified final bytes disappear;
4. command can be rerun safely;
5. repair scope is limited to selected artifacts;
6. unrelated model directories are untouched;
7. Mongo state never claims installed until filesystem verification passes.
