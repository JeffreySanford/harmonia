# CI Smoke Design (Harmonia)

Objective
Design CI smoke checks that detect when model or dataset manifests diverge from expected state, without re-downloading large models on every run. The goal is early detection of missing artifacts, checksum mismatches, or required model bumps.

Key concepts

- Manifest: a compact JSON file that lists model/dataset entries, sizes, checksums, source URLs, and semantic versions.
- Recorded checksums: canonical SHA256 values for a small set of representative files (top shards) kept in `models/checksums.sha256`.
- Lightweight smoke: CI should only validate manifests, recorded checksums, and, when present, compute checksums if the relevant files exist in the workspace.

Workflow

1. Scheduled runs: weekly scheduled job triggers smoke workflow.
2. Checkout repo and limited artifacts: CI checks out the repository but does NOT attempt to download large models.
3. Compare manifests: CI validates `inventory/combined_inventory.json` against `models/inventory.json` and `datasets/inventory.json` for consistency.
4. Check recorded checksums: If `models/checksums.sha256` is present, and the corresponding files exist in the workspace (e.g., due to caching or artifact restore), compute SHA256 and fail CI if any recorded checksum mismatches are found.
5. Missing files policy: If recorded checksums exist but files are missing, fail CI (indicates a missing artifact). If no recorded checksums exist, do not fail—only upload a report.
6. Artifacts: Always upload smoke report JSONs as CI artifacts for human inspection.

Implementation notes

- Use GitHub Actions `schedule` trigger for periodic checks.
- Use artifact or cache restoration selectively to preserve network/cost limits (e.g., restore only `models/checksums.sha256` and `models/inventory.json`).
- Keep smoke script read-only; it should never modify repository files.

Failing conditions

- Fail on: checksum mismatch for recorded checksums; missing files when recorded checksums exist.
- Do not fail on: missing files when recorded checksums are not present (developer local setups).

Alerting and remediation

- On failure, CI should:
  - Upload the smoke report.
  - Create an issue or notify maintainers with the smoke summary and direct links to the report.

Next steps

- Add GitHub Actions workflow with `schedule` and `push` triggers (already partially added in `.github/workflows/smoke.yml`).
- Optionally integrate an artifact store to restore the `models/` top-level entries needed for checksum checks.

---
End of CI smoke design.
