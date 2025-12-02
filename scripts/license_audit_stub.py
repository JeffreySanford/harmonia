#!/usr/bin/env python3
"""Create a per-model license checklist from the combined inventory (stub for manual completion).

The script reads `inventory/combined_inventory.json` (if present) and creates
`legal/licenses_checklist/<model>.md` files with fields to fill in.
"""
import json
from pathlib import Path

ROOT = Path.cwd()
INV = ROOT / "inventory" / "combined_inventory.json"
OUTDIR = ROOT / "legal" / "licenses_checklist"
OUTDIR.mkdir(parents=True, exist_ok=True)

if not INV.exists():
    print("No inventory/combined_inventory.json found; create one or copy the example and re-run")
    raise SystemExit(1)

data = json.loads(INV.read_text(encoding="utf-8"))
for m in data.get("models", []):
    name = m.get("name") or m.get("path")
    safe = name.replace('/', '_').replace(' ', '_')
    out = OUTDIR / f"{safe}.md"
    with out.open("w", encoding="utf-8") as f:
        f.write(f"# License checklist for {name}\n\n")
        f.write(f"Source: {m.get('source_url','(unknown)')}\n\n")
        f.write("- [ ] License file copied to `legal/licenses/`\n")
        f.write("- [ ] Commercial use: allowed / restricted / prohibited\n")
        f.write("- [ ] Redistribution: allowed / restricted / prohibited\n")
        f.write("- [ ] Attribution: required text (if any)\n")
        f.write("- [ ] Contains third-party checkpoints: yes / no (list)\n")
        f.write("- [ ] Dataset PII concerns: yes / no (details)\n")
        f.write("- [ ] Legal reviewer: name / date\n")

print(f"Wrote checklists to {OUTDIR}")
