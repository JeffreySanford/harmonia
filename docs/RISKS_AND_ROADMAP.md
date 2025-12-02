# Risks, Phases, and Roadmap (Consolidated)

This document consolidates the project's risk analysis, suggested phased delivery plan, technical cautions, architectural concerns, and the Machine-Context-Protocol (MCP) starter rules you requested.

## 1) High-level risk and scope

- Risk: The scope (multi-modal generation libraries + enterprise Angular + NestJS + draconian standards + CI + artifact hosting) is large and crosses multiple disciplines (ML ops, infra, frontend, backend, legal).
  - Impact: Requires staged delivery, dedicated engineers, time for audits, and budget for GPU/cloud storage and CI minutes.

## 2) Suggested phased delivery (recommended)

- Phase 0 — Reproducible local images + manifests + smoke CI
  - Deliverables: Docker dev images, manifest schema, `smoke.yml` scheduled checks that validate manifests/checksums without re-downloading large assets.

- Phase 1 — Library CLIs + basic generation pipeline
  - Deliverables: Worker CLI scripts for music/vocal/sampling/video generation; local preview flow with smaller/quantized models.

- Phase 2 — Angular + NestJS integration
  - Deliverables: Enterprise Angular frontend (Material 3 + NGRX) + NestJS backend scaffold, APIs, job orchestration, and frontend-to-backend flows.

- Phase 3 — E2E, governance, legal sign-off
  - Deliverables: License audits, production infra for artifact hosting, E2E tests, legal sign-offs and retention policies.

## 3) Technical cautions (must-read)

- Model hosting & reproducibility
  - Avoid baking large model files into images. Use manifests + object storage. CI should not re-download tens of GB on each run; prefer artifact storage (S3/GCS/GitHub Releases) or caches.

- License risk
  - Many models/datasets impose license clauses limiting commercial use or redistribution. Audit each asset before bundling or redistributing.

- CI costs & flakiness
  - Scheduled runs that touch large files are expensive and brittle. Prefer checksum-only runs and metadata comparisons in CI; perform heavy validations on dedicated infra.

- Security
  - Keep `HUGGINGFACE_HUB_TOKEN` and other secrets out of the repo. Use `.env` for local dev (gitignored) and GitHub Secrets or a vault for CI.
  - Audit scripts to avoid accidental printing of secrets.

## 4) Architectural concerns and trade-offs

- "No async Promise unless absolutely necessary"
  - Warning: Avoiding async/promises across Node/Angular will reduce scalability and lead to non-idiomatic code in NestJS (which is async-first). You can adopt a conservative policy (limit async usage to IO-heavy services), but be aware of the trade-offs.

- Angular
  - Enterprise-style Angular (no standalone components) is achievable but increases boilerplate and onboarding friction.

- Testing
  - Use deterministic tests with small mocked models or fixtures to avoid heavy compute in CI. Reserve heavy model runs for offline infra.

## 5) MCP / AI operator instructions (concise rules)

- Read-only by default: AI agents must not modify files unless explicitly authorized and tied to a TODO task.

- Secrets: Never print or write tokens in plaintext. Use `.env` (gitignored) and GitHub Secrets for CI.

- Model updates: To bump a model:
  1. Add an entry to `inventory/combined_inventory.json` with source URL and checksum.
  2. Run the smoke-check and attach the resulting report.
  3. Open a PR that includes the manifest changes, recorded checksums, and a license verification summary.

- Smoke-check responses: If a smoke report indicates mismatches, create an issue referencing `models/*` paths and attach the report.

- Testing: Use small sample inputs and mocked models for unit/CI tests. Heavy validation is scheduled to special infra.

- Communication: Provide clear one-line PR summaries and links to manifests, checksums, and smoke reports.

## 6) Next actionable recommendations (short)

1. Finalize manifest schema and file layout (`inventory/combined_inventory.json`, per-model `inventory.json`, and `models/checksums.sha256`).
2. Harden `.github/workflows/smoke.yml` to run on schedule and to fail only on recorded-checksum mismatches; upload the smoke reports as artifacts.
3. Create lightweight `Dockerfile.worker` and `docker-compose.dev.yml` that mount `models/` and `artifacts/` from the host and expose a testing endpoint.
4. Start Phase 1 with a single library CLI (music) and a small quantized model variant used for CI tests.

---

If any of the above items require more detail, or you'd like me to implement Phase 0 artifacts now (Dockerfile + compose + smoke.yml schedule changes + manifest schema), tell me which specific step to start and I will begin implementing it and update the todo list.
