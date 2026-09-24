# Model Manager CLI Specification

**Status:** Planning specification  
**Date:** September 23, 2026  
**Parent plan:** [MODEL_STORAGE_REHYDRATION_PLAN.md](MODEL_STORAGE_REHYDRATION_PLAN.md)

## 1. Purpose

Define the user and automation contract for Harmonia's local model lifecycle
manager before implementation begins.

The CLI must be safe to rerun, secret-safe, explicit about network activity, and
usable both interactively and in scripted recovery workflows.

## 2. Command surface

```bash
pnpm models:plan
pnpm models:init
pnpm models:verify
pnpm models:inventory
pnpm models:repair
```

All commands delegate to:

```text
node scripts/model-manager.cjs <command>
```

## 3. Global options

```text
--model <modelId>
--provider <providerId>
--artifact <artifactId>
--root <path>
--offline
--dry-run
--json
--require-db
--force
--verbose
```

### Selector rules

Selectors are intersections:

```text
--provider musicgen --model musicgen-small
```

selects only the named model if it belongs to the provider.

Invalid combinations fail before mutation.

### Root rules

Default:

```text
models/
```

`--root` may point elsewhere for recovery qualification.

The resolved root may be absolute at runtime, but registry destinations remain
relative and are always joined underneath the selected root.

The manager must reject any resolved artifact destination that escapes the
selected root.

## 4. Command: plan

Read-only.

Purpose:

- resolve registry selection;
- inspect local cache;
- identify required actions;
- report authentication/license prerequisites;
- show estimated download size when known;
- show source revision expectations;
- show Mongo state if available;
- perform no download/delete/update mutation.

Example:

```text
MODEL                              ARTIFACT                         STATE       ACTION
musicgen-small                     musicgen-small                   verified    none
diffsinger-acoustic-hifigan        diffsinger-opencpop-acoustic     verified    none
diffsinger-acoustic-hifigan        diffsinger-xiaoma-pitch-estimator verified   none
diffsinger-acoustic-hifigan        diffsinger-hifigan-vocoder       verified    none
stable-audio-3-small-music         stable-audio-3-small-music       missing     download
musicgen-medium                    musicgen-medium                   missing     skipped-default
```

Summary:

```text
selectedModels=6
selectedArtifacts=8
verified=6
missing=2
downloadsRequired=1
defaultSkipped=1
```

## 5. Command: init

Mutating.

Purpose:

- reconcile selected/default-install artifacts into the model root;
- verify each result;
- update observed inventory;
- synchronize Mongo operational state when available.

Default selection:

- artifacts reachable from catalog models with `availability=installed`;
- artifact `defaultInstall=true`.

Explicit `--model` or `--artifact` overrides default-install filtering so an
optional installed artifact can be initialized deliberately.

Examples:

```bash
pnpm models:init
pnpm models:init --model musicgen-medium
pnpm models:init --provider diffsinger
pnpm models:init --root generated/qualification-runtime/models
```

Init never downloads planned/API-only/unreleased model bindings unless a future
command explicitly changes registry policy.

## 6. Command: verify

Read-only by default.

Purpose:

- validate local bytes;
- capture resolved revisions/snapshots;
- compare against registry;
- derive artifact/model readiness;
- optionally synchronize Mongo when not in strict read-only mode.

Recommended implementation split:

```text
models:verify
    filesystem read-only
    local report write allowed
    Mongo status sync allowed unless --offline

models:verify --offline
    no network
    no Mongo requirement
```

No source download is permitted.

## 7. Command: inventory

Read-only filesystem inspection plus report generation.

Produces normalized observed state:

```json
{
  "schemaVersion": "harmonia-model-inventory-v1",
  "generatedAt": "...",
  "modelsRoot": "models",
  "artifacts": []
}
```

Each artifact record includes:

```text
artifactId
providerId
modelIds[]
runtimeModelIds[]
relativePath
status
sourceRevision
bytes
fileCount
verifiedAt
verificationStrategy
```

No absolute workstation path is written to the committed-format report.

A future optional diagnostic flag may print the resolved absolute root to the
terminal, but portable inventory data remains relative.

## 8. Command: repair

Mutating and conservative.

Default behavior:

- resume missing HF blobs;
- restore missing direct-release files through staging;
- recreate expected symlink/metadata structures;
- clean abandoned model-manager staging directories;
- reverify;
- synchronize Mongo state.

Default behavior does not:

- remove a verified artifact;
- switch source revision;
- prune old HF snapshots;
- remove unknown user files;
- stop an active provider automatically.

`--force` authorizes operations that would replace suspect/non-verified final
content, but never bypasses access/license controls.

## 9. Dry run

`--dry-run` is valid for all mutating commands.

It must display/report exactly what would happen:

```text
DOWNLOAD stable-audio-3-small-music
  source: huggingface:stabilityai/stable-audio-3-small-music
  revision: 0fef1392...
  target: <root>/stable-audio-3/huggingface
  gated: yes
```

No filesystem mutation other than the optional generated report is permitted.
No Mongo update is permitted.

## 10. Offline behavior

`--offline` guarantees:

- no HTTP requests;
- no Hugging Face API request;
- no GitHub release request.

Plan/verify/inventory work from local evidence.

Init/repair in offline mode may succeed only if all selected artifacts already
exist and verify without remote access.

## 11. JSON output

`--json` makes stdout machine-readable JSON.

Human diagnostic/progress information goes to stderr.

Result envelope:

```json
{
  "schemaVersion": "harmonia-model-manager-result-v1",
  "command": "verify",
  "ok": true,
  "modelsRoot": "models",
  "startedAt": "...",
  "completedAt": "...",
  "summary": {},
  "artifacts": [],
  "warnings": []
}
```

Secret values are never serialized.

## 12. Generated reports

Every command writes a report by default:

```text
generated/model-manager/
  2026-09-23T...-plan.json
  2026-09-23T...-init.json
  2026-09-23T...-verify.json
```

`generated/` is gitignored.

The report is suitable for support/debugging and recovery qualification.

## 13. Authentication resolution

Hugging Face token precedence:

```text
process.env.HF_TOKEN
.env HF_TOKEN
process.env.HUGGINGFACE_API_KEY
.env HUGGINGFACE_API_KEY
process.env.HUGGING_FACE_HUB_TOKEN
.env HUGGING_FACE_HUB_TOKEN
process.env.HUGGINGFACE_HUB_TOKEN
.env HUGGINGFACE_HUB_TOKEN
```

The manager normalizes internally without printing the value.

For gated preflight, it may print the authenticated Hugging Face username.

## 14. Locking

Mutating commands acquire a root-specific lock.

Conceptual location:

```text
<modelsRoot>/.harmonia-model-manager.lock
```

The lock records non-secret metadata:

```json
{
  "pid": 12345,
  "hostname": "workstation",
  "command": "init",
  "startedAt": "..."
}
```

Read-only commands do not require exclusive locking unless their implementation
needs a consistent snapshot.

Stale locks are removed only after verifying the process is no longer alive on
the same host.

## 15. Provider activity

Before a repair operation that could replace final content, check whether the
corresponding provider container is running.

Behavior:

```text
ERROR: stable-audio-3-small-music is in use by harmonia-stable-audio-3.
Stop the provider or select a different artifact.
```

Verification and inventory remain allowed against active providers.

## 16. Exit codes

```text
0  success
2  invalid CLI or registry
3  missing authentication
4  gated access denied
5  verification/integrity failure
6  network/download failure
7  insufficient disk space
8  lock/concurrency conflict
9  required Mongo synchronization failure
10 provider-active conflict
```

Unexpected internal errors may use exit 1.

## 17. Logging

Default output is concise and stage-oriented.

Verbose output may include:

- source adapter operations;
- resolved snapshot IDs;
- filesystem paths relative to root;
- retry attempts;
- verification rule results.

Never log:

- tokens;
- Authorization headers;
- URLs containing embedded secrets;
- full environment dumps.

## 18. Performance and concurrency

v1 defaults to serial artifact initialization because:

- GPU model sources are large;
- shared HF cache mutation is easier to reason about serially;
- deterministic logs/recovery are more important than maximum bandwidth.

Parallel downloads may be added later with per-artifact locks.

## 19. Compatibility contract

The CLI must work from Git Bash/Windows because that is the current primary
development environment.

Avoid:

- stdin-dependent Node snippets;
- shell constructs known to trigger Git Bash history expansion;
- assumptions that GNU-only `find -printf` exists;
- hard-coded drive letters inside committed state.

Cross-platform path normalization belongs inside Node.

## 20. Initial implementation order

1. registry loader and structural validator;
2. selector/filter resolution;
3. plan command;
4. verification adapters;
5. inventory report;
6. Hugging Face downloader;
7. HTTP ZIP downloader;
8. init orchestration;
9. repair orchestration;
10. Mongo synchronization.

This keeps the first executable stages read-only.
