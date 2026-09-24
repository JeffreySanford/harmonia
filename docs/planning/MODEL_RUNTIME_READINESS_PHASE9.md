# Phase 9 Runtime Readiness and Usage Metadata

**Status:** Core readiness gate locally qualified; live API usage proof pending  
**Date:** September 24, 2026  
**Runtime seam:** `MusicRuntimeService.selectModel()`

## Purpose

Make the qualified model-installation lifecycle protect real provider startup.

Before Harmonia releases a currently healthy provider or starts a new model
runtime, the selected logical model must pass the same deep filesystem
verification used by `models:verify`.

After a model reaches the runtime `ready` state successfully,
`model_installations.lastUsedAt` is updated for every physical artifact bound
to that logical model.

MongoDB remains operational metadata. Filesystem verification remains the
readiness authority.

## Selection ordering

For a newly selected target model:

1. reconcile existing runtime ownership;
2. validate catalog entry and hardware policy;
3. if the same model is already ready, preserve the runtime and update
   `lastUsedAt`;
4. deep-verify the target model's filesystem artifacts;
5. only after verification succeeds, stop a different currently active provider;
6. reconcile/build the target provider image;
7. start the provider container;
8. wait for healthy;
9. transition to `ready`;
10. update `lastUsedAt` for all physical artifacts bound to the logical model.

The readiness check therefore occurs before `stopCurrentRuntime()`.

## Readiness command

The backend invokes the committed model manager with the selected logical model:

```text
node scripts/model-manager.cjs verify
  --model <modelId>
  --root models
  --offline
  --json
```

This intentionally reuses the qualified deep-verification implementation rather
than creating a second filesystem interpretation inside NestJS.

## Failure behavior

If deep verification fails:

- provider image reconciliation does not run;
- Docker compose startup does not run;
- a currently healthy provider is not stopped;
- the selection request fails with a concise actionable message;
- Mongo installation metadata is not treated as proof of readiness.

The error may identify the selected logical model and affected artifact IDs, but
must not include credentials or low-level Mongo connection details.

## lastUsedAt

Usage metadata is updated only after a successful logical-model selection.

For composite models such as DiffSinger, all physical installation records
whose `modelIds[]` contains the selected logical model are updated together.

The update is advisory:

- successful provider selection is not rolled back if the metadata write fails;
- failures are logged as warnings;
- existing installation status/revision/verification fields are not modified.

## Mongo registration

`MusicRuntimeModule` registers the existing
`ModelInstallationSchema` through `MongooseModule.forFeature`.

A dedicated runtime metadata/readiness service owns:

- filesystem readiness verification;
- advisory `lastUsedAt` updates.

`MusicRuntimeService` remains the provider orchestration owner.

## Catalog behavior

Phase 9 does not rewrite static catalog availability yet.

A model may still appear catalog-selectable based on catalog/hardware policy,
but provider startup is blocked if filesystem readiness is absent.

Surfacing installation readiness directly in catalog responses is a later UI
integration step.

## Qualification target

1. readiness helper accepts a deeply verified selected model;
2. readiness helper rejects missing/corrupt model artifacts;
3. readiness verification uses canonical `models/` and offline mode;
4. readiness failure occurs before current-provider stop;
5. readiness failure occurs before image build/compose startup;
6. successful transition to `ready` updates `lastUsedAt`;
7. same already-ready model re-selection updates `lastUsedAt` without provider restart;
8. DiffSinger logical-model usage updates all three physical installation rows;
9. `lastUsedAt` write failure is advisory;
10. backend production build remains green;
11. existing provider/runtime regression contracts remain green;
12. live missing optional Medium model is rejected before provider startup;
13. live installed model readiness succeeds without modifying model bytes;
14. full startup/model regression remains green.

## Core readiness qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- backend unit suite: 47 passing tests across 12 suites;
- backend production build completed successfully;
- runtime source-order contract proved filesystem readiness before provider stop/image work;
- MusicGen Small deep readiness verified from the operational model root;
- DiffSinger composite readiness verified all three physical artifacts;
- missing optional MusicGen Medium was rejected by deep verification;
- live Mongo installation bindings contained all three DiffSinger physical artifacts;
- full startup/model regression finished with 128 passing tests, zero failures, and one intentionally skipped Compose lifecycle test;
- model bytes remained unchanged.

The remaining Phase 9 evidence is a controlled live API selection proving
`lastUsedAt` advances and same-ready re-selection does not restart the provider.

## Completion boundary

Phase 9 is complete when provider selection cannot start an unverified model,
cannot destroy a healthy runtime before target readiness is known, and
successful model selection records operational use in MongoDB.
