# Qualified Generator Showcase — 2026-09-25

## Status

**QUALIFIED — 5 OF 5 GENERATORS**

The Harmonia local generator runtime successfully produced or reused validated
showcase artifacts for every currently qualified generator using a fresh backend
from the current feature branch.

## Qualified generators

| Model | Showcase | Channels | Sample rate | Format | Duration |
|---|---|---:|---:|---:|---:|
| MusicGen Small | Northern Transmission | 1 | 32000 Hz | PCM 16-bit | 12.00 s |
| MusicGen Stereo Small | Midnight Prairie | 2 | 32000 Hz | PCM 16-bit | 12.00 s |
| DiffSinger Acoustic + HiFi-GAN | Northbound | 1 | 24000 Hz | PCM 16-bit | 8.752 s |
| Stable Audio 3 Small-Music | Aurora Circuit | 2 | 44100 Hz | IEEE float 32-bit | 15.00 s |
| ACE-Step 1.5 Turbo + 0.6B LM | True North Keeps Us Moving | 2 | 48000 Hz | PCM 16-bit | 30.00 s |

Manifest:

`exports/showcase/2026-09-25--qualified-generators.manifest.json`

## Qualification result

The fresh-backend showcase completed with:

- `QUALIFIED_GENERATOR_SHOWCASE_OK`
- `QUALIFIED_GENERATOR_SHOWCASE_MANIFEST_5_OF_5_OK`
- `QUALIFIED GENERATOR SHOWCASE: GREEN`
- five validated WAV artifacts
- backend download HTTP 200 for all five models
- frontend download HTTP 200 for all five models

## Resume behavior

The showcase correctly reused already-qualified dated artifacts for:

- `musicgen-small`
- `musicgen-stereo-small`

This avoided unnecessarily regenerating successful samples while allowing the
remaining providers to continue qualification.

## DiffSinger qualification

DiffSinger successfully:

1. selected the Acoustic + HiFi-GAN runtime,
2. reached healthy runtime state,
3. accepted score-native synthesis input,
4. completed a persistent generation job,
5. returned a real 8.752-second WAV artifact.

A prior showcase attempt was interrupted by Node/Undici's request header timeout
while the synchronous runtime selection request waited for a cold provider Docker
build. Harmonia itself remained healthy.

The qualification path was corrected by:

- allowing long provider-selection HTTP requests,
- excluding runtime/model/export/artifact/generated data from Docker build
  contexts,
- locking resume and lean-build-context behavior into the runtime contract.

## Stable Audio qualification

Stable Audio 3 Small-Music successfully generated a native stereo,
44.1 kHz, 32-bit floating-point WAV artifact.

## ACE-Step qualification

ACE-Step 1.5 Turbo with the 0.6B language model successfully generated the
30-second supplied-lyrics showcase song and returned a stereo 48 kHz WAV artifact.

## Regression evidence

The runtime contract passed:

- tests: 51
- passed: 51
- failed: 0

`git diff --check` also completed successfully.

## Relevant commits

- `92a0537` — perf(docker): exclude runtime data from provider build contexts
- `652dfb9` — fix(showcase): resume dated samples and allow long provider selection
- `a5183e6` — test(showcase): lock resume and lean Docker context behavior

## Qualification conclusion

The five currently qualified Harmonia generator configurations have been proven
through the real application job/download path against a fresh backend from the
current feature branch.

Further generator implementation changes are not required for this qualification.
