# Phase 3 Model Verify Semantics

**Status:** Complete and locally qualified  
**Date:** September 24, 2026  
**Command:** `pnpm models:verify`

## Purpose

Phase 3 adds deep, read-only local verification after the marker-level
`models:plan` command.

`models:verify` answers:

> Are the selected local model artifacts actually dereferenceable and usable as
> local files at the verification-contract level, without downloading,
> repairing, or starting a provider?

It does not perform:

- network requests;
- model downloads;
- repair;
- model deletion or promotion;
- provider inference;
- MongoDB-required writes.

Provider runtime/inference qualifications remain separate evidence.

## Relationship to Phase 2

Phase 2 `models:plan` deliberately uses inexpensive marker-level checks.

On Docker Desktop for Windows, Hugging Face snapshot entries created and used by
Linux containers may appear in the Windows directory while Node cannot
dereference them and returns `EACCES` or `EPERM`.

For planning, an exact visible directory entry may therefore count as a shallow
marker.

For verification, that is not enough.

Phase 3 must prove the backing target can actually be read from an environment
compatible with the provider runtime.

## Verification states

### verified

All required local verification rules passed.

### missing

The required artifact/cache or required file is absent.

### corrupt

The artifact exists but fails an integrity rule, for example:

- required checkpoint/config entry cannot be dereferenced;
- required file is zero bytes;
- expected pinned revision does not match;
- configured checkpoint glob resolves no usable files;
- a future size/hash rule fails.

### unavailable

Deep verification could not be performed because the required local verifier
environment is unavailable.

Example:

- Windows cannot dereference a Linux-created HF cache link and Docker is not
  available to perform the read-only Linux probe.

`unavailable` is not promoted to `verified`.

## Hugging Face verification

For `huggingface-snapshot` artifacts:

1. resolve the repository cache;
2. resolve the expected/pinned revision, `refs/main`, or available snapshot
   according to registry policy;
3. fail on pinned revision mismatch;
4. verify every registry-required file;
5. follow the snapshot entry to its backing file;
6. require the backing file to be a regular file with size greater than zero;
7. record file size and verification mode;
8. make no network request.

### Native filesystem path

When the host can dereference the snapshot entry directly, use local filesystem
metadata.

### Windows Docker Desktop path

When Windows Node receives `EACCES` or `EPERM` for an exact snapshot entry
that Phase 2 can see in the directory:

- use a short-lived read-only Linux container probe;
- disable container networking;
- mount the configured model root read-only;
- stat only the selected required paths;
- do not start the provider server;
- do not mutate cache files.

Provider-compatible images are preferred because they already represent the
filesystem/runtime boundary used by Harmonia:

- MusicGen: `harmonia/musicgen:dev`;
- Stable Audio 3: `harmonia/stable-audio-3:dev`.

If the required image or Docker engine is unavailable, report
`verification=unavailable`; do not silently fall back to the Phase 2 shallow
result.

## MusicGen verification

Required AudioCraft snapshot files:

```text
state_dict.bin
compression_state_dict.bin
```

Both must resolve to non-empty backing files.

The compression checkpoint may be a small pointer package for some MusicGen
variants. Phase 3 therefore requires non-zero size but does not invent a fixed
minimum byte threshold.

Provider loading and audio generation remain covered by the existing MusicGen
qualification scripts.

## Stable Audio 3 verification

At minimum verify:

```text
model_config.json
model.safetensors
```

The pinned snapshot revision must match the registry.

Phase 3 should also verify the bundled text-encoder markers currently required
by the qualified local snapshot when those rules are represented in the
registry or provider-specific verifier.

CUDA loading and 44.1 kHz stereo 32-bit float generation remain runtime
qualification evidence, not `models:verify` behavior.

## DiffSinger verification

For each physical DiffSinger artifact:

- required config file exists and is readable;
- every required checkpoint glob resolves;
- each resolved checkpoint is a regular non-empty file;
- source revision metadata remains consistent with the registry.

The logical `diffsinger-acoustic-hifigan` model verifies only when acoustic,
pitch-estimator, and vocoder artifacts all verify.

## Selector behavior

Use the same selectors as `models:plan`:

```text
--model <modelId>
--provider <providerId>
--artifact <artifactId>
--root <path>
--offline
--json
--verbose
```

Without selectors, include the same registry model set as planning, including
optional models so their absence remains visible.

Optional `defaultInstall=false` models are not failures in the default
verification run when absent. When explicitly selected, absence is a
verification failure.

## Exit behavior

Suggested initial contract:

```text
0 = selected required/default artifacts verified; optional unselected absence allowed
1 = selected artifact missing/corrupt/unavailable
2 = CLI/selector/configuration error
```

The JSON report remains authoritative for per-artifact state.

## Report contract

Write a gitignored report under:

```text
generated/model-manager/<timestamp>-verify.json
```

Include at minimum:

- schema version;
- command;
- models root;
- selected models/artifacts;
- artifact verification state;
- expected/resolved revision;
- required file checks;
- verification mode (`host` or `container-readonly`);
- file sizes when known;
- failure reason;
- summary counts;
- warnings.

Do not include tokens or unrelated absolute filesystem paths.

## Qualification scenarios

Phase 3 qualification must cover:

1. complete fixture cache;
2. missing required file;
3. zero-byte required file;
4. DiffSinger checkpoint glob with a non-empty match;
5. DiffSinger checkpoint glob with no match;
6. pinned HF revision match;
7. pinned HF revision mismatch;
8. Windows `EACCES` HF link requiring container verification;
9. Windows HF link with unavailable Docker/image;
10. empty alternate root;
11. explicit missing optional model;
12. default absent optional models do not fail verification;
13. JSON output;
14. invalid selector;
15. startup/script contract regression.

## Current workstation qualification target

Given the September 24, 2026 Phase 2 evidence, the expected deep-verification
target is:

```text
verified default artifacts = 6
optional absent artifacts = 2
corrupt = 0
unavailable = 0
```

No provider generation is required for Phase 3 completion because existing
runtime qualifications already test real generation separately.

## Local qualification result

Qualified locally on September 24, 2026.

Observed default workstation verification:

```text
selectedModels=6
selectedArtifacts=8
verified=6
missing=2
corrupt=0
unavailable=0
optionalSkipped=2
```

Qualification proved:

- MusicGen Small and Stereo Small backing files are non-empty and
  dereferenceable through read-only Linux container probes on Windows;
- all three DiffSinger physical artifacts contain readable, non-empty
  config/checkpoint files;
- Stable Audio 3 verifies its pinned model config, model weights, bundled
  T5 config, T5 weights, and tokenizer config;
- unselected optional MusicGen Medium variants may remain absent;
- explicitly selected missing optional models fail verification;
- an empty alternate root fails verification without mutation;
- invalid selectors return configuration error status 2;
- the startup regression suite remained green.

`models:verify` is therefore complete. Mutation-capable recovery work now
moves to the Hugging Face initialization adapter.

## Completion criterion

Phase 3 completion criteria are satisfied:

- [x] fixture/regression tests pass;
- [x] `pnpm models:verify` is package-exposed;
- [x] verification performs no network or model mutation;
- [x] real MusicGen Small and Stereo Small backing files verify;
- [x] real DiffSinger acoustic/pitch/vocoder files verify;
- [x] real Stable Audio 3 pinned snapshot files verify;
- [x] Windows HF cache links use a read-only Linux probe;
- [x] missing/corrupt/unavailable states remain distinguishable;
- [x] optional Medium absence does not fail the default run;
- [x] explicit missing optional selection fails;
- [x] no secrets appear in output or reports.
