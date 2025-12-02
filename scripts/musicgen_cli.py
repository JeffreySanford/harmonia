#!/usr/bin/env python3
"""Music generation CLI (scaffold)

This script provides a minimal CLI to validate local model presence, select a variant
and (optionally) run a lightweight generation flow. It is intentionally conservative
and uses local artifacts only.
"""
import argparse
import json
import os
from pathlib import Path
import sys


ROOT = Path.cwd()
MODELS_DIR = ROOT / "models"
ARTIFACTS_DIR = ROOT / "artifacts"


def list_models():
    if not MODELS_DIR.exists():
        print("No models directory found.")
        return []
    candidates = []
    for p in MODELS_DIR.iterdir():
        if p.is_dir():
            candidates.append(p.name)
    return candidates


def check_model_path(model_name):
    p = MODELS_DIR / model_name
    return p.exists()


def main():
    parser = argparse.ArgumentParser(prog="musicgen-cli")
    sub = parser.add_subparsers(dest="cmd")

    ps = sub.add_parser("list", help="List available model folders under `models/`")

    p_check = sub.add_parser("check", help="Check model presence")
    p_check.add_argument("model", help="Model folder name")

    p_run = sub.add_parser("run", help="Run a conservative generation (scaffold)")
    p_run.add_argument("model", help="Model folder name")
    p_run.add_argument("--seconds", type=int, default=5, help="Preview seconds (small)")

    args = parser.parse_args()

    if args.cmd == "list":
        models = list_models()
        print(json.dumps({"models": models}, indent=2))
        return 0

    if args.cmd == "check":
        ok = check_model_path(args.model)
        print(f"Model {args.model}: {'FOUND' if ok else 'MISSING'}")
        return 0 if ok else 2

    if args.cmd == "run":
        if not check_model_path(args.model):
            print("Model not present. Use the downloader to fetch the model or mount models/ into the container.")
            return 3
        # Conservative: do not attempt real inference if audiocraft/torch not installed.
        try:
            import torch  # type: ignore
        except Exception:
            print("PyTorch not available in this environment. For a full run install the runtime or use the Docker worker image.")
            return 4

        print(f"Would run model {args.model} for {args.seconds}s (scaffold). Implement inference in `scripts/generate_with_musicgen.py` or extend this CLI.")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
