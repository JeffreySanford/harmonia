#!/usr/bin/env python3
"""Simple cost estimator for compute, storage, bandwidth, and CI.

Usage:
  python scripts/cost_estimator.py --config config.json

Or run interactively to output example scenarios.
"""
import json
import argparse
from pathlib import Path
from typing import Any, Dict


DEFAULT_CONFIG = {
    "compute_instances": [
        {"name": "gpu-small", "hourly_cost": 0.50, "hours_per_month": 100},
        {"name": "cpu-worker", "hourly_cost": 0.05, "hours_per_month": 200}
    ],
    "storage_gb_hot": 5000,
    "storage_cost_per_gb_month": 0.02,
    "storage_gb_cold": 20000,
    "storage_cold_cost_per_gb_month": 0.004,
    "egress_gb_per_month": 500,
    "egress_cost_per_gb": 0.09,
    "ci_minutes": 2000,
    "ci_cost_per_minute": 0.02,
    "support_pct": 0.10
}

PROVIDER_PRESETS = {
    "default": DEFAULT_CONFIG,
    "digitalocean": {
        "compute_instances": [
            {"name": "cpu-worker", "hourly_cost": 0.05, "hours_per_month": 200},
            {"name": "gpu-1", "hourly_cost": 0.90, "hours_per_month": 50}
        ],
        "storage_gb_hot": 5000,
        "storage_cost_per_gb_month": 0.02,
        "storage_gb_cold": 20000,
        "storage_cold_cost_per_gb_month": 0.004,
        "egress_gb_per_month": 500,
        "egress_cost_per_gb": 0.09,
        "ci_minutes": 2000,
        "ci_cost_per_minute": 0.02,
        "support_pct": 0.10
    },
    "aws": {
        "compute_instances": [
            {"name": "cpu-worker", "hourly_cost": 0.06, "hours_per_month": 200},
            {"name": "p3-small", "hourly_cost": 3.06, "hours_per_month": 20}
        ],
        "storage_gb_hot": 5000,
        "storage_cost_per_gb_month": 0.023,
        "storage_gb_cold": 20000,
        "storage_cold_cost_per_gb_month": 0.004,
        "egress_gb_per_month": 500,
        "egress_cost_per_gb": 0.09,
        "ci_minutes": 2000,
        "ci_cost_per_minute": 0.02,
        "support_pct": 0.12
    }
}


def load_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return DEFAULT_CONFIG
    return json.loads(path.read_text(encoding="utf-8"))


def estimate(config: Dict[str, Any]) -> Dict[str, float]:
    compute = sum(i["hourly_cost"] * i["hours_per_month"] for i in config.get("compute_instances", []))
    storage_hot = config.get("storage_gb_hot", 0) * config.get("storage_cost_per_gb_month", 0)
    storage_cold = config.get("storage_gb_cold", 0) * config.get("storage_cold_cost_per_gb_month", 0)
    egress = config.get("egress_gb_per_month", 0) * config.get("egress_cost_per_gb", 0)
    ci = (config.get("ci_minutes", 0)) * config.get("ci_cost_per_minute", 0)

    subtotal = compute + storage_hot + storage_cold + egress + ci
    support = subtotal * config.get("support_pct", 0)
    total = subtotal + support

    return {
        "compute_monthly": compute,
        "storage_hot_monthly": storage_hot,
        "storage_cold_monthly": storage_cold,
        "egress_monthly": egress,
        "ci_monthly": ci,
        "support_monthly": support,
        "total_monthly": total,
        "total_annual": total * 12
    }


def print_report(r: Dict[str, float]):
    print("Estimated monthly costs:")
    print(f"  Compute: ${r['compute_monthly']:.2f}")
    print(f"  Storage (hot): ${r['storage_hot_monthly']:.2f}")
    print(f"  Storage (cold): ${r['storage_cold_monthly']:.2f}")
    print(f"  Egress: ${r['egress_monthly']:.2f}")
    print(f"  CI: ${r['ci_monthly']:.2f}")
    print(f"  Support/overhead: ${r['support_monthly']:.2f}")
    print(f"  Total monthly: ${r['total_monthly']:.2f}")
    print(f"  Total annual: ${r['total_annual']:.2f}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", type=Path, help="JSON config path with cost assumptions")
    p.add_argument("--provider", type=str, help="Use a provider preset: digitalocean|aws|default")
    args = p.parse_args()
    cfg = None
    if args.provider:
        cfg = PROVIDER_PRESETS.get(args.provider.lower())
        if not cfg:
            print(f"Unknown provider preset: {args.provider}; falling back to default")
            cfg = DEFAULT_CONFIG
    elif args.config:
        cfg = load_config(args.config)
    else:
        cfg = DEFAULT_CONFIG
    res = estimate(cfg)
    print_report(res)


if __name__ == "__main__":
    main()
