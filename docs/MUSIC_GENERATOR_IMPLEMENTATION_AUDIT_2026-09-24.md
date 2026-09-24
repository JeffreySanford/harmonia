# Harmonia Music Generator Audit — September 24, 2026

## Purpose

Record which catalog music generators are actually runnable in Harmonia today,
which are only catalog declarations, and which provider should be implemented
next on the reference RTX 3080 10 GB workstation.

## Qualified local providers

### MusicGen

Qualified:

- `musicgen-small`
- `musicgen-stereo-small`

Status:

- isolated provider runtime;
- registry-managed local weights;
- persistent job integration;
- backend/frontend download path qualified;
- runtime readiness and usage metadata qualified.

Deferred on this workstation:

- `musicgen-medium`
- `musicgen-stereo-medium`

Reason:

- catalog minimum/recommended VRAM is 16 GB;
- artifacts intentionally remain optional/missing.

### DiffSinger

Qualified:

- `diffsinger-acoustic-hifigan`

Physical dependencies:

- OpenCpop acoustic;
- Xiaoma pitch estimator;
- HiFi-GAN vocoder.

Status:

- three-artifact registry binding;
- real CUDA inference qualified;
- persistent job integration qualified.

### Stable Audio 3

Qualified:

- `stable-audio-3-small-music`

Status:

- gated model initialization qualified;
- native 44.1 kHz stereo float WAV;
- persistent provider/job path qualified;
- live runtime recovery and same-ready re-selection qualified.

## Qualified local providers

### ACE-Step 1.5

Qualified:

- `acestep-v15-turbo-06b`

Status:

- pinned isolated provider runtime;
- selective registry-managed Turbo + VAE + Qwen + 0.6B LM payload;
- exact revision markers and deep verification qualified;
- no 1.7B LM downloaded for the 10 GB workstation profile;
- operational catalog state verified/selectable;
- fresh runtime load and resident-model recovery qualified;
- durable supplied-lyrics generation qualified;
- 30-second stereo 48 kHz / 16-bit WAV generated successfully;
- backend and frontend download paths qualified;
- no runtime model downloads during generation.

Still planned:

- `acestep-v15-sft-06b`
- larger 1.7B/XL variants

Reference-workstation policy:

- Turbo + 0.6B LM is the qualified default ACE-Step target;
- SFT + 0.6B LM is the next ACE-Step comparison target;
- XL models remain outside the default RTX 3080 10 GB profile.

## Planned local providers

### DiffRhythm

Catalog entries:

- `diffrhythm-v12-base`
- `diffrhythm-v12-full`

Status:

- no Harmonia provider runtime yet;
- strong future candidate for full-length lyrics/vocals;
- base model is a realistic 10 GB-class target;
- keep behind ACE-Step until one controlled full-song provider is integrated.

### HeartMuLa

Catalog entries:

- `heartmula-3b-lazy`
- `heartmula-3b-resident`
- unreleased 7B entry

Status:

- no Harmonia provider runtime yet;
- 3B + lazy loading is the realistic 10 GB-class target;
- important future multilingual full-song provider.

### SongGeneration / LeVo

Catalog entries include Base New, Base Full, Large and v2 variants.

Status:

- no Harmonia runtime integration;
- Base New is the only current catalog tier near the 10 GB workstation target;
- larger variants exceed the preferred hardware envelope.

### Muse

Catalog entry:

- `muse-long-form`

Status:

- no Harmonia runtime integration;
- upstream model/code are open;
- local VRAM/runtime qualification remains unknown in Harmonia.

### YuE2

Catalog entry includes 3B and legacy variants.

Status:

- no Harmonia runtime integration;
- current catalog target requires 24 GB VRAM;
- not a practical next provider on the RTX 3080 10 GB workstation.

## Hosted/API-only entries

Stable Audio 3 Large remains comparison/API-only.

Hosted paid providers should remain outside the default free/local path.

## Implementation order

1. ACE-Step 1.5 SFT + 0.6B LM
2. DiffRhythm v1.2 Base
3. HeartMuLa 3B lazy-load
4. SongGeneration Base New
5. Muse after hardware qualification
6. higher-memory variants only on appropriate hardware

## Completion definition for a new Harmonia generator

A catalog declaration is not considered working until it has:

1. pinned runtime/source revision;
2. deterministic persistent model initialization;
3. deep local verification;
4. isolated provider runtime;
5. health + resident-model recovery;
6. backend runtime selection;
7. durable generation job;
8. real audio artifact validation;
9. frontend-visible selectable state;
10. local qualification evidence.
