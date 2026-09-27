# M15-F4 Qualification Report — 2026-09-27

## Result

**GREEN — 10/10 standard Harmonia model qualification cases verified.**

- 5/5 smoke cases
- 5/5 deep cases
- 5/5 installed qualified generator models represented
- all retained WAV files match their recorded SHA-256 values
- all backend artifact retrievals returned HTTP 200
- all frontend proxy artifact retrievals returned HTTP 200
- all latest listening copies are byte-identical to retained evidence
- no audio was regenerated during final evidence consolidation

Source Git SHA: `7a831d40fbc7860d9088cf22301c31d984cfff3b`

Evidence consolidation timestamp: `2026-09-27T14:51:50.656Z`

## Standard qualification matrix

| Profile | Case | Model | Ch | Hz | Seconds | SHA-256 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| smoke | `musicgen-small-granite-skyline` | `musicgen-small` | 1 | 32000 | 12.00 | `ceacb561cd329f5f87a4c9e910c20521a21432cf49daf9073dcfce15c02981f3` |
| deep | `musicgen-small-paper-constellations` | `musicgen-small` | 1 | 32000 | 12.00 | `ea3106dc518fe705aad274594406404bad24eb247caa7cfa092a40535bc90d3b` |
| smoke | `musicgen-stereo-small-glass-horizon` | `musicgen-stereo-small` | 2 | 32000 | 12.00 | `bd2afc843329dfc5bbe9b79fc113454ef08116af37f5cdf7ed1275675843d5fe` |
| deep | `musicgen-stereo-small-neon-river` | `musicgen-stereo-small` | 2 | 32000 | 12.00 | `c0889f22b45f430377c2065d79fdd7696963570194a5023a907985b08a8ccef0` |
| smoke | `diffsinger-northbound-score` | `diffsinger-acoustic-hifigan` | 1 | 24000 | 8.75 | `f066bf65e243f3672ed3f76228f104d57bf09ddf6a8003633c0dd5ba63ea9d57` |
| deep | `diffsinger-starlight-score` | `diffsinger-acoustic-hifigan` | 1 | 24000 | 8.80 | `ac0f64bb0d8d809d497597dfa4f1ad2b28c38c3ac2588f374585d59b8473801f` |
| smoke | `stable-audio-signal-bloom` | `stable-audio-3-small-music` | 2 | 44100 | 15.00 | `3462aa3b4b3a9560958a06a97d15f4f020cf3e587c068d1bed5d857bc4f91dab` |
| deep | `stable-audio-foundry-snow` | `stable-audio-3-small-music` | 2 | 44100 | 15.00 | `e549cfbe8bde4e79be2197c134c1b5fdc31c7b2a87edcdafb797921eb2090a81` |
| smoke | `ace-step-miles-of-light` | `acestep-v15-turbo-06b` | 2 | 48000 | 30.00 | `ab84c470d3c4dc66d35e25de473e1d426863587208e484367c771e959fc3ed68` |
| deep | `ace-step-rumbo-al-norte` | `acestep-v15-turbo-06b` | 2 | 48000 | 30.00 | `ff38e2af926c9dbe24ab2f02ec8688f5c0ab5ab2b5bd0a21cd2e6612bf2652f1` |

## Qualification interpretation

The standard matrix establishes real end-to-end generation for the
five installed and selectable Harmonia generator models.

Each model has both a representative smoke case and a contrasting
deep case.

The matrix covers:

- MusicGen Small mono generation
- MusicGen Stereo Small stereo generation
- score-native OpenCpop DiffSinger synthesis
- Stable Audio 3 Small Music native stereo float WAV generation
- ACE-Step 1.5 Turbo full-song supplied-lyrics generation

## Evidence locations

Runtime evidence remains local and intentionally ignored by Git:

- `generated/evidence/model-matrix/<date>/<case>/result.json`
- `generated/evidence/model-matrix/<date>/<case>/music.wav`
- `generated/evidence/model-matrix/latest-samples/<case>.wav`
- `generated/evidence/model-matrix/M15-F4-qualified-10-of-10.json`

Large generated audio artifacts are not committed to the repository.

## Manual DiffSinger opera experiment

The separate case `diffsinger-dusk-drums-opera` is not part of the
10/10 standard matrix.

That experiment technically generated successfully but failed human
listening review for the requested male Chinese-opera-style use case.

Observed issues included female vocal identity, poor intelligibility
and prominent breath/noise artifacts.

The result remains useful negative evidence and does not invalidate
the qualified OpenCpop DiffSinger runtime.

The separate OpenUTAU male-Mandarin expansion remains deferred future
work.

## Final status

**M15-F4 standard technical qualification: COMPLETE.**

**5 smoke + 5 deep = 10/10 GREEN.**
