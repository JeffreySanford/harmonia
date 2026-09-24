# Model Rehydration Acceptance Matrix

**Status:** Planning specification  
**Date:** September 23, 2026

This matrix defines the evidence required before each model-lifecycle phase is
considered complete.

## Phase A — Registry contract

| Scenario | Expected |
| --- | --- |
| Valid v1 registry | schema passes |
| Unsupported schema version | fail clearly |
| Installed catalog model without binding | contract fails |
| Binding references missing artifact | contract fails |
| Absolute destination path | schema/contract fails |
| `../` destination traversal | schema/contract fails |
| Gated source without gated/license metadata | contract fails |
| Planned/API-only model marked default install | contract fails or explicit exception required |
| Secret-like registry field | contract fails |

## Phase B — Plan command

| Scenario | Expected |
| --- | --- |
| Complete cache | action=none |
| Missing artifact | action=download |
| Partial artifact | action=repair |
| Revision mismatch | action=review/repair, no mutation |
| Gated artifact without token | authentication prerequisite shown |
| Planned model | skipped |
| `--model` filter | only selected binding/artifacts |
| `--provider` filter | only provider models |
| Alternate root | no reads/writes to default model root |
| Dry run | no mutation |

## Phase C — Verify command

| Scenario | Expected |
| --- | --- |
| Complete MusicGen cache | verified |
| Complete Stable Audio snapshot | verified + snapshot SHA |
| Complete DiffSinger composite | all 3 artifacts verified |
| Missing required config | missing/corrupt |
| Broken symlink | verification failure |
| Truncated checkpoint | verification failure when size/hash rule exists |
| Offline verify | no network |
| Mongo unavailable | disk verification still succeeds |
| Active provider | read-only verify allowed |

## Phase D — Hugging Face initialization

| Scenario | Expected |
| --- | --- |
| Public model + valid network | download + verify |
| Existing complete snapshot | cache hit, zero unnecessary download |
| Missing token for gated model | explicit missing credential |
| Invalid token | explicit invalid credential |
| Valid token but terms not accepted | explicit gated-access denied |
| Accepted gated model | download + verify |
| Interrupted download | rerun resumes safely |
| 429 | bounded retry |
| 5xx transient | bounded retry |
| 403 | no blind retry |
| Secret scan of logs/report | token absent |

## Phase E — HTTP ZIP initialization

| Scenario | Expected |
| --- | --- |
| Empty root | staged download/extract/verify/promote |
| Existing verified package | skip |
| Interrupted staging download | final cache untouched |
| Invalid ZIP | fail, no promotion |
| Missing checkpoint after extract | fail, no promotion |
| Source checksum mismatch | fail |
| Repair partial package | verified final result |
| Existing final version mismatch | no silent overwrite |

## Phase F — Mongo installation registry

| Scenario | Expected |
| --- | --- |
| Verified model + Mongo up | installed record upserted |
| Missing model | missing record/state |
| Download in progress | downloading state |
| Verification failure | failed/degraded + sanitized error |
| Mongo down | model init still succeeds with warning |
| Token in exception text | sanitized before persistence |
| Repeat init | same logical installation updated, no duplicate |
| Provider used | lastUsedAt updates |

## Phase G — Runtime integration

| Scenario | Expected |
| --- | --- |
| Verified installed model | provider selection allowed |
| Missing model | selection reports models:init command |
| Corrupt model | provider not launched |
| DB says installed but disk missing | disk wins; reconcile DB |
| Disk installed but DB missing | selection may verify/reconcile |
| Startup with missing model | no automatic GB download |
| Switching providers | existing orchestrator lifecycle retained |

## Phase H — Recovery qualification

Use an alternate root; never delete the development cache.

| Scenario | Expected |
| --- | --- |
| Empty alternate root | selected model rehydrates |
| Second init | idempotent/cache hit |
| Delete one required file | verify fails |
| Repair after deletion | only necessary content restored |
| Empty root + Mongo down | rehydration succeeds |
| Empty root + gated model unauthorized | controlled failure |
| Authorized retry | resumes/succeeds |
| Full provider direct qualification | generation passes from recovered cache |
| Persistent job qualification | generation/download passes |
| Report inspection | source revision/path/status recorded |

## Provider-specific recovery evidence

### MusicGen Small

Required:

- registry binding passes;
- HF snapshot/cache verified;
- direct or persistent generation qualification passes;
- 32 kHz output contract retained.

### MusicGen Stereo Small

Required:

- independent model binding;
- HF snapshot/cache verified;
- 2-channel generation qualification passes.

### DiffSinger

Required:

- acoustic, pitch, and vocoder physical artifacts individually verified;
- compatibility runtime revision remains pinned;
- direct inference qualification passes;
- persistent job qualification passes.

### Stable Audio 3 Small-Music

Required:

- gated access preflight passes;
- snapshot SHA captured;
- model configuration and weight blobs verified;
- CUDA inference qualification passes;
- 44.1 kHz stereo 32-bit float WAV retained;
- persistent job qualification passes.

## CI policy

Ordinary CI runs:

- schema validation;
- registry/catalog consistency;
- CLI dry-run fixtures;
- adapter unit tests with local fixtures/mocks;
- secret-redaction tests;
- state-machine tests;
- Mongo schema tests.

Ordinary CI does not:

- download multi-GB checkpoints;
- require GPU;
- require private/gated Hugging Face access;
- mutate a developer model cache.

Heavy recovery qualification is explicit/manual or dedicated-runner only.

## Release gate

A new local provider cannot move to `availability: installed` unless:

1. provider runtime qualification exists;
2. registry binding exists;
3. rehydration/verification strategy exists;
4. licensing/gated metadata is documented;
5. persistent storage destination is documented;
6. failure messages are secret-safe;
7. at least one recovery qualification is defined.

This makes model lifecycle support part of the definition of "installed", not an
afterthought.
