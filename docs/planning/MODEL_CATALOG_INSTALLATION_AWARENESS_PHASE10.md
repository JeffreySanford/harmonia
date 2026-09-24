# Phase 10 Catalog Installation Awareness

**Status:** Complete and locally qualified  
**Date:** September 24, 2026  
**Backend seam:** `MusicRuntimeService.getCatalog()`  
**Frontend seam:** existing model selector / `disabledReason`

## Purpose

Expose operational model-installation state directly in the music runtime
catalog so users can distinguish:

- supported by the application;
- compatible with current hardware;
- actually verified on local storage.

Phase 10 improves discovery and operator guidance. It does **not** replace the
Phase 9 filesystem readiness gate before provider startup.

## Authority model

Filesystem verification remains authoritative for runtime selection.

MongoDB `model_installations` is used only as the catalog's operational view.

If MongoDB is unavailable or no installation record exists:

- catalog installation state is `unknown`;
- the backend does not claim the model is installed;
- provider selection still performs the Phase 9 filesystem verification.

## Catalog fields

Each `MusicModelCatalogEntry` gains:

```text
installationState
installationArtifactCount
installationVerifiedCount
installationLastVerifiedAt
```

Initial state values:

```text
verified
missing
degraded
corrupt
unavailable
failed
unknown
not-managed
```

`not-managed` applies to planned/API-only/unreleased catalog models that are
not represented by the local installation registry.

## State derivation

For a logical model with Mongo rows:

1. all physical artifact rows verified -> `verified`;
2. any corrupt -> `corrupt`;
3. any failed -> `failed`;
4. any unavailable -> `unavailable`;
5. any degraded -> `degraded`;
6. any missing -> `missing`;
7. otherwise -> `unknown`.

Composite models such as DiffSinger derive one logical state from all physical
artifact rows.

## Selectability

Existing catalog/hardware rules remain in force.

For local catalog entries with `availability: installed`:

- `verified`: normal existing selectability;
- `missing`, `degraded`, `corrupt`, `unavailable`, `failed`: not
  selectable from the UI;
- `unknown`: keep existing static/hardware selectability because Mongo is
  advisory and the Phase 9 filesystem gate remains authoritative.

Actionable disabled reasons:

```text
Model is not initialized locally. Run: pnpm models:init --model <modelId>
Model installation needs repair. Run: pnpm models:repair --model <modelId>
Model installation is unavailable. Run: pnpm models:verify --model <modelId>
```

Hardware incompatibility still takes precedence where it already makes the
model unselectable.

## Backend implementation

Extend `ModelInstallationRuntimeService` with a read-only catalog projection
method that:

- accepts catalog model IDs;
- queries `model_installations` in one Mongo operation;
- groups physical rows by logical `modelIds[]`;
- returns `unknown` on advisory DB failure;
- never modifies installation records.

`MusicRuntimeService.getCatalog()` merges that projection into each catalog
entry.

## Frontend implementation

Extend the Angular `MusicModelCatalogEntry` interface with the new fields.

Existing model-option disabling already uses:

```text
selectable
disabledReason
```

The option label gains a concise installation suffix:

```text
Installed
Missing
Repair required
State unknown
```

No new model-selection action or state machine is required.

## Qualification target

1. verified single-artifact model appears installed/selectable subject to
   hardware;
2. three-artifact DiffSinger binding derives one verified logical state;
3. missing MusicGen Medium appears missing and unselectable when hardware would
   otherwise permit it;
4. corrupt/degraded/failed states produce repair guidance;
5. Mongo read failure returns `unknown` without failing catalog load;
6. planned/API-only/unreleased models report `not-managed`;
7. Phase 9 select-time filesystem verification remains unchanged;
8. frontend types accept the new catalog fields;
9. existing model option disabling and disabled-reason UI consumes installation-aware catalog state;
10. backend/frontend builds remain green;
11. startup/model regression remains green.

## Local qualification result

Qualified locally on September 24, 2026.

Observed behavior:

- backend installation-aware catalog suite: 52 passing tests;
- frontend suite: 52 passing tests;
- backend and frontend production builds completed successfully;
- live catalog reported MusicGen Small/Stereo Small and Stable Audio as
  single-artifact `verified` installations;
- live DiffSinger catalog state derived `verified` from all three physical artifacts;
- MusicGen Medium and Stereo Medium reported `missing` and unselectable;
- planned/API-only Stable Audio entries reported `not-managed`;
- the corrected secret-value scan passed while allowing the documented
  `HUGGINGFACE_HUB_TOKEN` variable name;
- catalog reads did not restart, replace, or otherwise mutate the running
  Stable Audio provider;
- the Phase 9 filesystem readiness gate remained in place before provider switching;
- full startup/model regression finished with 129 passing tests, zero failures,
  and one intentionally skipped Compose lifecycle test.

The optional model-option label suffix (`Installed`, `Missing`, etc.) is deferred
as presentation-only follow-up. Functional UI behavior is already installation-aware
through the existing `selectable` and `disabledReason` contract.

## Completion boundary

Phase 10 is complete when the catalog accurately presents installation state
without making MongoDB the runtime authority.
