#!/usr/bin/env python3
"""Strict DiffSinger wrapper for Harmonia.

Usage:
  python3 scripts/run_diffsinger.py <meta_json_path> <output_wav_path>

The pinned compatibility helper owns inference. This wrapper never fabricates
audio: it copies a genuine RIFF/WAVE result to the requested path or exits
non-zero.
"""

import glob
import json
import os
import shutil
import subprocess
import sys


def is_valid_wav(path):
    try:
        with open(path, "rb") as stream:
            header = stream.read(12)
        return (
            len(header) >= 12
            and header[:4] == b"RIFF"
            and header[8:12] == b"WAVE"
        )
    except OSError:
        return False


def run_diffsinger(meta_path, out_path):
    try:
        with open(meta_path, "r", encoding="utf-8") as stream:
            meta = json.load(stream)

        title = str(meta.get("title") or "harmonia-diffsinger")
        out_dir = os.path.dirname(out_path) or "/workspace/generated/songs"
        os.makedirs(out_dir, exist_ok=True)

        before = set(glob.glob(os.path.join(out_dir, "*.wav")))

        command = [
            "python3",
            "/workspace/scripts/diffsinger_infer_helper.py",
            out_dir,
            title,
            meta_path,
        ]
        print("Running pinned DiffSinger compatibility inference:", command)
        completed = subprocess.run(command, check=False)

        if completed.returncode != 0:
            print(
                f"DiffSinger compatibility helper failed with exit "
                f"{completed.returncode}.",
                file=sys.stderr,
            )
            return completed.returncode or 5

        candidates = [
            candidate
            for candidate in glob.glob(os.path.join(out_dir, "*.wav"))
            if candidate not in before and is_valid_wav(candidate)
        ]

        if not candidates:
            candidates = [
                candidate
                for candidate in glob.glob(os.path.join(out_dir, "*.wav"))
                if is_valid_wav(candidate)
            ]

        if not candidates:
            print(
                "DiffSinger helper returned success but produced no valid WAV.",
                file=sys.stderr,
            )
            return 6

        source = max(candidates, key=os.path.getmtime)
        if os.path.abspath(source) != os.path.abspath(out_path):
            shutil.copy2(source, out_path)

        if not is_valid_wav(out_path):
            print("DiffSinger output failed RIFF/WAVE validation.", file=sys.stderr)
            return 7

        print(f"DiffSinger generated real audio: {out_path}")
        return 0
    except Exception as exc:
        print(f"Error running DiffSinger wrapper: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            "Usage: run_diffsinger.py <meta_json_path> <output_wav_path>",
            file=sys.stderr,
        )
        raise SystemExit(3)

    metadata_path = sys.argv[1]
    output_path = sys.argv[2]
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    raise SystemExit(run_diffsinger(metadata_path, output_path))
