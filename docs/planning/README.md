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
- [Phase 2 Model Plan Semantics](MODEL_PLAN_PHASE2.md) — completed marker-level
  cache inspection, state/action definitions, optional-model policy, and local
  qualification evidence for `pnpm models:plan`.
- [Phase 3 Model Verify Semantics](MODEL_VERIFY_PHASE3.md) — completed deep,
  read-only local verification for cache links, required files, sizes,
  revisions, and provider-specific evidence.
- [Phase 4 Hugging Face Initialization](MODEL_HF_INIT_PHASE4.md) — completed
  alternate-root recovery for MusicGen Small/Stereo Small and Stable Audio 3,
  including offline provider-load qualification.
- [Phase 5 DiffSinger Initialization](MODEL_DIFFSINGER_INIT_PHASE5.md) — completed
  staged, path-safe HTTP-ZIP recovery for the acoustic, pitch-estimator, and
  HiFi-GAN packages, including offline boot and real recovered-model inference.
- [Phase 6 Default Init Orchestration](MODEL_DEFAULT_INIT_PHASE6.md) — completed
  selector-free default-set initialization with gated prerequisite preflight.
- [Phase 7 Conservative Repair](MODEL_REPAIR_PHASE7.md) — completed
  quarantine-first repair for incomplete model installations.
- [Phase 8 Model Installation Metadata](MODEL_INSTALLATIONS_PHASE8.md) —
  completed validated Mongo schema for filesystem-backed model artifacts.
- [Phase 8B Installation Synchronization](MODEL_INSTALLATIONS_SYNC_PHASE8B.md) —
  completed filesystem-verification projection into idempotent Mongo operational records.
- [Phase 8C Automatic Lifecycle Synchronization](MODEL_INSTALLATIONS_AUTO_SYNC_PHASE8C.md) —
  completed post-init/post-repair operational metadata synchronization for the canonical model root.
- [Phase 9 Runtime Readiness](MODEL_RUNTIME_READINESS_PHASE9.md) —
  completed filesystem readiness enforcement before provider switching plus advisory `lastUsedAt` updates.
- [Phase 10 Catalog Installation Awareness](MODEL_CATALOG_INSTALLATION_AWARENESS_PHASE10.md) —
  completed advisory installation state in runtime catalog selectability and guidance.
- [Model Installation MongoDB Schema](MODEL_INSTALLATION_MONGO_SCHEMA.md) —
  artifact-granular operational state, readiness derivation, indexes, error
  sanitization, and migration strategy.

When an implementation plan is completed, its durable design decisions should
remain represented by the corresponding architecture/operations documents.
