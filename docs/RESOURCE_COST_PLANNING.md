# Resource & Cost Planning (Estimate & Model)

## Purpose

This document explains how to estimate current and future costs for running Harmonia locally and in the cloud (DigitalOcean or other providers). It includes a simple, configurable cost-estimator script to model compute, storage, transfer, and backup costs.

## Key cost buckets

- Compute (VM/Droplet / GPU instances): hourly rate × hours used
- Storage: GB-month for model/artifact storage (hot vs cold)
- Bandwidth: egress costs for file downloads/uploads (per GB)
- Snapshot & backup storage: incremental snapshot costs
- CI / Build minutes: cost per minute for hosted CI systems
- Support / monitoring / backups: optional overhead

## Usage scenarios (examples)

- Local-only (developer machine): largely zero infra cost, but consider hardware amortization and occasional cloud usage for heavy renders.
- Small team cloud (10 users, occasional heavy renders): a few small GPUs or a pay-as-you-go instance for heavy renders plus shared object storage.
- Production (many users): autoscaling GPU workers, object storage (S3/GCS), CDN for egress, quota controls.

## Estimator (how to use)

- The repo includes `scripts/cost_estimator.py`. It accepts a YAML/JSON configuration with unit prices and usage assumptions and outputs monthly and annual cost estimates.
- Example config fields:
  - `compute_instances`: list of {name, hourly_cost, hours_per_month}
  - `storage_gb`: total GB of hot storage and cold storage
  - `egress_gb_per_month`: total expected egress (GB)
  - `ci_minutes`: expected CI minutes per month and cost per minute

## Sample decisions and recommended defaults (starter)

- Storage: Keep models in object storage and mount or stream into workers. Use cheaper cold storage for archival snapshots.
- Caching: Use artifact caches to avoid repeated downloads in CI.
- Bandwidth: Use signed URLs and CDN for large public downloads.

## Cost sensitivity & capacity planning

- Run the estimator with different scenarios: conservative, expected, and peak.
- Estimate user behavior: if 10 users each produce 10 renders/month at 60s each with large model runs, compute GPU-hours and plan capacity.

## Example outputs the estimator can give

- Monthly compute: $X
- Monthly storage: $Y
- Monthly bandwidth: $Z
- Total monthly: $X+Y+Z

## Next steps

- Edit the `scripts/cost_estimator.py` config (or pass params) with real provider prices (DigitalOcean, AWS S3, etc.).
- Use this estimator to choose instance types and storage tiers and to compute break-even/license costs for potential monetization.

---

End of Resource & Cost Planning guidance.

## Critical notes & recommendations (direct)

- **Cost inputs:** the estimator uses placeholder/default unit prices. Update with real DigitalOcean or provider prices before making procurement decisions.
- **Bandwidth & storage:** bandwidth and storage dominate costs for multi-GB artifacts — use cold storage for archival snapshots and an object storage bucket with lifecycle policies to reduce monthly costs.
- **CI costs:** hosted CI minutes and artifact storage can become expensive; add quotas, caching, and artifact retention policies to avoid repeated downloads and unexpected bills.
