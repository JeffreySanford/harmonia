#!/usr/bin/env python3
"""
Environment smoke check

Scans `models/` and `datasets/`, computes SHA256 for a selected set of files,
and compares computed checksums against any recorded checksums (if present).

This script never modifies repository files. It writes a JSON report under
`tests/env_tests/smoke_report_<timestamp>.json` and prints a concise summary.
"""
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path.cwd()
MODELS_DIR = ROOT / "models"
DATASETS_DIR = ROOT / "datasets"
CHECKSUMS_FILE = MODELS_DIR / "checksums.sha256"
REPORT_DIR = ROOT / "tests" / "env_tests"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def load_recorded_checksums(path: Path):
    if not path.is_file():
        return {}
    checks = {}
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            ch = parts[0]
            p = " ".join(parts[1:]).lstrip("* ")
            checks[str(Path(p).resolve())] = ch
    return checks


def sha256_of_file(path: Path, chunk_size: int = 8 * 1024 * 1024):
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def find_files_to_check(models_dir: Path, datasets_dir: Path, recorded_checks: dict):
    files = []

    # If recorded checks exist, use their paths (preferential)
    if recorded_checks:
        for p in recorded_checks.keys():
            files.append(Path(p))
        return files

    # No recorded checks: pick largest files in models (global top N)
    # and use dataset inventory top files if present.
    # Models: gather files > 100MB, sort by size, pick top 12
    model_files = []
    if models_dir.is_dir():
        for root, _, filenames in os.walk(models_dir):
            for fn in filenames:
                fp = Path(root) / fn
                try:
                    sz = fp.stat().st_size
                except Exception:
                    sz = 0
                model_files.append((sz, fp))
    model_files.sort(reverse=True)
    for sz, fp in model_files[:12]:
        files.append(fp)

    # Datasets: prefer snapshot files / archives; pick top 8
    dataset_files = []
    if datasets_dir.is_dir():
        for root, _, filenames in os.walk(datasets_dir):
            for fn in filenames:
                fp = Path(root) / fn
                try:
                    sz = fp.stat().st_size
                except Exception:
                    sz = 0
                dataset_files.append((sz, fp))
    dataset_files.sort(reverse=True)
    for sz, fp in dataset_files[:8]:
        files.append(fp)

    # Deduplicate while preserving order
    seen = set()
    dedup = []
    for f in files:
        rp = str(f.resolve())
        if rp in seen:
            continue
        seen.add(rp)
        dedup.append(f)
    return dedup


def main():
    recorded = load_recorded_checksums(CHECKSUMS_FILE)

    files = find_files_to_check(MODELS_DIR, DATASETS_DIR, recorded)
    if not files:
        print("No files found to check.")
        return 2

    results = []
    total = len(files)
    matched = 0
    missing = 0

    print(f"Verifying {total} files (report will be written to {REPORT_DIR})")

    for idx, fp in enumerate(files, start=1):
        info = {"path": str(fp), "exists": False, "size_bytes": None, "sha256": None, "expected": None, "match": None}
        try:
            rp = fp.resolve()
        except Exception:
            rp = fp
        if not fp.exists():
            info["exists"] = False
            missing += 1
            results.append(info)
            print(f"[{idx}/{total}] MISSING: {fp}")
            continue
        info["exists"] = True
        try:
            sz = fp.stat().st_size
            info["size_bytes"] = sz
        except Exception:
            sz = None
        # compute sha256
        print(f"[{idx}/{total}] Computing sha256 for {fp} ...", end=" ")
        try:
            ch = sha256_of_file(fp)
            info["sha256"] = ch
            print("done")
        except Exception as e:
            info["sha256_error"] = str(e)
            print("ERROR computing checksum:", e)
            results.append(info)
            continue

        exp = recorded.get(str(fp.resolve())) if recorded else None
        info["expected"] = exp
        if exp:
            info["match"] = (ch == exp)
            if info["match"]:
                matched += 1
        else:
            info["match"] = None
        results.append(info)

    summary = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_files": total,
        "matched": matched,
        "missing": missing,
        "has_recorded_checksums": bool(recorded),
    }

    report = {"summary": summary, "results": results}
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    out = REPORT_DIR / f"smoke_report_{ts}.json"
    with out.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print()
    print("Summary:")
    print(json.dumps(summary, indent=2))
    print(f"Report written to: {out}")
    # Return non-zero if any recorded checksums mismatched or files missing
    if recorded and (matched != total):
        print("Some recorded checksums did not match or files missing.")
        return 3
    if missing > 0 and not recorded:
        print("Some files are missing (no recorded checksums to compare).")
        return 4
    print("Smoke check completed (no mismatches found)." if recorded and matched == total else "Smoke check completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
