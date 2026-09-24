# Harmonia Planning Documents

This directory contains implementation plans for work that has an approved
architectural direction but is not yet fully delivered.

Planning documents are intentionally separate from stable architecture and
operational documentation:

- stable/current design belongs in `docs/`;
- implementation sequencing and acceptance criteria belong in
  `docs/planning/`;
- obsolete historical material belongs in `docs/archive/`.

## Active plans

- [Model Storage and Rehydration](MODEL_STORAGE_REHYDRATION_PLAN.md) — unified
  model registry, local cache initialization, verification, repair, MongoDB
  installation metadata, and disaster-recovery qualification.
- [Model Registry Data Model](MODEL_REGISTRY_DATA_MODEL.md) — desired-state
  schema, composite model bindings, revision policy, verification strategies,
  and catalog consistency rules.
- [Failure and Recovery Semantics](MODEL_REHYDRATION_FAILURE_RECOVERY.md) —
  interruption safety, staging, disk/auth/network failure policy, repair
  behavior, locking, and exit-code contracts.
- [Acceptance Matrix](MODEL_REHYDRATION_ACCEPTANCE_MATRIX.md) — phase-by-phase
  qualification scenarios and the release gate for future local providers.
- [Model Manager CLI Specification](MODEL_MANAGER_CLI_SPEC.md) — exact command,
  selector, dry-run/offline, reporting, locking, authentication, and exit-code
  contract.
- [Phase 2 Model Plan Semantics](MODEL_PLAN_PHASE2.md) — marker-level cache
  inspection, state/action definitions, optional-model policy, and local
  qualification criteria for `pnpm models:plan`.
- [Model Installation MongoDB Schema](MODEL_INSTALLATION_MONGO_SCHEMA.md) —
  artifact-granular operational state, readiness derivation, indexes, error
  sanitization, and migration strategy.

When an implementation plan is completed, its durable design decisions should
remain represented by the corresponding architecture/operations documents.
