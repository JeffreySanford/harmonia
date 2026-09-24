# Music Generation Provider Status and Roadmap

**Last reviewed:** September 22, 2026  
**Purpose:** Record the current Harmonia music-generation stack, what is actually running today, current upstream options, and deferred provider experiments without changing the active runtime architecture.

> This document is intentionally descriptive. The immediate priority is to restore and qualify the existing MusicGen-based Harmonia pipeline before replacing it.
>
> **Free/local implementation plan:** Harmonia's planned provider/model-size selector, hardware-fit catalog, NgRx design, and current free model priorities are documented in [Free Local Music Model Catalog and Frontend Selector Plan](./FREE_LOCAL_MUSIC_MODEL_CATALOG.md). The initial active local families are MusicGen, Stable Audio 3.0, ACE-Step 1.5, DiffRhythm, and HeartMuLa. Paid hosted providers remain optional and hidden by default while free-only mode is enabled.

## 1. Current Harmonia Strategy

Harmonia uses a two-stage generation model:

1. **Song planning / metadata** — Ollama/LLM produces title, lyrics, genre, mood, tempo and other structured information.
2. **Audio synthesis** — MusicGen produces music audio, while the worker also contains experimental vocal/singing components such as DiffSinger and a HiFi-GAN vocoder.

The current architecture is valuable because the orchestration, job model, WebSocket progress, artifact storage and NgRx workflow do not need to be replaced when another music provider is tested later.

A future provider abstraction should preserve this shape:

```text
Angular / NgRx
      |
      v
NestJS generation job
      |
      +-- MusicGenProvider        current local path
      +-- AceStepProvider         deferred local/open provider
      +-- LyriaProvider           deferred Google-hosted provider
      +-- ElevenMusicProvider     deferred hosted provider
```

## 2. MusicGen: What Harmonia Is Actually Using

### 2.1 Runtime model today

The current generation script is:

`scripts/generate_musicgen_audio.py`

It currently loads:

```python
MusicGen.get_pretrained("facebook/musicgen-small")
```

So the **runtime is not currently selecting the largest or newest MusicGen variant**. It is hard-coded to the 300M-parameter `facebook/musicgen-small` model for speed and lower memory usage.

The repository's downloader is broader than the runtime. `scripts/download_musicgen_full.sh` knows about multiple official Meta models, including:

- `facebook/musicgen-small`
- `facebook/musicgen-medium`
- `facebook/musicgen-large`
- `facebook/musicgen-melody`
- `facebook/musicgen-melody-large`
- `facebook/musicgen-stereo-small`
- `facebook/musicgen-stereo-medium`
- `facebook/musicgen-stereo-large`
- `facebook/musicgen-stereo-melody`
- `facebook/musicgen-stereo-melody-large`

This means Harmonia already has download/inventory concepts for better MusicGen variants, but the active inference script does not yet expose a model-selection parameter.

### 2.2 Is there a newer MusicGen generation?

As of September 22, 2026, Meta's official MusicGen model card still identifies the core MusicGen release as **model version 1**. There is no official "MusicGen 2" release that Harmonia is simply failing to pick up.

Meta did extend the family after the original mono models:

- stereo MusicGen variants
- `musicgen-melody-large`
- MusicGen-Style
- newer AudioCraft research models such as MAGNeT and JASCO

The official MusicGen documentation continues to describe `musicgen-medium` and `musicgen-melody` as strong quality/compute tradeoffs. The stereo family is the most obvious near-term MusicGen experiment for Harmonia because it improves output presentation without requiring a completely different provider architecture.

Official references:

- <https://github.com/facebookresearch/audiocraft>
- <https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md>
- <https://github.com/facebookresearch/audiocraft/blob/main/model_cards/MUSICGEN_MODEL_CARD.md>
- <https://ai.meta.com/resources/models-and-libraries/audiocraft>

### 2.3 AudioCraft version

The current stable PyPI release of AudioCraft is **1.3.0**. Meta's repository changelog contains later pre-release development entries, including 1.4.0 alpha work, but PyPI stable remains 1.3.0.

Harmonia currently declares:

```text
audiocraft>=0.2.0
```

This is too loose for a reproducible ML worker. A later hardening task should pin a qualified AudioCraft/PyTorch/torchaudio/xformers set after we prove which combination works on the target hardware.

Meta's current official installation guidance still documents Python 3.9 and PyTorch 2.1.0 for AudioCraft. This matters because Harmonia's current worker image is using Python 3.11 and, during the September 22 rebuild, pip selected a much newer PyTorch.

Official stable package:

- <https://pypi.org/project/audiocraft/>

### 2.4 Known worker dependency problem discovered September 22, 2026

The current worker requirements include:

```text
numba==0.57.5
```

That NumPy/Numba version does not exist on PyPI. During the current Docker build, the bulk requirements installation failed at this point.

The Dockerfile currently masks that failure with:

```dockerfile
pip install ... -r /workspace/requirements.txt || true
```

The image therefore continues building even when the MusicGen/AudioCraft dependency transaction fails.

Later Dockerfile steps separately installed Torch and torchaudio, but they did **not prove that AudioCraft itself was installed**. Before treating the worker as MusicGen-capable, verify inside the running worker:

```bash
python -c "import audiocraft; print(audiocraft.__version__)"
python -c "from audiocraft.models import MusicGen; print('MusicGen import OK')"
```

This should become an explicit worker health/qualification check rather than relying on Docker build success alone.

### 2.5 How far to push MusicGen before replacing it

The first goal is to establish a reliable baseline with the existing model before changing providers.

Recommended qualification sequence:

1. Verify AudioCraft imports successfully.
2. Generate a 5-second `musicgen-small` instrumental.
3. Generate 30 seconds and record runtime, VRAM/RAM and output quality.
4. Test `musicgen-stereo-medium` as the first quality upgrade.
5. Test 60-second output.
6. Test 120-second extended generation.
7. Compare the normal EnCodec decoder with MultiBand Diffusion if practical.
8. Only after those baselines, decide whether longer-form composition should remain MusicGen-based.

Meta's official demo supports extended generation up to 120 seconds using overlapping windows. The demo notes that long generations can lose consistency or decide that the song has ended. Its long-form approach keeps an overlap with the previous chunk and generates new audio in successive windows.

That makes MusicGen useful for experimentation, instrument beds, accompaniment and shorter compositions, but it should not be assumed to provide coherent five-minute songs simply by increasing one duration field.

### 2.6 Vocal limitation

MusicGen can produce music containing vocal-like or singing content from descriptive prompts, but it is **not a reliable lyric-aligned singing synthesizer**.

Harmonia's current behavior of placing lyrics or singing instructions inside a MusicGen prompt is therefore an experiment, not precise vocal synthesis. Exact lyric timing, singer identity/control and repeatable vocal phrasing require a singing-specific system or a newer end-to-end song model.

### 2.7 MusicGen licensing

AudioCraft code is MIT licensed. Meta's published MusicGen model weights are CC-BY-NC 4.0.

That non-commercial model-weight license must remain part of any future Harmonia commercialization decision.

### 2.8 September 23, 2026 qualification result

The restored Harmonia MusicGen path is now product-qualified through the real persistent-job workflow.

Qualified local models:

- `musicgen-small` / `facebook/musicgen-small`
  - persistent authenticated job completed successfully
  - 8.00-second WAV artifact
  - mono, 32 kHz, 16-bit PCM
  - backend download HTTP 200
  - frontend-proxied download HTTP 200
- `musicgen-stereo-small` / `facebook/musicgen-stereo-small`
  - runtime switched through the provider lifecycle rather than a pre-started container
  - persistent authenticated job completed successfully
  - 8.00-second WAV artifact
  - stereo (2 channels), 32 kHz, 16-bit PCM
  - backend download HTTP 200
  - frontend-proxied download HTTP 200

The provider container is intentionally started on demand through the backend music-runtime selector. It is not part of the default `start:all` Compose profiles.

This establishes MusicGen Small and Stereo Small as the current known-good local baselines before moving to DiffSinger and the remaining provider roadmap.

### 2.9 September 23, 2026 DiffSinger qualification result

The isolated DiffSinger provider is now qualified through the same durable product
boundary used by MusicGen.

Qualified runtime stack:

- OpenVPI DiffSinger pinned to `017bd488a61ebdb8909a8d272ec6211076fa4a7e`
- Python 3.8.10
- PyTorch 1.8.2+cu111
- CUDA available
- `0228_opencpop_ds100_rel` acoustic model
- `0102_xiaoma_pe` pitch estimator
- `0109_hifigan_bigpopcs_hop128` HiFi-GAN vocoder

Qualified inference result:

- real RIFF/WAVE output, no placeholder path
- 8.75-second mono vocal artifact
- 24 kHz, 16-bit PCM
- isolated provider remains healthy after inference

Qualified persistent-job result:

- authenticated `POST /api/jobs`
- durable MongoDB job lifecycle
- provider-native runtime model id `0228_opencpop_ds100_rel`
- durable score request persisted beside the job output
- score duration 8.75 seconds and generated WAV duration 8.75 seconds
- backend download HTTP 200
- frontend-proxied download HTTP 200

The Angular music-generation surface is separated into provider-native forms:
MusicGen retains prompt/duration controls, while DiffSinger exposes lyrics/text,
notes, and note durations. This avoids treating score-based singing synthesis as
prompt-to-music generation.

Qualified Angular UI result:

- provider-specific DiffSinger score form renders successfully
- frontend lint completed with warnings only and zero errors
- 52 frontend unit tests passed
- Angular production build passed
- Storybook static build passed
- both Storybook browser suites passed
- 10 Storybook interaction tests passed
- DiffSinger score interaction dispatches a real persistent generation job contract

This completes the DiffSinger phase across runtime, inference, persistent jobs,
downloads, and the Angular score-generation UI.

### Stable Audio 3 Small-Music qualification result

Stable Audio 3 Small-Music has passed direct local inference qualification on
the Harmonia development workstation.

Qualified runtime:

- provider image: `harmonia/stable-audio-3:dev`
- upstream Stable Audio 3 revision:
  `779434a908193105335fd8d833418603625b2859`
- runtime model id: `small-music`
- PyTorch 2.7.1+cu126
- torchaudio 2.7.1+cu126
- CUDA available
- NVIDIA GeForce RTX 3080
- gated Hugging Face model access confirmed for the configured account

Qualified inference result:

- prompt-to-music generation completed successfully
- requested duration: 8.00 seconds
- actual duration: 8.00 seconds
- stereo output
- 44.1 kHz sample rate
- 32-bit IEEE float WAV
- artifact size: 2,822,488 bytes
- first qualified generation elapsed time: 84.34 seconds
- provider remained resident, healthy, and idle after generation

Persistent-job qualification also passed through the same durable product
boundary used by MusicGen and DiffSinger:

- authenticated `POST /api/jobs`
- durable MongoDB job lifecycle
- provider-native runtime model id `small-music`
- output path `/downloads/jobs/<jobId>/music.wav`
- stereo, 44.1 kHz, 32-bit IEEE float WAV
- requested and actual duration: 8.00 seconds
- artifact size: 2,822,488 bytes
- resident-model persistent generation elapsed time: 12.19 seconds
- backend download HTTP 200
- frontend-proxied download HTTP 200
- provider remained healthy and idle on the NVIDIA GeForce RTX 3080

Stable Audio 3 Small-Music is therefore qualified through direct inference and
the durable Harmonia job/download boundary. The remaining product-facing work
for this model is Angular prompt-form qualification, not backend/runtime proof.

## 3. Google Music Generation: Lyria Is Now Public

When Harmonia was originally designed, Google's higher-end music generation work was not exposed as a normal developer API. That has changed.

As of September 2026, Google exposes **Lyria 3.5 through the Gemini API**.

### 3.1 Current public models

Relevant Google models include:

- `lyria-3.5` — flagship full-song model
- `lyria-3-clip-preview` — short clip model
- `lyria-realtime-exp` — interactive real-time music generation

Lyria 3.5 produces **44.1 kHz stereo audio**, supports vocals and lyrics, understands song structure, and can accept text or image inputs.

Google describes Lyria 3.5 full songs as lasting a **couple of minutes**, with duration influenced through the prompt. It should therefore not currently be treated as Harmonia's five-minute provider.

Official references:

- <https://ai.google.dev/gemini-api/docs/music-generation>
- <https://ai.google.dev/gemini-api/docs/models/lyria-3.5>
- <https://ai.google.dev/gemini-api/docs/lyria-prompt-guide>

### 3.2 API methodology

Authentication uses a Gemini API key such as:

```text
GEMINI_API_KEY=...
```

The current Interactions API request is conceptually:

```http
POST https://generativelanguage.googleapis.com/v1beta/interactions
Content-Type: application/json
x-goog-api-key: $GEMINI_API_KEY
```

Example payload:

```json
{
  "model": "lyria-3.5",
  "input": "Create a structured alternative-rock song with a quiet intro, verse, large chorus and bridge. Male vocals, 96 BPM, D minor."
}
```

Google also supports timestamp-oriented structural prompts, for example:

```text
[0:00 - 0:10] Intro: sparse piano and room ambience
[0:10 - 0:40] Verse 1: restrained drums and male vocal
[0:40 - 1:00] Chorus: full band and wider harmony
```

This maps well to Harmonia's existing section/metadata concepts.

### 3.3 Lyrics and output parsing

Lyria responses can include both audio and text/lyrics. Google's Interactions API exposes the generated output as a sequence of steps/content blocks.

A provider integration should preserve both:

- generated audio artifact
- generated or returned lyrics/structure metadata

The convenience response fields include audio and text output, while the raw `steps` structure is available for more detailed parsing.

### 3.4 Output formats

Lyria 3.5 defaults to MP3 and can also return WAV when the request asks for an audio response format.

### 3.5 Important operational constraints

Google currently documents:

- safety filtering on prompts
- blocking of requests for specific artist voices or copyrighted lyrics
- SynthID watermarking in generated audio
- nondeterministic results between calls
- single-turn generation rather than iterative multi-turn editing

### 3.6 Cost / "free API" status

Lyria is now public to developers, but it is **not currently a free-tier music API**.

As of September 22, 2026, Google's Gemini API pricing page lists:

- Lyria 3.5 full song: **$0.08 per request**
- Free tier: **not available**

Official pricing:

- <https://ai.google.dev/gemini-api/docs/pricing>

This is inexpensive enough to be useful as an optional comparison provider, but it should not be described in Harmonia as a free local/public replacement for MusicGen.

## 4. ACE-Step 1.5: Deferred Local Full-Song Provider

ACE-Step 1.5 is worth preserving as a future experiment, but it should **not** be installed into the existing `harmonia-worker`.

The cleaner architecture is to run it as an independent service:

```text
NestJS
  |
  +-- HTTP --> ACE-Step service :8001
```

The official ACE-Step 1.5 project now provides Docker support and a REST API mode:

```text
ACESTEP_MODE=api
```

Its Docker image exposes port 8001 and has an API health endpoint.

The asynchronous API workflow is:

1. `POST /release_task`
2. receive `task_id`
3. poll `POST /query_result`
4. retrieve generated audio through `GET /v1/audio`

This aligns closely with Harmonia's existing job architecture.

ACE-Step's documented generation duration range is **10 to 600 seconds**, making it much closer to the five-minute-song requirement than current MusicGen or Lyria.

Useful controls include BPM, key/scale, time signature and target duration. The API can run with language-model planning enabled or disabled.

Official references:

- <https://github.com/ace-step/ACE-Step-1.5>
- <https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/API.md>
- <https://github.com/ace-step/ACE-Step-1.5/blob/main/docker-compose.yml>

### Deferred Harmonia design

Do not make ACE-Step part of the default `start:all` path.

A later optional profile could conceptually become:

```text
pnpm start:all --ace
```

with configuration such as:

```text
ACE_STEP_ENABLED=true
ACE_STEP_URL=http://localhost:8001
```

The first proof should be a short REST-generated vocal track before attempting a 300-second song.

## 5. Eleven Music: Deferred Hosted Five-Minute Provider

ElevenLabs now exposes an official music API.

As of September 2026, its documentation identifies **Music v2.5** as its most advanced music model. It supports prompts, structured composition plans, vocals, MP3/WAV output and an official REST API.

The public compose endpoint is:

```http
POST /v1/music
```

ElevenLabs documents generated music up to **five minutes** in its current product overview. Composition plans provide per-section control over lyrics, duration and style, which maps well to Harmonia's section-oriented song metadata.

Official references:

- <https://elevenlabs.io/docs/overview/capabilities/music>
- <https://elevenlabs.io/docs/api-reference/music/compose>
- <https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans>

This is a hosted/paid provider and should remain optional rather than becoming a dependency of the local Harmonia development stack.

## 6. Recommended Provider Direction

### Now

Keep the existing stack focused:

```text
Ollama -> Harmonia metadata -> MusicGen -> artifacts
```

Qualify what is actually installed and make MusicGen reproducible before adding providers.

### First MusicGen improvements

After runtime recovery:

1. Make the MusicGen model ID configurable instead of hard-coded.
2. Establish `musicgen-small` as a baseline.
3. Compare `musicgen-stereo-medium`.
4. Record generation time and memory usage.
5. Test 30 / 60 / 120-second generations.
6. Decide whether MultiBand Diffusion improves output enough to justify its cost.
7. Keep vocal synthesis evaluation separate from instrumental MusicGen evaluation.

### Later provider interface

A future backend abstraction could look like:

```typescript
interface MusicGenerationProvider {
  generate(request: SongGenerationRequest): Observable<GenerationJob>;
  status(jobId: string): Observable<GenerationStatus>;
  result(jobId: string): Observable<GeneratedSong>;
}
```

Possible implementations:

```text
MusicGenProvider       local, current baseline
AceStepProvider        local, optional, long-form/vocals
LyriaProvider          hosted Google comparison
ElevenMusicProvider    hosted five-minute comparison
```

Provider integration should happen **after** the current runtime, tests and MusicGen baseline are stable.

## 7. Decision Record

### September 22, 2026

- Continue restoring Harmonia with its existing MusicGen architecture.
- Do not replace MusicGen during the current runtime-recovery work.
- Document ACE-Step 1.5 rather than integrate it now.
- Document Google Lyria because it is now publicly available through the Gemini API.
- Treat Lyria as paid, not free.
- Keep Eleven Music as another optional hosted candidate.
- Before evaluating MusicGen quality, fix/qualify the worker dependency installation and prove that AudioCraft/MusicGen imports successfully.
- Prefer evidence from repeatable Harmonia generation tests over changing providers based only on model demos.
