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
- future `harmonia/musicgen:dev`
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
