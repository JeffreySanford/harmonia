# Music generator readiness and implementation plan

Date: 2026-09-23
Active branch: `feat/model-runtime-orchestration`

## Current verified state

Harmonia currently lists nine music-generation provider families. Two have
container runtimes; one has been proven with real audio generation.

| Provider | Runtime | Real inference | Current status |
| --- | --- | --- | --- |
| MusicGen | Implemented | Verified locally | Working baseline |
| DiffSinger | Implemented | Not yet qualified | Runtime only |
| Stable Audio 3 | Catalog only | No | Planned |
| ACE-Step 1.5 | Catalog only | No | Planned |
| DiffRhythm | Catalog only | No | Planned |
| HeartMuLa | Catalog only | No | Planned |
| SongGeneration / LeVo 2 | Catalog only | No | Planned |
| Muse | Catalog only | No | Planned |
| YuE2 | Catalog only | No | Planned |

### MusicGen evidence already proven

The AudioCraft/MusicGen provider is isolated in `harmonia/musicgen:dev`, uses
Python 3.9 + PyTorch 2.1 + AudioCraft 1.3, and runs a persistent internal
provider service.

Verified on the local RTX 3080 10 GB system:

- MusicGen Small container health with CUDA available.
- Real 5-second piano WAV generation.
- Real 5-second electric-guitar WAV generation.
- Persistent 1.9 GB model cache under `models/musicgen/`.
- Resident model reuse across sequential generations.
- Nest `POST /api/songs/export-stems` generation through the resident provider.
- Valid 16-bit mono 32 kHz WAV artifacts.
- Backend recovery of the resident MusicGen model after a Nest restart.
- Runtime transitions support `ready -> busy -> ready`.
- Fake placeholder audio fallback has been removed.

The Music Generation page still does not submit a generation request. Its
`generateMusic()` method only reports that generation wiring is pending.

### DiffSinger gaps

DiffSinger has an isolated provider image and cached HiFi-GAN vocoder, but it is
not yet qualified as a complete singing generator. Its input contract,
checkpoint compatibility, actual vocal generation path, and error behavior need
verification. Any legacy invalid-WAV or placeholder success behavior must be
removed before it can be reported as working.

## Next five implementation steps

### 1. Finish the shared generation contract and main-page flow

Build one provider-neutral generation job contract around the runtime
orchestrator. Carry the selected provider/model plus prompt, duration and
provider-specific options into a job; emit progress and failure; validate the
artifact before success; and expose a real playback/download URL.

MusicGen is the reference implementation because its real inference path is
already proven.

Acceptance:

- The Music Generation page actually starts a backend generation.
- Prompt and duration are honored instead of the stem path's fixed five seconds.
- NgRx represents submit/progress/success/failure/cancel states.
- No successful job can reference a missing or invalid audio file.
- Concurrent GPU jobs are serialized or explicitly rejected.
- Provider/model switching while busy is rejected.
- Backend restart recovery does not lose selected resident model state.

### 2. Fully qualify MusicGen variants

Qualify MusicGen Small and Stereo Small through the shared job path and browser
UI. Record real duration, channel count, generation time, peak VRAM and cache
behavior.

Keep Medium and Stereo Medium disabled on the current 10 GB GPU unless a
measured offload strategy is implemented and verified. Do not mark a model
working merely because its provider image starts.

Acceptance:

- Small: real UI generation + playback/download.
- Stereo Small: real stereo generation + playback/download.
- Repeat generations reuse the resident model.
- Stop/switch releases GPU memory.
- Failure and timeout tests are present.

### 3. Make DiffSinger a real singing provider

Define a singing-specific request contract: lyrics/phonemes, notes, timing,
voice/checkpoint and synthesis options. Qualify the acoustic checkpoint and
HiFi-GAN vocoder together.

Acceptance:

- A controlled lyric-and-note fixture creates audible singing through Harmonia.
- Generated WAV is structurally validated.
- Missing/incompatible checkpoints fail explicitly.
- No placeholder or text-written-as-WAV fallback remains.
- Switching MusicGen -> DiffSinger releases MusicGen GPU ownership first.

### 4. Add ACE-Step and Stable Audio as isolated providers

Implement each as a separate provider image with persistent model cache and an
adapter to the shared generation job contract.

Order:

1. ACE-Step 1.5, because it advances the full-song/vocal goal.
2. Stable Audio, because it provides a second strong instrumental generator.

Verify current upstream repository, model identifiers, licenses, dependency
versions and actual hardware requirements before enabling catalog entries.

Acceptance per provider:

- Provider starts only when selected.
- Real short generation from the UI.
- Valid playable/downloadable artifact.
- Proven stop/switch behavior and GPU release.
- Startup/inference failure paths tested.

### 5. Complete the remaining provider families

Implement and qualify, one provider per coherent GitHub milestone:

1. DiffRhythm
2. HeartMuLa
3. SongGeneration / LeVo 2
4. Muse
5. YuE2

For every provider, qualify one model that fits the available hardware first,
then expand variants. Entries that require more than the local RTX 3080 can stay
visible but disabled until a verified CPU/offload/remote execution path exists.

Acceptance for the catalog:

- Every selectable entry has a repeatable real inference result.
- Model revision, dependencies, cache location, input contract and output format
  are recorded.
- Measured VRAM and generation time are recorded.
- Missing weights, license restrictions, unreleased variants and hardware
  blockers are represented explicitly instead of being labeled working.

## GitHub cadence

Commit and push after every coherent verified milestone:

- shared generation contract,
- MusicGen UI/job integration,
- each provider runtime,
- each provider qualification fix,
- cross-provider switching/regression work.

Do not commit generated audio, model checkpoints, tokens or secrets. Do not
force-push the active orchestration branch. PR #12 remains draft until the
provider/runtime work is qualified.
