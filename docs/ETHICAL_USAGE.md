# Ethical Usage & Acceptable-Use Guidelines

Purpose
This document defines the ethical usage policy and guardrails for Harmonia. The goal is to allow creative, legal uses while reducing legal, privacy, and reputational risk.

Principles

- Legality first: Do not facilitate illegal activity (e.g., unauthorised copyrighted reproduction, defamation, illegal content).
- Respect privacy: avoid generating or distributing personally identifying recordings or attempting to mimic private individuals without consent.
- Safety: Prevent outputs that are abusive, hateful, sexual exploitation, or violent.
- Transparency: Label generated media as synthetic where appropriate and maintain provenance metadata (model, seed, prompt, timestamp).

Policy summary (what to disallow)

- Explicitly disallowed:
  - Generating audio that convincingly impersonates a living person (voice cloning) without explicit documented consent.
  - Generating copyrighted songs or audio that reproduces copyrighted content verbatim.
  - Generating sexual content involving minors or exploitative material.
  - Hate speech, targeted harassment, or content that incites violence.

Allowed with guardrails

- Transformative, original music and sound generation is allowed. Require attribution and provenance logging.
- Voice generation for consenting actors, with consent records stored and access restricted.

Provenance & metadata

- Record per-artifact metadata: model-id, model-version, prompt, seed, timestamp, user-id, and policy-approval id (if required).
- Persist metadata in `artifacts/metadata.json` alongside generated files.

User consent & moderation

- For voice cloning or synthetic vocals, require explicit consent and a short recorded release form (store hashed consent evidence).
- Provide an abuse-reporting channel and a fast process to remove offending content.

Rate limits and quotas

- Enforce per-user quotas to prevent abuse and to limit costs (e.g., max X renders per user per day).

Human review

- For uses with higher risk (e.g., impersonation, public release), require human review and sign-off before publishing.

Legal & compliance integration

- Hook license audits and model license info into approval workflows. Do not allow models with incompatible licenses to be used in commercial workflows without legal sign-off.

Enforcement and incident response

- Maintain logs, notify maintainers on policy violations, and remove content when reported and validated.

Example developer checklist before enabling a new model for production

- [ ] License audit completed and stored in `legal/licenses/`
- [ ] Ethical use review completed
- [ ] Moderation & reporting path in place
- [ ] Quotas and rate-limits set

---
End of Ethical Usage guide.

## Critical notes & recommendations (direct)

- **Voice cloning & impersonation:** For voice cloning or realistic impersonation, require explicit signed consent from the person being cloned, keep consent records, and require human review prior to public release.
- **Provenance & labeling:** Always label synthetic media clearly and persist provenance metadata (model-id, seed, prompt, timestamp, user-id) alongside artifacts. Store provenance in `artifacts/metadata.json` or an auditable store.
- **Legal & human review for risky uses:** Any high-risk uses (impersonation, public release) must pass legal and human-review sign-off before publication.
