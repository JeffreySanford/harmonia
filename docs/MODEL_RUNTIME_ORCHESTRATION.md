# Model Runtime Orchestration

## Purpose

Harmonia treats each music-generation provider family as an isolated runtime.
The application does not keep every GPU-heavy provider resident at the same
time. Provider images can be built and cached locally while containers remain
stopped until a model from that provider is selected.

This keeps incompatible Python, PyTorch and model dependencies out of one
monolithic worker and prevents multiple providers from competing for the same
GPU memory.

## Runtime boundary

Use one image/runtime per provider family, not one image per model size.

Examples:

- `harmonia/diffsinger:dev`
- `harmonia/musicgen:dev`
- future `harmonia/stable-audio:dev`
- future `harmonia/acestep:dev`
- future `harmonia/diffrhythm:dev`
- future `harmonia/heartmula:dev`

Model variants and sizes are selected within that provider runtime.

## Lifecycle

The orchestration state machine is:

`stopped -> building -> starting -> health-checking -> healthy -> ready`

Generation can later add:

`ready -> busy -> ready`

Provider switching uses:

`ready -> stopping -> stopped -> starting -> health-checking -> healthy -> ready`

Errors transition to `error` and preserve the failure message for the UI.

## User experience

The Angular music-generation page shows:

- detected GPU and VRAM;
- provider selector;
- model/size selector;
- hardware-fit status;
- disabled models with an explicit reason;
- permanent runtime health/status card;
- one updating Material snackbar for lifecycle transitions.

NgRx owns runtime state. NestJS owns Docker orchestration. Socket.IO carries
runtime transition events from NestJS to NgRx.

A short-lived transition such as a successful health check is deliberately
made visible before the terminal `ready` notification replaces it.

## GPU policy

Only the selected provider should own significant GPU memory. When switching
provider families, Harmonia stops the current provider before starting the
next one.

The model catalog can show models above the current machine's capacity. Those
entries stay disabled and explain the minimum VRAM requirement instead of
disappearing from the UI.

## Model cache policy

Large model files do not belong in Docker image layers.

Provider model/checkpoint data belongs under the gitignored `models/`
workspace and is mounted into the provider container. For example, the
DiffSinger HiFi-GAN vocoder is cached under `models/diffsinger/hifigan` and
downloaded only when it is missing.

## Build progress

First-time provider image builds stream Docker BuildKit output through NestJS.
The UI receives step updates plus a 10-second heartbeat for long-running build
steps, so model startup never appears frozen while dependencies are installing.

## DiffSinger reference implementation

DiffSinger is the first extracted provider runtime:

- image: `harmonia/diffsinger:dev`;
- Compose service: `diffsinger`;
- Compose profile: `model-diffsinger`;
- container: `harmonia-diffsinger`;
- health sentinel: `/tmp/harmonia-runtime-ready`;
- persistent model root: `models/diffsinger`.

Normal `pnpm start:all` does not activate the `model-diffsinger` profile.
The NestJS runtime orchestrator starts it when the user explicitly selects a
compatible DiffSinger model.

## API

Current runtime endpoints:

- `GET /api/music/runtime/catalog`
- `GET /api/music/runtime/status`
- `POST /api/music/runtime/select`
- `POST /api/music/runtime/stop`

Socket.IO event:

- `music-runtime:status`

## Generation integrity

The Music Generation UI must never report a successful audio generation unless
a provider adapter returns a real artifact URL. The former
`/assets/sample-audio.mp3` simulation has been removed.

Provider-specific generation adapters are the next implementation layer after
runtime orchestration.

## MusicGen reference implementation

MusicGen is the second isolated provider runtime:

- image: `harmonia/musicgen:dev`;
- Compose service: `musicgen`;
- Compose profile: `model-musicgen`;
- container: `harmonia-musicgen`;
- Python: 3.9;
- PyTorch: 2.1.0;
- AudioCraft: 1.3.0;
- persistent model/cache root: `models/musicgen`.

The provider container validates AudioCraft, CUDA and the selected GPU before
marking itself healthy. Model weights are intentionally not loaded during the
container health check; they are cached under the persistent model root on
first inference.

For the current 10 GB RTX 3080 target:

- MusicGen Small (300M) is selectable;
- MusicGen Stereo Small (300M) is selectable;
- MusicGen Medium and Stereo Medium remain visible but disabled at the
  catalog's 16 GB VRAM threshold.

The existing stem-generation code now targets `harmonia-musicgen` instead of
the generic worker. MusicGen weights remain CC-BY-NC 4.0, so the catalog marks
them as commercially restricted.


## Persistent MusicGen inference

MusicGen runs a container-local provider server on `127.0.0.1:8765`. The port
is intentionally not published to the host. Nest invokes a small client with
`docker exec`; the client sends generation requests to the resident process.

The first generation for a selected MusicGen model loads the model from the
persistent Hugging Face cache into GPU memory. Later generations reuse the
resident model instead of reloading weights. Selecting another MusicGen model
causes the provider to unload the current model, release CUDA cache, and lazily
load the new model on the next generation.

Generation lifecycle:

```text
ready
  -> busy
  -> ready
```

Provider stop terminates the resident process and releases GPU memory. Model
weights remain cached under `models/musicgen/` for future starts.
