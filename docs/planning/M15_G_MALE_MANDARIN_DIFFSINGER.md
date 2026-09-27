# M15-G — Male Mandarin DiffSinger / OpenUTAU

## Status

DEFERRED — future voice-expansion work

M15-G is not required for completion of the current Harmonia
five-generator qualification milestone.

The existing OpenUTAU work remains preserved as a future extension
point.

## Why this work was started

A manual Chinese-opera-inspired DiffSinger experiment attempted to use
the installed OpenCpop checkpoint for a low male vocal concept.

Technical synthesis completed successfully, but human listening review
failed because:

- the vocal identity remained female
- Mandarin intelligibility was poor
- breath/noise artifacts were prominent
- lowering the score did not create a convincing male singer

This established a useful limitation of the installed checkpoint.

## Existing qualified DiffSinger baseline

Installed model:

`diffsinger-acoustic-hifigan`

Provider:

`diffsinger`

Runtime model:

`0228_opencpop_ds100_rel`

Status:

QUALIFIED

The normal DiffSinger smoke qualification remains valid.

The failed male-opera experiment does not invalidate the existing
runtime.

## Completed future-work foundation

### G1 — complete

Added the planned provider boundary:

`diffsinger-openutau`

Added the planned local model slot:

`diffsinger-openutau-mandarin-male-local`

The provider remains:

`runtimeInstalled = false`

The model remains:

`availability = planned`

### G2 — complete

Added:

- isolated OpenUTAU provider shell
- `diffsinger-utau 0.3.8` package pin
- separate Docker Compose service
- GPU overlay
- local voicebank structure validator
- positive synthetic validation case
- negative incomplete-bank validation case
- regression contracts

The provider remains deliberately non-runnable.

No real external voicebank has been downloaded.

No OpenUTAU audio has been generated.

## Deferred work

The following work is intentionally deferred:

### G3

Acquire and inspect a real male Mandarin DiffSinger/OpenUTAU
voicebank.

### G4

Install the heavyweight inference dependencies and wire Harmonia
durable jobs to the provider.

### G5

Perform live male Mandarin qualification and optional A/B comparison
against the retained failed OpenCpop opera experiment.

## Decision

Harmonia does not currently need a dedicated male opera singer to prove
its DiffSinger integration.

The current milestone will instead complete the originally planned
qualification matrix for the five installed and runnable generators.

M15-G may resume later if broader singer selection becomes a product
requirement.

## Current next step

Return to:

M15-F4 — deep five-model qualification

Deep cases:

1. `musicgen-small-paper-constellations`
2. `musicgen-stereo-small-neon-river`
3. `diffsinger-starlight-score`
4. `stable-audio-foundry-snow`
5. `ace-step-rumbo-al-norte`
