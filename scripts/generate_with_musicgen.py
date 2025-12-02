#!/usr/bin/env python3
"""
Minimal inference example for local MusicGen models.

This script demonstrates how to locate locally-downloaded MusicGen model
folders under `models/facebook/`, print basic metadata, and (optionally)
attempt to load the model runtime if `audiocraft` / `torch` are available.

It is intentionally conservative and will not download anything from the
network. Use this as a starter for running small generation experiments
inside a properly configured Python environment or Docker container.
"""
import argparse
import json
import os
from pathlib import Path


ROOT = Path.cwd()
MODELS_DIR = ROOT / "models" / "facebook"


def find_model_dirs(base: Path):
    if not base.exists():
        return []
    return [p for p in sorted(base.iterdir()) if p.is_dir()]


def read_config(model_dir: Path):
    for name in ("config.json", "generation_config.json", "model_index.json"):
        p = model_dir / name
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                return None
    return None


def try_load_with_audiocraft(model_dir: Path):
    try:
        # audiocraft is optional; if installed, it provides a high-level API
        from audiocraft.models import musicgen
        from torch import no_grad
    except Exception as e:
        print("audiocraft not available (or torch). Skipping runtime load. Error:", e)
        return False

    print("Attempting to load MusicGen via audiocraft from:", model_dir)
    # Many HF snapshots store repo files under a nested path; pass the path
    # to the model loader if it supports local path loading. This is an example
    # and may need adjustments for your exact snapshot layout.
    try:
        # musicgen.Default takes repo id or path depending on version
        mg = musicgen.MusicGen.get_pretrained("local")
        print("Loaded MusicGen object (placeholder):", mg)
    except Exception as e:
        print("Failed to instantiate MusicGen model from local snapshot:", e)
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="Local MusicGen inference example")
    parser.add_argument("--model", "-m", help="Model folder name under models/facebook/ (e.g. facebook_musicgen-small)")
    parser.add_argument("--list", "-l", action="store_true", help="List available local model folders")
    args = parser.parse_args()

    models = find_model_dirs(MODELS_DIR)
    if args.list:
        print("Available local models:")
        for m in models:
            print(" -", m.name)
        return 0

    if args.model is None:
        print("No model specified. Use --list to see available models.")
        return 2

    selected = MODELS_DIR / args.model
    if not selected.exists():
        print(f"Model folder not found: {selected}")
        return 3

    print("Selected model:", selected)
    cfg = read_config(selected)
    if cfg:
        print("Found config:")
        print(json.dumps(cfg, indent=2)[:2000])
    else:
        print("No JSON config found in model folder; will inspect files.")

    # List top files
    files = sorted(selected.rglob("*"), key=lambda p: (p.stat().st_size if p.is_file() else 0), reverse=True)[:10]
    print("Top files in model folder:")
    for f in files:
        try:
            print(f" - {f.relative_to(selected)} ({f.stat().st_size // (1024*1024)} MB)")
        except Exception:
            print(" -", f)

    # Try to load with audiocraft if available (best-effort)
    ok = try_load_with_audiocraft(selected)
    if not ok:
        print("Runtime load skipped. To actually run inference install: ")
        print("  pip install torch soundfile torchaudio audiocraft huggingface_hub")
        print("Then adapt this script to instantiate the model from the local snapshot.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
