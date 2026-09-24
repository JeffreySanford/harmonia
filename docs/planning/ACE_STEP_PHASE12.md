# Phase 12 ACE-Step 1.5 Local Provider

**Status:** Planned  
**Date:** September 24, 2026  
**Primary target:** `acestep-v15-turbo-06b`  
**Reference GPU:** NVIDIA GeForce RTX 3080, 10 GB VRAM  
**Pinned upstream revision:** `ca1e85fe9430179831e6bc6be790c332190a3866`

## Goal

Make ACE-Step 1.5 the next fully qualified Harmonia generator, providing a
local/free full-song path with supplied lyrics and vocals on the reference
10 GB workstation.

The initial target is deliberately narrow:

- DiT: `acestep-v15-turbo`;
- LM: `acestep-5Hz-lm-0.6B`;
- generation mode: text-to-music with optional supplied lyrics;
- batch size: 1;
- first qualification duration: 30 seconds;
- later duration gates: 120 seconds, then 240 seconds.

## Upstream integration surface

Use ACE-Step's supported standalone REST API instead of wrapping the
interactive CLI.

Required upstream endpoints:

- `GET /health`;
- `POST /release_task`;
- `POST /query_result`;
- `GET /v1/models`;
- `GET /v1/audio`.

The Harmonia provider adapter may proxy or directly call those endpoints from
inside the isolated provider container, but Harmonia remains the owner of
provider lifecycle and persistent job state.

## Runtime isolation

Add:

- `Dockerfile.ace-step-1.5`;
- Compose service `ace-step-1.5`;
- profile `model-ace-step-1.5`;
- container `harmonia-ace-step-1.5`;
- GPU overlay entry;
- persistent checkpoint mount under `models/ace-step-1.5/`.

ACE-Step must not be installed in the generic worker or another provider image.

## Model storage

The model manager remains responsible for deterministic acquisition.

Initial physical artifacts should represent the minimum qualified Turbo + 0.6B
configuration.

Candidate upstream repositories:

- main ACE-Step 1.5 checkpoint bundle;
- `acestep-5Hz-lm-0.6B`.

Registry work must determine whether the main repository's embedded components
are best modeled as one physical artifact or multiple independently verifiable
artifacts.

No first-generation surprise download is allowed.

## Verification

Before provider startup the registry must verify concrete markers for:

- VAE;
- text encoder / Qwen embedding assets;
- Turbo DiT;
- 0.6B LM;
- required tokenizer/config metadata.

Resolved Hugging Face revisions must be recorded where practical.

## 10 GB runtime policy

Use upstream Tier-4-compatible behavior:

- CPU offload enabled where required;
- INT8 quantization enabled;
- batch size 1 for Harmonia qualification;
- avoid XL models;
- 0.6B LM for the first qualified runtime.

Do not change the catalog's higher-memory variants to installed until separately
qualified.

## Harmonia runtime contract

Add provider/catalog runtime metadata:

- `runtimeInstalled: true`;
- image/service/container/profile metadata;
- local model availability only after registry coverage exists.

`MusicRuntimeService` must:

- verify filesystem readiness before switching providers;
- recover a running ACE-Step provider from its health/model state;
- avoid restarting an already-ready matching model;
- update `lastUsedAt` after successful selection.

## Generation job contract

The persistent job path must accept ACE-Step models and send at minimum:

- prompt/style;
- supplied lyrics when present;
- duration;
- optional BPM;
- optional key/scale;
- optional time signature;
- vocal language where available;
- deterministic seed when supplied.

The provider adapter must:

1. submit `/release_task`;
2. poll `/query_result`;
3. retrieve the generated audio;
4. place the final artifact under Harmonia's existing job export directory;
5. return normalized metadata to `JobsService`.

## Output qualification

First gate:

- 30-second request;
- non-placeholder real audio;
- valid WAV or upstream output converted to a Harmonia-supported audio artifact;
- duration within reasonable tolerance;
- nonzero audio payload;
- provider remains healthy/idle after generation.

Product gate:

- authenticated persistent job;
- durable Mongo lifecycle;
- backend download HTTP 200;
- frontend-proxied download HTTP 200;
- supplied lyrics transmitted through the provider path;
- no unexpected model download during generation.

## Qualification sequence

1. pin/build provider image;
2. qualify imports and CUDA;
3. registry + model-plan contract;
4. alternate-root model initialization;
5. deep verification;
6. provider health;
7. resident model load on RTX 3080;
8. 30-second direct generation;
9. persistent Harmonia job;
10. same-ready re-selection without restart;
11. 120-second generation;
12. optional SFT + 0.6B comparison after Turbo is green.

## Non-goals

Phase 12 does not:

- integrate XL ACE-Step models;
- integrate the 4B LM;
- enable training/LoRA/LoKr;
- expose every ACE-Step editing mode in the first UI slice;
- replace DiffSinger or Stable Audio;
- remove the existing model lifecycle framework.

## Completion boundary

Phase 12 is complete when `acestep-v15-turbo-06b` is a real Harmonia
installed model: registry-managed, deeply verified, provider-selectable, capable
of durable supplied-lyrics full-song generation, and locally qualified on the
RTX 3080 10 GB workstation.
