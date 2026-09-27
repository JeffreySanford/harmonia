# Phase 16 — DiffRhythm Local Provider

**Status:** Complete — DiffRhythm v1.2 Base is installed, hardware-qualified, backend-qualified, and included in the six-generator showcase
**Date:** September 27, 2026
**Primary target:** `diffrhythm-v12-base`
**Reference GPU:** NVIDIA GeForce RTX 3080, 10 GB VRAM

## Goal

Make DiffRhythm the next real Harmonia local music provider after the
five-model M15 qualification milestone.

The first implementation target is deliberately limited to DiffRhythm v1.2 Base.

The newer DiffRhythm 2 release remains a future candidate but is not the first
10 GB workstation target.

## Selected upstream

Repository:

`ASLP-lab/DiffRhythm`

Pinned source revision:

`28ad63c0f096fe2ee258bcabbcf081d5d9366afd`

Initial logical Harmonia model:

`diffrhythm-v12-base`

Initial upstream checkpoint:

`ASLP-lab/DiffRhythm-1_2`

Nominal output duration:

95 seconds

## Why v1.2 Base is selected before DiffRhythm 2

DiffRhythm v1.2 Base has an explicit low-memory path:

- documented minimum: 8 GB VRAM
- chunked VAE decoding supported through `--chunked`
- 95-second base-model generation
- direct non-Gradio Python inference
- native WAV output
- 44.1 kHz sample rate
- stereo VAE output
- int16 conversion before `torchaudio.save`

The reference RTX 3080 has 10 GB VRAM and therefore falls inside the documented
base-model range, subject to live measurement.

Community reports show that decode memory can still exceed 10 GB in some
configurations. M16 therefore treats the upstream 8 GB statement as a testable
claim rather than proof.

That hardware gate is complete for v1.2 Base. The model is now promoted to
`installed`; v1.2 Full remains deliberately `planned`.

## DiffRhythm 2 evaluation

DiffRhythm 2 was evaluated before implementation.

Pinned source revision:

`7804f821b797b4f276090e1a9dcd37e97d9915d5`

Advantages:

- newer architecture
- improved lyric alignment
- coherent full-song generation
- direct Python inference script
- Apache-2.0 code and primary model weights
- 48 kHz decoder

Reasons for deferral on the 10 GB reference GPU:

- reference loader places the DiffRhythm model, MuQ-MuLan and decoder on the
  accelerator together
- no documented low-VRAM/chunked decoding mode equivalent to v1.2
- primary Hugging Face package is approximately 5 GB before MuQ dependencies
  and inference activations
- first-run reference implementation automatically downloads model files

DiffRhythm 2 should be reconsidered after the v1.2 provider contract is proven,
or when a measured sequential/offload strategy is available.

## Runtime dependency graph

DiffRhythm v1.2 Base inference is not a single-checkpoint runtime.

Harmonia must account for all transitive model dependencies before provider
startup.

### 1. DiffRhythm DiT

Repository:

`ASLP-lab/DiffRhythm-1_2`

Required runtime file:

`cfm_model.pt`

Role:

95-second lyric-conditioned diffusion model.

### 2. DiffRhythm VAE

Repository:

`ASLP-lab/DiffRhythm-vae`

Required runtime file:

`vae_model.pt`

Observed current size:

approximately 625 MB.

Role:

stereo 44.1 kHz latent audio decoding.

License:

Stability AI Community License-derived artifact.

### 3. MuQ-MuLan

Repository:

`OpenMuQ/MuQ-MuLan-large`

Role:

style text/audio embedding.

Observed current checkpoint size:

approximately 2.65 GB.

License:

CC-BY-NC 4.0 model weights.

### 4. MuQ audio tower

Repository:

`OpenMuQ/MuQ-large-msd-iter`

Role:

MuQ-MuLan audio encoder dependency.

Observed safetensors size:

approximately 1.33 GB.

License:

CC-BY-NC 4.0 model weights.

### 5. XLM-R text tower

Repository:

`FacebookAI/xlm-roberta-base`

Role:

MuQ-MuLan text encoder dependency.

Required runtime material includes model weights, config and tokenizer files.

Observed PyTorch/safetensors weight size:

approximately 1.1 GB.

License:

MIT.

## No-surprise-download policy

The provider must not depend on upstream first-run Hugging Face downloads.

Before provider startup:

1. the model manager must know every required physical artifact;
2. each artifact must have a pinned revision;
3. deep verification must prove required files are present and non-empty;
4. provider execution must use offline Hugging Face / Transformers behavior;
5. a generation run must not create model-download temporary files.

Expected runtime environment includes:

- `HF_HUB_OFFLINE=1`
- `TRANSFORMERS_OFFLINE=1`

The implementation may use a registry-managed Hugging Face cache layout or
explicit local paths, but network access during runtime selection and generation
is prohibited.

## 10 GB memory strategy

The initial provider must favor correctness and fit over resident throughput.

Proposed sequence:

1. load MuQ-MuLan;
2. generate the style embedding;
3. move or release MuQ-MuLan from GPU;
4. call `torch.cuda.empty_cache()`;
5. load/use DiffRhythm DiT;
6. decode with VAE using chunked decoding;
7. measure peak VRAM during both diffusion and VAE decode.

If keeping the DiT resident prevents safe MuQ embedding generation on 10 GB,
the provider may reload components sequentially.

The first implementation does not optimize for concurrent requests.

## Input contract

Initial Harmonia request:

- supplied lyrics
- text style prompt
- fixed base duration of 95 seconds
- batch size 1

The upstream base model expects timestamped LRC-style lyrics.

Harmonia should own conversion from the product lyric representation into the
provider-native LRC fixture rather than exposing raw filesystem paths through
the public job contract.

Editing, continuation and audio-reference style prompting are later slices.

## Output contract

Expected first qualified artifact:

- RIFF/WAVE
- 44.1 kHz
- stereo
- signed 16-bit PCM
- approximately 95 seconds
- nonzero audio payload

The Harmonia job/download boundary must validate the final artifact using the
same durable rules used by the existing qualified providers.

## Licensing

The provider must remain:

`commercialUse: 'review-required'`

Although DiffRhythm code and DiT weights are Apache-2.0, the complete runtime
also depends on:

- DiffRhythm VAE under the Stability AI Community License
- MuQ model weights under CC-BY-NC 4.0

Harmonia must not describe the complete provider stack as unrestricted
Apache-only commercial use.

## M16 implementation sequence

### M16-A — selection and dependency contract

- select v1.2 Base
- document DiffRhythm 2 deferral
- enumerate transitive model dependencies
- define no-surprise-download policy
- define 95-second output contract

### M16-B — provider shell

Add:

- isolated DiffRhythm image
- Compose service/profile
- health endpoint
- GPU overlay
- offline environment
- no host port exposure
- no model download on boot

Provider remains non-selectable.

### M16-C — registry-managed artifacts

Add all required physical artifacts to the model registry.

Qualify:

- selective plan
- dry run
- alternate-root initialization
- revision markers
- deep verification
- second offline cache-hit run
- zero mutation of unrelated models

### M16-D — RTX 3080 runtime qualification

Qualify:

- provider image
- CUDA
- filesystem readiness
- style embedding
- MuQ offload
- DiffRhythm load
- chunked VAE decode
- real measured VRAM
- no runtime downloads

Only after this gate may `diffrhythm-v12-base` become installed/selectable.

### M16-E — durable generation job

Generate one real 95-second lyric-conditioned song through:

Angular -> NestJS job -> runtime selector -> DiffRhythm -> artifact -> download

Validate:

- supplied lyrics survive the product boundary
- style prompt survives the product boundary
- durable job lifecycle
- WAV structure
- stereo
- 44.1 kHz
- 16-bit PCM
- approximately 95 seconds
- backend download HTTP 200
- frontend proxy download HTTP 200
- provider switching releases prior GPU ownership

## M16 completion evidence

Phase 16 completed on September 27, 2026.

Qualified local installation:

- logical model: `diffrhythm-v12-base`
- provider: `diffrhythm`
- source revision: `28ad63c0f096fe2ee258bcabbcf081d5d9366afd`
- five registry-managed physical artifacts
- canonical cache: 69 files / 15,146,219,378 logical bytes
- runtime operation is offline with `HF_HUB_OFFLINE=1` and
  `TRANSFORMERS_OFFLINE=1`

Measured RTX 3080 qualification:

- GPU: NVIDIA GeForce RTX 3080, 10 GB
- staged MuQ -> CFM -> VAE execution
- MuQ is released before diffusion
- CFM latent is moved to CPU before VAE decode
- VAE decode uses chunk size 128 under inference mode
- idle resident CUDA allocation after generation is approximately 8.5 MB

Durable product qualification:

- authenticated asynchronous runtime selection
- backend-owned provider startup and ownership recovery
- resident preparation count remains one
- real durable lyric-conditioned generation
- 95.108934-second RIFF/WAVE output
- stereo
- 44.1 kHz
- signed 16-bit PCM
- 16,777,294-byte qualified WAV
- prompt, timestamped lyrics and deterministic seed preserved
- backend artifact download byte-identical to the durable WAV
- frontend-proxied artifact download byte-identical to the durable WAV
- canonical model cache unchanged by runtime selection and generation

Qualified showcase:

- DiffRhythm v1.2 Base is the sixth Harmonia qualified generator
- committed preset: **Prairie Signal**
- live showcase generation completed through the normal authenticated
  runtime/job/download path
- smoke and deep qualification cases are registered for the model

### M16-E4 — qualified showcase integration

Completed:

- added the DiffRhythm Base showcase preset
- added DiffRhythm to the qualified-generator runner
- added native PCM16/stereo/44.1 kHz showcase validation
- added prompt, lyrics and deterministic-seed preservation checks
- advanced the full showcase contract from five generators to six

## Deferred work

Not part of the first M16 gate:

- DiffRhythm v1.2 Full / 285-second model
- DiffRhythm 2
- editing
- continuation
- audio-reference style prompting
- multi-song batch generation
- provider concurrency
- commercial-use approval

## Completion boundary — satisfied

Phase 16 is complete. `diffrhythm-v12-base` is:

- registry-managed
- deeply verified
- offline-bootable
- hardware-qualified on the RTX 3080 10 GB
- selectable through Harmonia
- capable of a real durable 95-second lyric-conditioned generation
- downloadable through both backend and frontend artifact paths
- covered by smoke/deep qualification evidence
