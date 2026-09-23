#!/usr/bin/env python3
"""Run Harmonia's pinned DiffSinger compatibility inference.

Arguments:
  diffsinger_infer_helper.py <out_dir> <title>

This adapter intentionally targets OpenVPI DiffSinger commit
017bd488a61ebdb8909a8d272ec6211076fa4a7e and the official pretrained
OpenCpop stack:
  - 0228_opencpop_ds100_rel (acoustic)
  - 0102_xiaoma_pe (pitch estimator)
  - 0109_hifigan_bigpopcs_hop128 (vocoder)
"""

import os
import pathlib
import re
import subprocess
import sys

EXPECTED_REF = "017bd488a61ebdb8909a8d272ec6211076fa4a7e"
DIFFSINGER_ROOT = pathlib.Path("/opt/DiffSinger")
CONFIG = "configs/midi/e2e/opencpop/ds100_adj_rel.yaml"
EXP_NAME = "0228_opencpop_ds100_rel"


def fail(message, code):
    print(message, file=sys.stderr)
    raise SystemExit(code)


def validate_runtime_revision():
    try:
        actual = subprocess.check_output(
            ["git", "-C", str(DIFFSINGER_ROOT), "rev-parse", "HEAD"],
            text=True,
        ).strip()
    except Exception as exc:
        fail(f"Unable to identify DiffSinger runtime revision: {exc}", 3)

    if actual != EXPECTED_REF:
        fail(
            f"Unexpected DiffSinger revision {actual}; expected {EXPECTED_REF}.",
            3,
        )


def validate_wav(path):
    try:
        with open(path, "rb") as stream:
            header = stream.read(12)
    except OSError as exc:
        fail(f"DiffSinger did not produce a readable WAV: {exc}", 7)

    if len(header) < 12 or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
        fail(f"DiffSinger output is not RIFF/WAVE: {path}", 7)


if len(sys.argv) < 3:
    fail("Usage: diffsinger_infer_helper.py <out_dir> <title>", 2)

out_dir = pathlib.Path(sys.argv[1])
raw_title = sys.argv[2]
safe_title = re.sub(r"[^A-Za-z0-9._-]+", "-", raw_title).strip("-") or "diffsinger"
target = out_dir / f"{safe_title}.wav"

validate_runtime_revision()

for required in (
    DIFFSINGER_ROOT / "checkpoints/0228_opencpop_ds100_rel/config.yaml",
    DIFFSINGER_ROOT / "checkpoints/0102_xiaoma_pe/config.yaml",
    DIFFSINGER_ROOT / "checkpoints/0109_hifigan_bigpopcs_hop128/config.yaml",
):
    if not required.is_file():
        fail(f"Missing DiffSinger inference dependency: {required}", 4)

out_dir.mkdir(parents=True, exist_ok=True)
os.chdir(DIFFSINGER_ROOT)
sys.path.insert(0, str(DIFFSINGER_ROOT))

# BaseSVSInfer.example_run() reads the normal DiffSinger CLI arguments through
# set_hparams(), so provide the pinned model/config explicitly.
sys.argv = [
    "diffsinger_infer_helper.py",
    "--config",
    CONFIG,
    "--exp_name",
    EXP_NAME,
]

try:
    from inference.ds_e2e import DiffSingerE2EInfer

    sample = {
        "text": "SP一闪一闪亮晶晶SP满天都是小星星",
        "notes": (
            "rest|C4|C4|G4|G4|A4|A4|G4|rest|"
            "F4|F4|E4|E4|D4|D4|C4"
        ),
        "notes_duration": (
            "1|0.5|0.5|0.5|0.5|0.5|0.5|0.75|0.25|"
            "0.5|0.5|0.5|0.5|0.5|0.5|0.75"
        ),
        "input_type": "word",
    }

    DiffSingerE2EInfer.example_run(sample, target=str(target))
except Exception as exc:
    print(f"DiffSinger compatibility inference failed: {exc}", file=sys.stderr)
    raise

validate_wav(target)
print(f"DiffSinger compatibility inference completed: {target}")
print("DIFFSINGER_COMPAT_INFERENCE_OK")
