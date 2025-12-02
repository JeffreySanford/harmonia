#!/usr/bin/env python3
"""Generate `legal/licenses_manifest.json` by scanning `inventory/combined_inventory.json`
and `legal/licenses/` for available license files.

This is a convenience to collect license metadata into a single manifest that CI
and maintainers can inspect.
"""
import json
from pathlib import Path
ROOT = Path.cwd()
INV = ROOT / "inventory" / "combined_inventory.json"
OUT = ROOT / "legal" / "licenses_manifest.json"
LICENSE_DIR = ROOT / "legal" / "licenses"

manifest = {"generated_at": None, "entries": []}

if not INV.exists():
    print("No inventory/combined_inventory.json present; generate inventory first or copy example")
    raise SystemExit(1)

data = json.loads(INV.read_text(encoding="utf-8"))
for m in data.get("models", []):
    name = m.get("name") or Path(m.get("path", "")).name
    candidate = LICENSE_DIR / f"{name}-LICENSE.txt"
    license_text = None
    if candidate.exists():
        license_text = candidate.read_text(encoding="utf-8")
    import json
    from pathlib import Path
    import urllib.request
    import urllib.error
    import datetime

    ROOT = Path.cwd()
    INV = ROOT / "inventory" / "combined_inventory.json"
    OUT = ROOT / "legal" / "licenses_manifest.json"
    LICENSE_DIR = ROOT / "legal" / "licenses"

    manifest = {"generated_at": None, "entries": []}

    def try_fetch_license(source_url: str, name: str):
        """Attempt to fetch a LICENSE file from common locations and save it to LICENSE_DIR.

        Returns the Path to the saved file or None if not found.
        """
        if not source_url:
            return None
        candidates = []
        # If GitHub URL, convert to raw.githubusercontent.com
        if "github.com" in source_url:
            try:
                parts = source_url.split('/')
                owner = parts[3]
                repo = parts[4]
                candidates.append(f"https://raw.githubusercontent.com/{owner}/{repo}/main/LICENSE")
                candidates.append(f"https://raw.githubusercontent.com/{owner}/{repo}/master/LICENSE")
                candidates.append(f"https://raw.githubusercontent.com/{owner}/{repo}/main/LICENSE.txt")
            except Exception:
                pass
        # Generic raw paths
        candidates.append(source_url.rstrip('/') + '/raw/main/LICENSE')
        candidates.append(source_url.rstrip('/') + '/raw/main/LICENSE.txt')
        candidates.append(source_url.rstrip('/') + '/LICENSE')
        candidates.append(source_url.rstrip('/') + '/LICENSE.txt')

        for url in candidates:
            try:
                with urllib.request.urlopen(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        LICENSE_DIR.mkdir(parents=True, exist_ok=True)
                        dest = LICENSE_DIR / f"{name}-LICENSE.txt"
                        dest.write_bytes(data)
                        print(f"Fetched license for {name} from {url}")
                        return dest
            except urllib.error.HTTPError:
                continue
            except Exception:
                continue
        return None


    if not INV.exists():
        print("No inventory/combined_inventory.json present; generate inventory first or copy example")
        raise SystemExit(1)

data = json.loads(INV.read_text(encoding="utf-8"))
for m in data.get("models", []):
    # Use folder_name or repo_id from actual inventory structure
    name = m.get("folder_name") or m.get("repo_id") or Path(m.get("local_path", "")).name
    repo_id = m.get("repo_id")
    local_path = m.get("local_path")
    
    candidate = LICENSE_DIR / f"{name}-LICENSE.txt"
    license_text = None
    license_file_path = None
    if candidate.exists():
        license_text = candidate.read_text(encoding="utf-8")
        license_file_path = str(candidate)
    else:
        # Try to auto-fetch license from HF repo if repo_id available
        if repo_id:
            # Construct HF model page URL
            source_url = f"https://huggingface.co/{repo_id}"
            fetched = try_fetch_license(source_url, name)
            if fetched:
                license_text = fetched.read_text(encoding="utf-8")
                license_file_path = str(fetched)

    entry = {
        "name": name,
        "repo_id": repo_id,
        "local_path": local_path,
        "license_file": license_file_path,
        "license_summary": m.get("license") or None
    }
    manifest["entries"].append(entry)

manifest["generated_at"] = datetime.datetime.utcnow().isoformat() + 'Z'
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"Wrote license manifest to {OUT}")
