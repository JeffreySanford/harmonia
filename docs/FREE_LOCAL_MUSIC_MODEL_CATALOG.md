# Free Local Music Model Catalog and Frontend Selector Plan

**Last reviewed:** September 22, 2026  
**Status:** Architecture and implementation plan  
**Implementation branch:** Create `feat/music-provider-catalog` only after the runtime lifecycle work is merged.  
**Primary product constraint:** Normal music creation must work without per-generation API charges.

> **Database/runtime companion plan:** Docker Mongo ownership, bootstrap vs development seeding, persistent volumes, and future seed-state handling are documented in [MongoDB Runtime and Seeding Plan](./MONGODB_RUNTIME_AND_SEEDING_PLAN.md).

## 1. Goal

Harmonia should support multiple free/local music-generation families instead of hard-coding one model.

The Music Generation page should let the user choose:

1. **Provider / model family**
2. **Model size or variant**
3. **Generation capabilities**
4. **Advanced provider-specific options**

The default catalog must prioritize models that can run on the current development workstation without cloud inference fees.

### Reference development workstation

Current target hardware:

- approximately **10 GB GPU VRAM**
- **64 GB system RAM**
- **20-core Intel i9 CPU**

This is a strong consumer workstation for current local music generation. The catalog should classify models against this hardware tier rather than assuming either a tiny laptop or a 24-80 GB datacenter GPU.

## 2. What "Free" Means

For Harmonia, a model is considered **free/local** when:

- no per-request API charge is required;
- model weights/runtime can be downloaded and self-hosted;
- generation runs on user-controlled hardware.

Free runtime does **not** necessarily imply unrestricted commercial use.

The model catalog must keep these concepts separate:

- `runtimeCost`: `local-free` | `hosted-paid`
- `licenseClass`: `permissive` | `community` | `non-commercial` | `review-required`
- `commercialUse`: `allowed` | `restricted` | `review-required`

Paid providers such as Google Lyria and Eleven Music can remain documented and architecturally supported, but should not appear as default creation choices while Harmonia is operating in free-only mode.

## 3. Initial Free/Local Provider Catalog

### 3.1 ACE-Step 1.5 — preferred free full-song/vocal path

**Priority:** Highest for full songs with vocals.

ACE-Step 1.5 is an unusually strong fit for Harmonia because it supports:

- text-to-music;
- supplied lyrics;
- vocal language;
- BPM;
- key/scale;
- time signature;
- duration from 10 to 600 seconds;
- cover, repaint, extract, complete and related editing workflows;
- REST API operation;
- automatic GPU-tier configuration.

For a roughly 10 GB VRAM GPU, ACE-Step's own compatibility guidance places the machine in the **8-12 GB tier**.

Recommended starting configuration:

- DiT: `acestep-v15-turbo` or `acestep-v15-sft`
- LM: `acestep-5Hz-lm-0.6B`
- CPU offload: enabled where auto-configuration requests it
- quantization: enabled
- target batch size: 1 initially
- initial validation duration: 30 seconds
- next validation durations: 120s, 240s, 300s

The ACE-Step compatibility code allows the 8-12 GB tier to generate up to roughly 480 seconds with the LM and 600 seconds without it.

Recommended model choices to expose in the UI:

| Model | Role | 10 GB fit | Lyrics/vocals | Max documented duration |
| --- | --- | --- | --- | ---: |
| ACE-Step 1.5 Turbo + 0.6B LM | Default full-song | Recommended | Yes | 480s in this VRAM tier |
| ACE-Step 1.5 Turbo, DiT-only | Lower-memory / faster path | Recommended | Direct conditioning | 600s |
| ACE-Step 1.5 SFT + 0.6B LM | Quality comparison | Benchmark | Yes | 480s |
| ACE-Step 1.5 + 1.7B LM | Higher-planning model | Not default at 10 GB | Yes | Hardware-dependent |

Official project:

- https://github.com/ace-step/ACE-Step-1.5

### 3.2 Stable Audio 3.0 — preferred current instrumental path

**Priority:** Highest for current open-weight instrumental/general-audio generation.

Stable Audio 3.0 was released in May 2026 and is substantially newer than MusicGen.

Open-weight variants relevant to Harmonia:

| Variant | Approx. model size | Max duration | Hardware profile | 10 GB fit |
| --- | ---: | ---: | --- | --- |
| Stable Audio 3.0 Small Music | 433M class | 120s | CPU-capable / low GPU | Excellent |
| Stable Audio 3.0 Medium | 1.4B class | 380s | CUDA + Flash Attention 2 | Recommended |

Stability documents roughly **6.52 GB peak VRAM** for Medium while generating a 380-second track. That gives the current 10 GB reference GPU meaningful headroom.

Stable Audio 3.0 Medium should therefore become Harmonia's default **long-form instrumental** comparison model once its provider is implemented.

Strengths:

- 2026-generation model architecture;
- strong prompt adherence;
- variable-length output;
- up to about 6m20s on Medium;
- editing/inpainting/continuation support;
- open weights for Small and Medium;
- training data described by Stability as licensed/Creative Commons;
- Community License allows broad use below Stability's stated revenue threshold.

Important limitation:

- Harmonia should not treat Stable Audio 3.0 as the controlled-lyrics vocal provider. Use ACE-Step, DiffRhythm or HeartMuLa when exact lyrics/vocals are the requirement.

Official references:

- https://stability.ai/stable-audio
- https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models

### 3.3 DiffRhythm v1.2 — free full-length vocal/song alternative

**Priority:** High experimental full-song provider.

DiffRhythm is an open full-length song-generation model with Apache 2.0 licensing for its code and DiT weights.

Current downloadable variants include:

| Variant | Nominal length | 10 GB fit |
| --- | ---: | --- |
| DiffRhythm v1.2 Base | 1m35s | Recommended with chunked decode |
| DiffRhythm v1.2 Full | 4m45s / 285s | Benchmark |

The project documents a **minimum of 8 GB VRAM for the base model** when using chunked decoding.

That places the current 10 GB development GPU inside its stated local-deployment range.

DiffRhythm supports:

- full songs;
- lyrics;
- text style prompts;
- instrumental mode;
- continuation/editing features in v1.2.

Harmonia should expose the model family as experimental until we measure the full model on the target GPU.

Official project:

- https://github.com/ASLP-lab/DiffRhythm

### 3.4 HeartMuLa 3B — current 2026 open vocal model

**Priority:** Experimental but important.

HeartMuLa is a 2026 open music foundation model focused on lyrics + tags and multilingual song generation.

The currently released open model is the 3B family. The project's weights were moved to Apache 2.0 licensing in January 2026.

Useful current model:

- `HeartMuLa-oss-3B-happy-new-year`
- `HeartCodec-oss-20260123`

The official inference documentation says:

- loading HeartMuLa + HeartCodec simultaneously requires about **10-12 GB VRAM**;
- `--lazy_load true` loads and unloads the components sequentially and is recommended for limited-VRAM single-GPU systems;
- default maximum audio length is 240,000 ms (240 seconds).

Therefore the current 10 GB GPU is near the boundary for full simultaneous loading, but is a legitimate candidate using lazy loading/offload.

Harmonia classification:

- 10 GB fit: **experimental / model swapping required**
- vocals: yes
- supplied lyrics: yes
- multilingual: yes
- commercial licensing: permissive Apache 2.0 for current released weights/code

Official project:

- https://github.com/HeartMuLa/heartlib

### 3.5 Meta MusicGen — existing baseline

**Priority:** Keep as the baseline and compatibility provider.

MusicGen remains valuable because Harmonia already has integration code for it.

Official parameter tiers:

| Model tier | Parameters | Suggested Harmonia role |
| --- | ---: | --- |
| Small | 300M | Low-resource / fast baseline |
| Medium / Melody | 1.5B | Recommended quality baseline |
| Large / Melody Large | 3.3B | Benchmark only on 10 GB |
| Stereo variants | same family tiers | Preferred over mono for finished audio |

The current Harmonia generator still hard-codes:

```python
MusicGen.get_pretrained("facebook/musicgen-small")
```

The first MusicGen improvement should be model selection, not another hard-coded replacement.

Recommended choices to expose:

- `facebook/musicgen-small`
- `facebook/musicgen-stereo-small`
- `facebook/musicgen-medium`
- `facebook/musicgen-stereo-medium`
- optionally `musicgen-melody` / stereo melody when reference melody input is implemented
- large variants behind a `Benchmark / may exceed hardware comfort` badge

Important licensing note:

- AudioCraft code: MIT
- MusicGen weights: CC-BY-NC 4.0
- therefore free for local experimentation but **not the preferred commercial-output model**

Official project:

- https://github.com/facebookresearch/audiocraft

## 4. Default Model Order for the 10 GB Workstation

Harmonia should not present a single global "best model." It should recommend based on creation goal.

### Full song with vocals / supplied lyrics

1. **ACE-Step 1.5 Turbo + 0.6B LM**
2. **DiffRhythm v1.2 Full**
3. **HeartMuLa 3B with lazy loading**
4. MusicGen only as an experimental vocal-like baseline

### Long instrumental

1. **Stable Audio 3.0 Medium**
2. ACE-Step 1.5 instrumental
3. MusicGen Stereo Medium
4. DiffRhythm instrumental

### Fast preview

1. **Stable Audio 3.0 Small Music**
2. MusicGen Small / Stereo Small
3. ACE-Step Turbo short generation

### Existing Harmonia compatibility

1. MusicGen Small
2. MusicGen Stereo Medium after worker qualification

## 5. Frontend UX

The existing Music Generation page should become provider-aware.

### 5.1 Basic selector

Add a new section above the current music parameters:

```text
Generation Engine

Provider
[ ACE-Step 1.5                         v ]

Model / Size
[ Turbo + 0.6B LM                     v ]

[Free Local] [Vocals] [Lyrics] [10 GB: Recommended]

Estimated max duration: 8:00 on this hardware profile
Model status: Ready / Download required / Updating
License: MIT / Apache / Community / Non-commercial
```

### 5.2 Free-only default

Add:

```text
[x] Free/local models only
```

Default: **enabled**.

When enabled:

- hide hosted-paid providers from ordinary choices;
- no API key prompts;
- no accidental paid calls;
- prioritize installed local models.

A later settings screen can allow:

```text
[ ] Show paid/hosted providers
```

but it must remain opt-in.

### 5.3 Model cards

Each model variant should display capability badges such as:

- `Local`
- `Free runtime`
- `Vocals`
- `Lyrics`
- `Instrumental`
- `Stereo`
- `Reference audio`
- `Editing`
- `Commercial use allowed`
- `Non-commercial weights`
- `10 GB: Recommended`
- `10 GB: Experimental`
- `10 GB: Too large`

### 5.4 Hardware-fit state

Do not hard-code the current workstation forever.

The backend should detect:

- GPU vendor;
- available VRAM;
- CUDA availability;
- system RAM;
- CPU cores;
- optional Flash Attention support.

The frontend should receive a normalized compatibility result:

```typescript
type HardwareFit =
  | 'recommended'
  | 'supported'
  | 'experimental'
  | 'unsupported';
```

### 5.5 Duration should be model-aware

The current UI globally hard-codes 15-120 seconds.

That must become dynamic.

Examples:

- MusicGen default UI target: up to 120s during current qualification
- Stable Audio 3 Small: up to 120s
- Stable Audio 3 Medium: up to 380s
- DiffRhythm Full: up to 285s
- HeartMuLa current default: up to 240s
- ACE-Step 1.5: up to 600s, further constrained by detected hardware/profile if needed

Changing model selection should update the duration control automatically without discarding the user's target unless it exceeds the selected model's limit.

## 6. Catalog Data Model

Do not scatter model names through Angular templates and Python scripts.

Create a canonical backend model catalog.

Suggested contract:

```typescript
export interface MusicModelDefinition {
  id: string;
  providerId: string;
  displayName: string;
  family: string;
  variant: string;

  parameterCount?: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;

  runtimeCost: 'local-free' | 'hosted-paid';
  licenseClass:
    | 'permissive'
    | 'community'
    | 'non-commercial'
    | 'review-required';
  commercialUse:
    | 'allowed'
    | 'restricted'
    | 'review-required';

  capabilities: {
    instrumental: boolean;
    vocals: boolean;
    suppliedLyrics: boolean;
    generatedLyrics: boolean;
    stereo: boolean;
    melodyConditioning: boolean;
    referenceAudio: boolean;
    continuation: boolean;
    inpainting: boolean;
    stemExtraction: boolean;
  };

  hardware: {
    minVramGb?: number;
    recommendedVramGb?: number;
    minRamGb?: number;
    cudaRequired?: boolean;
    cpuSupported?: boolean;
    supportsOffload?: boolean;
    supportsQuantization?: boolean;
  };

  source: {
    modelUri: string;
    documentationUri: string;
  };

  install: {
    kind: 'huggingface' | 'git' | 'python-package' | 'external-service';
    installed: boolean;
    estimatedDiskGb?: number;
  };
}
```

## 7. Provider Interface

Use a provider abstraction so model selection does not leak into controllers or Angular code.

```typescript
export interface MusicGenerationProvider {
  readonly id: string;

  listModels(): Observable<MusicModelDefinition[]>;

  generate(
    request: MusicGenerationRequest
  ): Observable<MusicGenerationJob>;

  getStatus(
    jobId: string
  ): Observable<MusicGenerationStatus>;

  cancel?(
    jobId: string
  ): Observable<void>;
}
```

Initial implementations:

```text
MusicGenProvider
AceStepProvider
StableAudioProvider
DiffRhythmProvider
HeartMuLaProvider
```

Paid providers can implement the same contract later without changing the frontend:

```text
LyriaProvider
ElevenMusicProvider
```

## 8. Backend API

Recommended endpoints:

```http
GET  /api/music/providers
GET  /api/music/models
GET  /api/music/models?runtimeCost=local-free
GET  /api/music/models/installed
GET  /api/music/hardware
GET  /api/music/compatibility

POST /api/music/models/:modelId/install
POST /api/music/models/:modelId/remove

POST /api/music/generate
GET  /api/music/jobs/:jobId
POST /api/music/jobs/:jobId/cancel
```

Generation request:

```json
{
  "providerId": "ace-step",
  "modelId": "ace-step-15-turbo-06b",
  "title": "Example",
  "prompt": "alternative rock, wide guitars, emotional male vocal",
  "lyrics": "[Verse]\n...",
  "durationSeconds": 300,
  "bpm": 96,
  "key": "D minor",
  "timeSignature": "4/4",
  "instrumentation": ["electric-guitar", "bass", "drums"]
}
```

## 9. Model Installation Workflow

Large model downloads must be visible and controlled.

UI states:

```text
Not installed
Downloading 42%
Verifying
Ready
Update available
Error
```

Do not silently download multi-gigabyte models merely because a dropdown was changed.

Selecting an uninstalled model should display:

```text
ACE-Step 1.5 Turbo is not installed locally.
Estimated disk requirement: ...
[Download Model]
```

Use WebSocket/SSE progress for downloads just as Harmonia uses real-time progress for generation jobs.

## 10. NgRx Design

The frontend should keep the provider/model state in NgRx rather than component-local promises.

Suggested feature state:

```typescript
export interface MusicModelsState {
  providers: MusicProviderDefinition[];
  models: MusicModelDefinition[];
  installedModelIds: string[];

  hardware: HardwareProfile | null;

  selectedProviderId: string | null;
  selectedModelId: string | null;

  freeOnly: boolean;
  showAdvanced: boolean;

  catalogLoading: boolean;
  installProgress: Record<string, number>;
  error: string | null;
}
```

Suggested actions:

```text
loadMusicCatalog
loadMusicCatalogSuccess
loadHardwareProfile
selectMusicProvider
selectMusicModel
setFreeOnly
installMusicModel
installMusicModelProgress
installMusicModelSuccess
generateMusic
generateMusicProgress
generateMusicSuccess
generateMusicFailure
```

Effects should own:

- HTTP catalog calls;
- hardware lookup;
- model installation;
- WebSocket/SSE job subscriptions;
- generation submission;
- progress events.

Components should remain mostly declarative and observable-driven.

## 11. Compatibility Engine

Model compatibility should be computed, not manually guessed by the Angular page.

Example output:

```json
{
  "modelId": "stable-audio-3-medium",
  "fit": "recommended",
  "reasons": [
    "10 GB VRAM exceeds verified ~6.52 GB peak reference",
    "CUDA available",
    "64 GB system RAM provides offload headroom"
  ]
}
```

Another example:

```json
{
  "modelId": "heartmula-3b",
  "fit": "experimental",
  "reasons": [
    "10 GB VRAM is near simultaneous-load requirement",
    "lazy loading/model swap required"
  ]
}
```

## 12. Implementation Phases

### Phase 0 — current runtime recovery

Do this first.

- fix/qualify Harmonia's existing worker;
- prove AudioCraft/MusicGen imports;
- resolve the Mongo 27017 collision;
- make `start:all` reliable;
- merge the runtime lifecycle PR.

### Phase 1 — catalog architecture

Create `feat/music-provider-catalog`.

- add canonical provider/model interfaces;
- add static catalog entries;
- add hardware-detection endpoint;
- add model compatibility endpoint;
- expose catalog through NestJS;
- add tests.

No new ML model needs to be installed in this phase.

### Phase 2 — Angular selector

- add provider selector;
- add model/size selector;
- enable `Free/local only` by default;
- capability badges;
- hardware-fit badges;
- dynamic duration limits;
- NgRx state/effects/selectors;
- unit tests.

At this point MusicGen can remain the only functional provider while the UI/catalog architecture is proven.

### Phase 3 — modern MusicGen baseline

- fix AudioCraft dependencies;
- make MusicGen model ID configurable;
- qualify Small;
- qualify Stereo Medium;
- measure 30 / 60 / 120-second generation;
- store benchmark metadata.

### Phase 4 — Stable Audio 3.0

Add separate provider/runtime rather than contaminating the existing MusicGen environment.

Qualification:

1. Small Music 30s
2. Small Music 120s
3. Medium 30s
4. Medium 120s
5. Medium 300s
6. Medium 380s

Record VRAM, RAM, runtime and output format.

### Phase 5 — ACE-Step 1.5

Run as its own service.

Qualification:

1. health endpoint;
2. 30s instrumental;
3. 30s vocal with supplied lyrics;
4. 120s;
5. 240s;
6. 300s full song;
7. optional 480s stress test.

Start with 2B Turbo + 0.6B LM for the 10 GB GPU.

### Phase 6 — DiffRhythm

- v1.2 Base with chunked decode;
- v1.2 Full;
- supplied lyrics;
- 95s and 285s generations;
- measure whether Full is comfortable at 10 GB.

### Phase 7 — HeartMuLa

- 3B current model;
- lazy-load mode;
- 60s then 240s;
- evaluate lyrics controllability vs ACE-Step and DiffRhythm.

### Phase 8 — provider comparison

Add a repeatable Harmonia benchmark harness.

Record:

- model/provider;
- prompt;
- duration;
- seed if supported;
- GPU;
- peak VRAM;
- peak system RAM;
- generation wall time;
- output sample rate/channels;
- lyrics adherence;
- structural coherence;
- subjective quality notes.

Do not choose a permanent default until measurements exist.

## 13. Initial Product Defaults

Until benchmarks prove otherwise:

```text
Free/local only: ON

Fast preview:
  Stable Audio 3.0 Small Music

Instrumental / long:
  Stable Audio 3.0 Medium

Full song + vocals:
  ACE-Step 1.5 Turbo + 0.6B LM

Existing compatibility:
  MusicGen Small

Experimental:
  DiffRhythm v1.2 Full
  HeartMuLa 3B
```

The UI should still allow manual selection of every installed compatible model.

## 14. Models Not Active by Default

### Google Lyria

Public and technically attractive, but currently paid per request. Keep documented and hidden when `Free/local only` is enabled.

### Eleven Music

Strong hosted full-song option, but paid. Keep behind future hosted-provider opt-in.

### YuE

Open full-song research model, but its official guidance indicates substantially heavier GPU requirements for long-form generation than the current workstation. Do not prioritize for this hardware tier.

## 15. Acceptance Criteria

The provider/model selector is complete when:

- no music model is hard-coded in Angular;
- no MusicGen model ID is hard-coded in the Python generation path;
- frontend can list providers and variants from the backend;
- `Free/local only` is enabled by default;
- model selection changes valid duration/capability controls;
- incompatible models are clearly marked;
- uninstalled models require explicit download action;
- generation request records provider + model ID;
- generated library metadata records provider + model ID;
- NgRx owns catalog/selection/install state;
- provider-specific services are isolated behind a common interface;
- changing providers does not require changing Angular generation logic.

## 16. Decision Record — September 22, 2026

- Harmonia will evolve from a single-MusicGen UI into a **multi-provider, multi-model local music workstation**.
- Free/self-hosted generation is the default requirement until project funding changes.
- The current 10 GB VRAM / 64 GB RAM / 20-core workstation is sufficient to make modern local models useful.
- Stable Audio 3.0 Medium is a strong current instrumental target.
- ACE-Step 1.5 is the strongest initial full-song/vocal target for this hardware tier.
- DiffRhythm v1.2 is a strong Apache-licensed full-song alternative and fits the documented 8 GB minimum for its base model.
- HeartMuLa 3B is viable for experimentation using lazy loading/model swapping.
- MusicGen remains the existing baseline but should become selectable rather than hard-coded.
- Paid providers remain architecturally possible but are hidden by default.
