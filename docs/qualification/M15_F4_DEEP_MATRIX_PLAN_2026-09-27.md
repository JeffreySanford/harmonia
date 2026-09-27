# M15-F4 — Deep Five-Model Qualification Plan

Date:

2026-09-27

## Objective

Complete one contrasting deep-generation case for each of Harmonia's
five currently installed, selectable and hardware-supported generator
models.

The existing smoke results are not rerun unless a regression makes a
specific rerun necessary.

## Existing smoke baseline

The following smoke models have already completed real generation:

1. `musicgen-small`
2. `musicgen-stereo-small`
3. `diffsinger-acoustic-hifigan`
4. `stable-audio-3-small-music`
5. `acestep-v15-turbo-06b`

## Deep cases

### 1. MusicGen Small

Case:

`musicgen-small-paper-constellations`

Purpose:

Exercise sparse acoustic/chamber-electronic conditioning distinct from
the existing rock-oriented smoke case.

Expected technical properties:

- real generated WAV
- approximately 12 seconds
- mono
- 32 kHz
- backend and frontend artifact bytes identical

### 2. MusicGen Stereo Small

Case:

`musicgen-stereo-small-neon-river`

Purpose:

Exercise rhythmic stereo placement and contrasting electro-funk
conditioning.

Expected technical properties:

- real generated WAV
- approximately 12 seconds
- stereo
- 32 kHz
- backend and frontend artifact bytes identical

### 3. DiffSinger

Case:

`diffsinger-starlight-score`

Purpose:

Exercise a second score-native Mandarin contour with longer held notes
while remaining inside the proven OpenCpop use case.

Expected technical properties:

- real generated WAV
- score metadata preserved
- requested notes preserved
- requested durations preserved
- backend and frontend artifact bytes identical

The manual male-opera experiment is not part of the deep matrix.

### 4. Stable Audio 3 Small Music

Case:

`stable-audio-foundry-snow`

Purpose:

Exercise contrasting dark industrial ambient/percussive conditioning.

Expected technical properties:

- real generated WAV
- approximately 15 seconds
- stereo
- 44.1 kHz
- IEEE float WAV
- backend and frontend artifact bytes identical

### 5. ACE-Step 1.5 Turbo + 0.6B LM

Case:

`ace-step-rumbo-al-norte`

Purpose:

Exercise supplied Spanish lyrics, language conditioning and a
contrasting Latin indie-folk-pop style.

Expected technical properties:

- real generated WAV
- approximately 30 seconds
- supplied lyrics preserved in job metadata
- backend and frontend artifact bytes identical

## Execution strategy

Run each deep case individually first.

This avoids losing evidence from successful models if a later provider
fails.

Order:

1. MusicGen Small
2. MusicGen Stereo Small
3. DiffSinger
4. Stable Audio
5. ACE-Step

After all five individual cases are green, run the formal deep matrix:

`corepack pnpm@12.6.0 qualify:model-matrix -- --profile deep`

## Completion target

The milestone target is:

- 5/5 smoke generations qualified
- 5/5 deep generations qualified
- 10/10 standard qualification generations total

The retained manual Chinese-opera experiment remains separate negative
human-review evidence and is not counted against this matrix.
