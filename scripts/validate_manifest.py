#!/usr/bin/env python3
"""Validate inventory/combined_inventory.json against inventory/manifest_schema.json

Exits with:
 - 0 if valid or files absent
 - 2 if validation errors found
"""
import json
import sys
from pathlib import Path

root = Path.cwd()
schema_p = root / "inventory" / "manifest_schema.json"
data_p = root / "inventory" / "combined_inventory.json"

if not schema_p.exists() or not data_p.exists():
    print("Manifest or schema missing; skipping validation")
    sys.exit(0)

try:
    from jsonschema import Draft7Validator
except Exception as e:
    print("jsonschema not installed:", e)
    sys.exit(0)

schema = json.loads(schema_p.read_text(encoding="utf-8"))
data = json.loads(data_p.read_text(encoding="utf-8"))
v = Draft7Validator(schema)
errors = list(v.iter_errors(data))
if errors:
    print("Manifest validation errors:")
    for e in errors:
        print("-", e.message)
    sys.exit(2)

print("Manifest validated OK")
sys.exit(0)
