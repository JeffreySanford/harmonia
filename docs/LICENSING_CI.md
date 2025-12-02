**License CI & Manifest Policy**

This document explains how the repo's license validation behaves in CI and locally.

Summary
- The generator `scripts/generate_licenses_manifest.py` writes `legal/licenses_manifest.json` by scanning `inventory/combined_inventory.json` and attempting to fetch upstream license files when missing.
- The CI helper `scripts/check_licenses_ci.py` will, by default (soft mode), accept either:
  - a saved license file at `legal/licenses/<model>-LICENSE.txt`, or
  - a `license` object / `license_summary` field in the inventory manifest.

This is intentional to avoid blocking PRs when maintainers prefer to record license metadata in the manifest instead of storing license text files in the repo. Use the `--strict` flag to require saved license text files and fail the CI when missing.

How to run locally

Generate the license manifest (attempts to fetch missing license files):

```bash
python scripts/generate_licenses_manifest.py
```

Run the CI checker in soft mode (default — warnings only):

```bash
python scripts/check_licenses_ci.py
```

Run the CI checker in strict mode (fail on missing license files):

```bash
python scripts/check_licenses_ci.py --strict
```

CI configuration
- The GitHub Actions workflow ` .github/workflows/license_check.yml` runs the check in default (soft) mode so PRs will not be blocked simply because a license file isn't stored in the repo; maintainers can request `--strict` runs during release or legal sign-off.

Policy recommendations
- Prefer storing a copy of the license text in `legal/licenses/` if you expect downstream redistribution or to provide provenance for auditors.
- If using `license_summary` in the manifest, include at least `spdx_id` and `source_url` and, if possible, a short `commercial_use` boolean.
