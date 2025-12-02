# MCP / AI Operator Instructions (Harmonia)

Purpose
These instructions define how AI agents or human operators should interact with the repository and automation. They are deliberately conservative: agents default to read-only, and any write action must be explicit and linked to a TODO item.

Principles
- Read-only by default: Agents should analyze, propose, and open TODOs. They only edit files when explicitly given a write authorization tied to a TODO.
- Traceability: Every action that modifies artifacts, manifests, or models must reference a ticket or PR with rationale and checksum verification.
- Least privilege: Tokens and credentials must never be printed or stored in logs.

Operator rules
1. Initialization
  - Read `docs/` and inventory manifests before making changes.
  - If downloads are required, ensure `HUGGINGFACE_HUB_TOKEN` is supplied via `.env` (local) or CI secrets (remote).

2. Model update procedure
  - Add new model snapshot to `models/` via `scripts/download_musicgen_full.sh --run` or manual placement.
  - Compute SHA256 and update `models/checksums.sha256` and `models/inventory.json`.
  - Open a PR that includes the updated manifests and the smoke report from `tests/env_tests/smoke_check.py`.
  - Include license verification in PR description.

3. CI interactions
  - CI smoke checks compare recorded checksums against `models/` present in workspace. If mismatches are detected, CI should fail and create an issue automatically where possible.

4. Emergency rollback
  - If a model update causes regressions, revert the manifest and re-run smoke checks. Keep old artifacts archived under `artifacts/` with a version tag.

5. Security & Secrets
  - No secrets in PRs. Mask tokens in logs. Use ephemeral tokens for debugging and revoke afterward.

6. Human-in-the-loop
  - For any automated checksum mismatch or license issue, alert a human maintainer with a clear remediation list.

7. Bookkeeping
  - Keep `inventory/combined_inventory.json` up to date. Use semantic versioning `models:v1.2.0` style tags in manifests.

Quick checklist for agents before performing writes
- Did you read `models/inventory.json` and `models/checksums.sha256`? If not, STOP.
- Did you create or update a TODO item in the repo? If not, STOP.
- Are you avoiding printing secrets? If not, STOP.

---
End of MCP operator instructions.
