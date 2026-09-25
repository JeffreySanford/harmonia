# Qualified Generator Showcase

This directory contains the source presets for one representative, dated sample
from each Harmonia generator that has completed local product qualification.

Generated audio is intentionally written under the gitignored runtime export
tree:

```text
exports/showcase/<model-id>/YYYY-MM-DD--<slug>.wav
```

Each output folder also receives the dated request and completed durable-job
metadata used to create the WAV.

## Presets

- `musicgen-small` — **Northern Transmission**
  - compact instrumental alternative/roots-rock cue;
  - mono/stereo behavior is whatever the qualified Small runtime emits;
  - no lyrics because MusicGen Small is text-to-music, not lyric-conditioned.

- `musicgen-stereo-small` — **Midnight Prairie**
  - wide atmospheric indie-electronic night-drive cue;
  - designed to exercise the qualified stereo runtime;
  - no lyrics.

- `diffsinger-acoustic-hifigan` — **向北 / Northbound**
  - original short Mandarin lyric;
  - score-native OpenCpop input with explicit notes and durations;
  - DiffSinger does not consume a free-text style prompt in the qualified path.

- `stable-audio-3-small-music` — **Aurora Circuit**
  - cinematic electronic/post-rock instrumental;
  - no lyrics because the qualified Stable Audio path is prompt-conditioned
    instrumental generation.

- `acestep-v15-turbo-06b` — **True North Keeps Us Moving**
  - supplied original English lyrics;
  - uplifting alternative rock with an Americana undertone;
  - exercises the resident Turbo DiT and 0.6B LM.

## Run

Use the committed package command after the current Harmonia backend/frontend
are available:

```bash
corepack pnpm@12.6.0 showcase:qualified-generators
```

Optional environment overrides:

- `HARMONIA_SHOWCASE_BACKEND_BASE`
- `HARMONIA_SHOWCASE_FRONTEND_BASE`
- `SHOWCASE_DATE=YYYY-MM-DD`
- `SHOWCASE_ONLY=model-id[,model-id]`

Without an explicit backend override, the runner prefers the current isolated
qualification backend at port 3112 and falls back to port 3000.
