# Legal & License Audit (Models and Datasets)

Purpose
This document provides a step-by-step checklist and templates to audit licenses and legal constraints for models, datasets, and derived artifacts used by Harmonia. Before packaging or distributing any model/dataset or building a product that uses them, complete this audit and attach results to the PR.

High-level principles

- Do not assume permissive rights. Each repository or dataset must be checked for an explicit license file and terms of service.
- Pay special attention to: commercial use restrictions, redistribution (rehosting), derivative work definitions, attribution, and export controls.
- If a license is ambiguous, treat as restricted until legal advice or explicit permission is obtained.

Checklist (per model / dataset)

1. Identification
   - Source URL (e.g., Hugging Face repo or dataset page)
   - Model/dataset name and version/commit
   - Where the snapshot was downloaded from (link + date)

2. License file
   - Locate a `LICENSE` or `LICENSE.txt` file in the source repo. Copy the full text into the PR artifacts.
   - If no license present, mark as `NO LICENSE - DO NOT REDISTRIBUTE`.

3. License terms to extract
   - Commercial use: allowed / restricted / prohibited
   - Redistribution: allowed / restricted / prohibited
   - Derivative works: allowed / restricted / prohibited
   - Attribution requirements: required text and placement
   - Data subjects & PII: any dataset contains personal data or private recordings
   - Export control / sanction restrictions

4. Upstream dependencies
   - Some model repositories include third-party checkpoints or weights. Verify licenses of those upstream dependencies.

5. Model card / README review
   - Read the model card for usage notes. Note any content restrictions (e.g., disallows generating certain content, ethical disclaimers).

6. Rights for production use
   - If commercial use is intended, ensure the license explicitly permits commercial use.
   - If redistribution is required (e.g., model packaged in image), confirm redistribution permissions.

7. Record keeping
   - Copy license text into `legal/licenses/<model-name>-LICENSE.txt` in the repo (or attach to PR).
   - Add a short `legal/licenses_manifest.json` entry mapping model -> license summary.

8. If restrictions exist
   - If license forbids commercial use, either do not use the model for commercial products or obtain explicit written permission from the copyright holder.
   - If redistribution is limited, do not include the model in any public image or release. Instead reference the source and provide a downloader script.

9. GDPR / Data Privacy
   - If datasets include human voice or personal data, obtain guidance on consent and retention policies.

10. Export controls and sanctions

- Verify that the model creators or hosting locations are not restricted by sanctions that would prevent distribution or use in target markets.

Sample PR checklist (add to PR description)

- [ ] Source URL(s):
- [ ] License file(s) attached in `legal/licenses/`
- [ ] Commercial use: allowed / restricted / denied
- [ ] Redistribution: allowed / restricted / denied
- [ ] Attribution: required text
- [ ] Dataset PII concerns: yes / no (detail)
- [ ] Approval: legal reviewer sign-off (if required)

Automated aids

- Add `scripts/license_audit_stub.py` to pull `model` entries from `inventory/combined_inventory.json` and create a checklist file for manual completion. This is NOT a substitute for legal review.

When to escalate to legal

- Any ambiguity in license text.
- Any model/dataset with commercial-use restrictions where commercial deployment is planned.
- Any dataset with human voice, identifiable individuals, or PII.

Retention & archival

- Keep original source URLs, license snapshots, and the smoke report for the model update in a PR artifact archive.

---
End of Legal & License Audit guidance.

## Critical notes & recommendations (direct)

- **Licensing caution:** Many Hugging Face–hosted models and other community checkpoints restrict redistribution or commercial use. Do not bundle such models into public images or releases. Always store the license text (snapshot) in `legal/licenses/` and require legal sign-off before using a model in any commercial product.
- **Distribution practice:** If redistribution is restricted, provide a downloader script (that references the original source URL) rather than including the model binary in any image or release.
