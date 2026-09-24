# Phase 8C Automatic Lifecycle-to-Mongo Synchronization

**Status:** Complete and locally qualified  
**Date:** September 24, 2026  
**Commands:** `pnpm models:init`, `pnpm models:repair`

## Purpose

Automatically synchronize operational `model_installations` metadata after a
successful model filesystem mutation without making MongoDB authoritative for
model recovery.

The already-qualified explicit `models:db-sync` command remains available.

## Integration boundary

Automatic synchronization belongs at the CLI boundary, not inside the pure
filesystem lifecycle functions.

This preserves:

- deterministic unit-testable init/repair engines;
- filesystem-first recovery when MongoDB is unavailable;
- one synchronization implementation;
- no database dependency inside source adapters.

## Trigger rules

Automatic synchronization runs after:

- successful non-dry-run `models:init` against the canonical operational
  `models/` root;
- successful non-dry-run `models:repair` against the canonical operational
  `models/` root.

Automatic synchronization does not run after:

- `--dry-run`;
- a failed init/repair result;
- an alternate `--root`.

Alternate roots are intentionally excluded so recovery/qualification trees
cannot overwrite operational Mongo state. Operators may still run an explicit
`models:db-sync --root <alternate-root>` when that is deliberately desired.

Offline lifecycle commands may still synchronize metadata because DB sync
performs no model-provider network access.

## Selector propagation

The lifecycle command forwards the same:

- `--root`;
- `--model`;
- `--provider`;
- `--artifact`.

A selector-free default init/repair synchronizes the full registry inventory so
the operational collection continues to represent optional missing artifacts.

Explicitly selected lifecycle operations synchronize only the selected model
scope.

## Mongo availability

Default behavior remains advisory:

- successful filesystem init/repair remains successful;
- the lifecycle report records database status `unavailable`;
- a warning is emitted without exposing connection credentials.

With `--require-db`:

- filesystem work may already have completed;
- failed metadata synchronization makes the CLI result fail;
- the report clearly distinguishes filesystem success from database failure.

No filesystem rollback is attempted for a database-only failure.

## Result contract

Lifecycle JSON/report output gains:

```text
databaseIntegration.status
databaseIntegration.synchronized
databaseIntegration.records
databaseIntegration.warning
databaseIntegration.required
```

Expected statuses:

```text
synchronized
unavailable
skipped-dry-run
skipped-lifecycle-failed
skipped-noncanonical-root
```

## Safety

The automatic hook:

- never passes secrets on command-line arguments;
- never logs a Mongo URI;
- captures child JSON output instead of interleaving it with lifecycle JSON;
- uses the same sanitizer already qualified in Phase 8B;
- never changes model bytes itself.

## Qualification target

1. sync-runner forwards selectors/root and `--require-db`;
2. successful init calls sync exactly once;
3. successful repair calls sync exactly once;
4. dry-run does not call sync;
5. failed lifecycle does not call sync;
6. default Mongo outage preserves successful filesystem exit;
7. `--require-db` turns database sync failure into lifecycle failure;
8. alternate-root lifecycle skips automatic operational sync;
9. JSON output remains one parseable lifecycle document;
10. live cache-hit init updates Mongo without changing model files;
11. live repair no-op updates Mongo without changing model files;
12. full startup/model regression remains green.

## Local qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- successful canonical cache-hit init synchronized Mongo automatically;
- successful canonical repair no-op synchronized Mongo automatically;
- dry-run skipped automatic synchronization;
- alternate recovery-root lifecycle skipped operational Mongo synchronization;
- Mongo outage remained advisory by default;
- advisory and required-DB failure messages exposed no Mongo URI, endpoint,
  hostname, port, token, or credential details;
- `--require-db` converted synchronization failure into lifecycle exit failure
  without pretending filesystem work was rolled back;
- both operational and recovery model roots remained green;
- live operational inventory remained eight records: six verified and two
  optional missing Medium artifacts;
- jobs/users remained unchanged;
- the full regression suite finished with 127 passing tests, zero failures,
  and one intentionally skipped Compose lifecycle test.

## Completion boundary

Phase 8C is complete when the normal mutating model lifecycle automatically
keeps `model_installations` current while MongoDB remains advisory by default.

Runtime `lastUsedAt` and pre-provider readiness enforcement are the next
integration phase.
