#!/usr/bin/env python3
"""CI helper: verify license coverage for models listed in `inventory/combined_inventory.json`.

Default (soft) mode: accept a `license_summary` (or `license` object in the manifest) as sufficient
coverage and only emit warnings for missing license files. Use `--strict` to make missing license
files a hard failure (exit code 1).
"""
import json
from pathlib import Path
import argparse
ROOT = Path.cwd()
INV = ROOT / "inventory" / "combined_inventory.json"
LICENSE_DIR = ROOT / "legal" / "licenses"

parser = argparse.ArgumentParser()
parser.add_argument('--strict', action='store_true', help='Fail CI if any license files are missing')
args = parser.parse_args()

if not INV.exists():
    print("No inventory/combined_inventory.json found; failing CI")
    raise SystemExit(1)

data = json.loads(INV.read_text(encoding="utf-8"))
missing = []
warnings = []
for m in data.get("models", []):
    name = m.get("folder_name") or m.get("repo_id") or Path(m.get("local_path","")).name
    candidate = LICENSE_DIR / f"{name}-LICENSE.txt"
    if candidate.exists():
        continue
    # Accept `license` or `license_summary` metadata as sufficient in soft mode
    license_info = m.get('license') or m.get('license_summary') or m.get('license_summary_text')
    if license_info:
        warnings.append((name, 'manifest-license-summary'))
        continue
    missing.append(name)

if warnings:
    print("Warning: the following models have license metadata in the manifest but no saved license file:")
    for n, reason in warnings:
        print(f" - {n} ({reason})")

if missing:
    print("Missing license files for models:")
    for n in missing:
        print(f" - {n}")
    print("Place license files under legal/licenses/<model>-LICENSE.txt or update inventory with license info.")
    if args.strict:
        print("--strict provided: failing CI due to missing license files.")
        raise SystemExit(1)
    else:
        print("Soft mode: treating missing license files as warnings (CI will not fail). Use --strict to enforce.")
        raise SystemExit(0)

print("All models have license coverage (local file or manifest summary).")
raise SystemExit(0)
