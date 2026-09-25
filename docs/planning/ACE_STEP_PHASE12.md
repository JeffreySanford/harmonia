# Phase 12 ACE-Step 1.5 Local Provider

**Status:** Phase 12 complete and locally qualified end to end
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

## Phase 12A local qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- runtime/Compose contract suite passed 45/45;
- pinned ACE-Step provider image built successfully from upstream revision
  `ca1e85fe9430179831e6bc6be790c332190a3866`;
- container import probe reported PyTorch `2.10.0+cu128`, CUDA available,
  NVIDIA GeForce RTX 3080, and 10.00 GB VRAM;
- official ACE-Step API became healthy;
- `/health` reported `models_initialized=false` and `llm_initialized=false`;
- runtime environment enforced lazy initialization plus Hugging Face/Transformers
  offline mode;
- persistent `models/ace-step-1.5` payload remained exactly 0 files / 0 bytes
  before and after provider boot;
- container remained healthy with zero restarts;
- full startup/model regression finished with 138 passing tests, zero failures,
  and one intentionally skipped Compose lifecycle test;
- Compose validation confirmed the ACE-Step provider publishes no host ports;
- cleanup removed the qualification container.

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

## Phase 12B selective acquisition contract

Harmonia does not use ACE-Step's upstream whole-unified-repository downloader
for the 10 GB workstation profile. The upstream unified repository also contains
the 1.7B LM, which is outside the intended first qualification payload.

The registry now binds `acestep-v15-turbo-06b` to two optional physical artifacts:

1. `acestep-v15-turbo-core`
   - repository: `ACE-Step/Ace-Step1.5`;
   - pinned revision: `19671f406d603126926c1b7e2adc169acbcade22`;
   - direct local-dir destination: `ace-step-1.5/checkpoints`;
   - allowed subtrees only:
     - `acestep-v15-turbo/*`;
     - `vae/*`;
     - `Qwen3-Embedding-0.6B/*`.
2. `acestep-5hz-lm-06b`
   - repository: `ACE-Step/acestep-5Hz-lm-0.6B`;
   - pinned revision: `f802b6dfe8dd4db180c6bf1a45669a303130de3d`;
   - direct local-dir destination:
     `ace-step-1.5/checkpoints/acestep-5Hz-lm-0.6B`.

The registry source remains `kind: huggingface`; `layout: local-dir` is the
new storage modifier. Existing MusicGen and Stable Audio cache-layout behavior
is unchanged.

Each local-dir artifact receives a `.harmonia-revision` marker only after its
download completes. Deep verification requires that pinned marker plus explicit
non-empty runtime files.

Both ACE-Step artifacts remain `defaultInstall: false` until runtime/inference
qualification is complete. Bare `models:init` therefore remains the existing
four logical defaults / six physical artifacts.

## Phase 12B local qualification result

Qualified locally on September 24, 2026 against an isolated alternate model root.

Observed behavior:

- registry contains 10 physical artifacts / 7 logical bindings, with the ACE-Step pair remaining optional;
- explicit `acestep-v15-turbo-06b` plan selected exactly two physical artifacts;
- dry-run performed zero filesystem mutation;
- selective unified-repository download completed 16/16 files;
- separate 0.6B LM download completed 11/11 files;
- selected runtime payload was 85 files / 7,709,385,937 bytes;
- exact core and 0.6B revision markers matched their pinned revisions;
- Turbo, VAE, Qwen embedding, and 0.6B LM required files were non-empty;
- no `acestep-5Hz-lm-1.7B` subtree was downloaded;
- deep verification reported both physical artifacts verified;
- an offline re-run returned two cache hits with unchanged file/byte totals;
- operational `models/ace-step-1.5` remained 0 files / 0 bytes;
- bare default initialization remained four logical models / six physical artifacts;
- full startup/model regression finished with 143 passing tests, zero failures,
  and one intentionally skipped Compose lifecycle test.

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

## Phase 12C operational runtime contract

Phase 12C promotes the already-qualified alternate-root payload into the
canonical `models/ace-step-1.5` root without another network download.

Runtime behavior:

- only `acestep-v15-turbo-06b` is marked installed/selectable;
- SFT and XL ACE-Step variants remain planned;
- provider metadata points to the isolated `harmonia/ace-step-1.5:dev` image;
- Compose mounts the canonical checkpoint directory both at Harmonia's
  `/workspace/models/ace-step-1.5/checkpoints` path and directly at upstream's
  `/opt/ACE-Step-1.5/checkpoints` API-initializer path;
- runtime stays lazy/offline at container boot;
- filesystem deep verification remains mandatory before provider switching;
- after API health, Harmonia calls upstream `POST /v1/init` for
  `acestep-v15-turbo` plus `acestep-5Hz-lm-0.6B`;
- the runtime does not transition to `ready` until the API confirms both the
  requested DiT and 0.6B LM are initialized;
- backend restart recovery maps ACE-Step `/health` state back to the logical
  Harmonia model only when both DiT and LM are resident;
- the 10 GB profile enables general CPU offload and DiT CPU offload;
- the pinned upstream `/v1/init` route does not expose a quantization request
  field, so Phase 12C relies on conservative offload for the first live load;
  generation qualification will determine whether an additional quantization
  adapter is necessary.

### Phase 12C qualification note

The first operational qualification attempt reached a verified/selectable catalog
entry and recovered an already-running ACE-Step provider with Turbo + 0.6B resident.
The product runtime correctly returned `ready`, but the shell harness rejected the
valid recovery message because it expected only the fresh-load message.

Continuation qualification therefore starts from a deliberately stopped ACE-Step
provider. This makes the `/v1/init` load path deterministic while preserving the
separately proven backend-restart recovery path.

## Phase 12C local qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- canonical operational payload deep-verified 2/2 with exact pinned revisions;
- Mongo installation metadata synchronized both ACE-Step physical artifacts;
- live catalog on the RTX 3080 reported ACE-Step verified, recommended, and selectable;
- deterministic fresh provider boot completed successfully;
- official `POST /v1/init` loaded `acestep-v15-turbo` plus `acestep-5Hz-lm-0.6B`;
- upstream `/health` confirmed `models_initialized=true` and `llm_initialized=true`;
- resident load used roughly 5.1 GB of the 10 GB RTX 3080 at the sampled point;
- qualified weight sizes were unchanged and no `.incomplete` runtime-download files appeared;
- backend restart recovered the resident ACE-Step runtime without replacing or restarting the provider;
- same-ready re-selection preserved provider identity and restart count;
- full startup/model regression finished with 144 passing tests, zero failures,
  and one intentionally skipped Compose lifecycle test;
- continuation returned zero and intentionally left ACE-Step resident for Phase 12D.

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

## Phase 12D generation contract

Phase 12D integrates ACE-Step into Harmonia's existing durable generation-job path.

First qualified request:

- model: `acestep-v15-turbo-06b`;
- duration: 30 seconds;
- output: WAV;
- batch size: 1;
- supplied prompt and supplied lyrics;
- explicit BPM;
- English vocal language;
- `thinking=true` so the resident 0.6B LM participates;
- CoT caption/language rewriting disabled so qualification can prove the supplied
  prompt/lyrics survive the provider boundary.

Provider-client flow:

1. `POST /release_task`;
2. poll `POST /query_result` until success/failure;
3. parse the returned result payload;
4. download the returned `/v1/audio` WAV into Harmonia's shared exports mount;
5. return normalized ACE task/model/seed/meta information to `JobsService`;
6. run the existing Harmonia RIFF/WAVE validation and durable completion path.

The Angular music-generation form now includes its existing lyrics field in
non-DiffSinger job parameters, allowing ACE-Step to use supplied lyrics without
introducing a parallel provider-specific page.

### Phase 12D stale-backend qualification note

If a previously launched Harmonia backend still owns port 3000 and serves an
older in-memory catalog, Phase 12D must not treat that stale process as the
current branch. The committed ACE-Step qualifier therefore supports
`HARMONIA_QUALIFY_BACKEND_BASE` and `HARMONIA_QUALIFY_FRONTEND_BASE`.

This allows qualification to launch the current built backend on an isolated
port (for example 3112) while reusing an existing Harmonia frontend on 4200.
The frontend `/downloads` proxy may still serve the generated artifact because
both backend processes share the same host `exports` directory.

### Phase 12D read-only client-mount note

The ACE-Step provider mounts `./scripts` at `/workspace/scripts:ro` by design.
Qualification must therefore avoid `python -m py_compile` on the mounted source,
because `py_compile` may attempt to create `__pycache__` beside the file.
Use an in-memory `compile(source, path, 'exec')` syntax check instead; the runtime
client itself only reads the script and writes generated audio under `/workspace/exports`.

## Phase 12D local qualification result

Qualified locally on September 24, 2026 through Harmonia's durable product path.

Observed result:

- authenticated Harmonia test user successfully selected `acestep-v15-turbo-06b`;
- durable Mongo-backed generation job completed successfully;
- upstream ACE task id was preserved in job metadata;
- `thinking=true` exercised `acestep-5Hz-lm-0.6B`;
- returned DiT metadata identified `acestep-v15-turbo`;
- supplied lyrics were preserved exactly across Harmonia and ACE-Step;
- fixed seed `12012026` and explicit 118 BPM request were accepted;
- generated artifact was a real RIFF/WAVE file;
- output was stereo, 48 kHz, 16-bit PCM;
- artifact duration was exactly 30.00 seconds;
- artifact size was 5,760,078 bytes;
- measured durable-job generation elapsed time was 24.12 seconds;
- backend download returned HTTP 200;
- frontend-proxied download returned HTTP 200;
- provider remained resident and healthy after generation;
- both operational model artifacts still deep-verified 2/2 afterward;
- no runtime model download tempfiles were created;
- qualification returned zero.

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
