# M15-F3 Human Listening Review — 2026-09-27

## Manual DiffSinger Chinese-opera experiment

Case:

`diffsinger-dusk-drums-opera`

Artifact:

`generated/evidence/model-matrix/latest-samples/diffsinger-dusk-drums-opera.wav`

## Technical result

PASS

- generation completed successfully
- requested duration: 30 seconds
- generated duration: 30 seconds
- mono
- 24 kHz
- 16-bit PCM
- runtime model:
  `0228_opencpop_ds100_rel`

## Human listening result

FAIL — voice/model mismatch

Observed by listener:

- lyrics sounded like gibberish
- prominent heavy breathing
- vocal identity was female
- requested target was an older male Chinese-opera-style singer

## Interpretation

The OpenCpop checkpoint remains technically qualified for Harmonia's
normal DiffSinger smoke workflow.

The manual human-review failure does not invalidate the existing
DiffSinger provider.

It demonstrates that the installed OpenCpop voice is not suitable for
the requested male Mandarin operatic use case.

Attempting to approximate a male singer by moving the existing female
voice into a substantially lower register did not produce an acceptable
result.

## Decision

- retain the WAV as negative qualification evidence
- retain the result JSON
- preserve the existing OpenCpop runtime
- stop tuning that checkpoint for the male-opera requirement
- treat the male-opera result as a non-blocking specialty experiment
- preserve the completed OpenUTAU G1/G2 scaffold for possible future expansion
- defer real male Mandarin voicebank integration until broader singer selection becomes a product requirement
- continue the original five-model smoke/deep qualification plan
