# M15-G — Male Mandarin DiffSinger / OpenUTAU

## Goal

Add a second Harmonia DiffSinger path capable of:

- intelligible Mandarin singing
- genuine male vocal identity
- useful lower male register
- stable sustained notes
- expressive pitch and variance control
- Chinese-opera-style experimentation

The existing OpenCpop runtime remains unchanged.

## Existing baseline

Installed model:

`diffsinger-acoustic-hifigan`

Provider:

`diffsinger`

Runtime model:

`0228_opencpop_ds100_rel`

Technical smoke qualification:

PASS

Male Chinese-opera human qualification:

FAIL

Observed problems:

- female vocal identity
- gibberish/unintelligible lyrics
- excessive breathing
- unsuitable timbre for the requested concept

## New provider

Catalog provider:

`diffsinger-openutau`

G1 state:

`runtimeInstalled = false`

This guarantees the provider is visible architecturally but cannot be
selected yet.

## New model slot

Catalog model:

`diffsinger-openutau-mandarin-male-local`

Runtime identity:

`mandarin-male-local`

G1 state:

`availability = planned`

The model deliberately remains generic until a specific voicebank has
been obtained, inspected and approved.

## Isolation

The OpenUTAU provider must not replace or modify:

`diffsinger`

It receives its own:

- Dockerfile
- image
- container
- Compose service
- Compose profile
- model directory
- validation tooling
- inference adapter
- qualification cases

## Local model storage

Planned layout:

    models/
      diffsinger-openutau/
        voicebanks/
          <voicebank-id>/
            <voicebank assets>

Voicebank files remain local.

## Licensing boundary

Inference-engine licensing and voicebank licensing are independent.

Before a named voicebank is integrated:

1. obtain the actual package
2. inspect its included license/terms
3. determine redistribution permission
4. determine commercial-use permission
5. verify attribution requirements
6. verify model compatibility

Until then Harmonia must not:

- commit voicebank weights
- put weights in the Docker image
- publish a voicebank download URL
- claim redistribution rights
- mark commercial use as allowed

## G2

Build the isolated OpenUTAU provider runtime.

Add a local voicebank validator.

No synthesis requirement yet.

## G3

Install a candidate male Mandarin voicebank locally.

Validate:

- package structure
- model/config files
- Mandarin phonemizer compatibility
- available speaker identity
- useful singing range
- license/usage terms

## G4

Wire durable Harmonia jobs to the new provider.

First live qualification:

short neutral Mandarin singing phrase.

Acceptance:

- clearly male
- recognizable Mandarin
- no dominant breath/noise artifacts
- stable notes

## G5

A/B qualification:

`暮鼓关山 / Dusk Drums at the Pass`

Compare against the retained failed OpenCpop sample.

Human acceptance:

- clearly male vocal identity
- intelligible Mandarin
- stable sustained notes
- controlled breathing/noise
- useful dramatic character

The goal is a suitable synthetic vocal character, not imitation of any
real singer.
