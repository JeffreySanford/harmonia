#!/usr/bin/env python3
"""Harmonia ACE-Step 1.5 provider client.

Submits one asynchronous generation task to the resident ACE-Step API, polls
until terminal state, downloads the generated WAV into Harmonia's shared export
mount, and prints one machine-readable JSON result.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE_URL = os.environ.get("HARMONIA_ACESTEP_API_URL", "http://127.0.0.1:8001").rstrip("/")


def request_json(path: str, payload: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL + path,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
    parsed = json.loads(raw)
    if parsed.get("code") != 200 or parsed.get("error"):
        raise RuntimeError(f"ACE-Step API {path} failed: {parsed}")
    return parsed


def download_audio(url_or_path: str, output_path: Path, timeout: int = 300) -> None:
    url = (
        url_or_path
        if url_or_path.startswith("http://") or url_or_path.startswith("https://")
        else BASE_URL + (url_or_path if url_or_path.startswith("/") else "/" + url_or_path)
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
    if not payload:
        raise RuntimeError("ACE-Step audio download returned an empty payload")
    output_path.write_bytes(payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--lyrics", required=True)
    parser.add_argument("--bpm", type=int, default=None)
    parser.add_argument("--vocal-language", default="en")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.duration < 10 or args.duration > 600:
        raise ValueError("ACE-Step duration must be between 10 and 600 seconds")
    if not args.prompt.strip():
        raise ValueError("ACE-Step prompt is required")
    if not args.lyrics.strip():
        raise ValueError("ACE-Step supplied lyrics are required")

    payload: dict[str, Any] = {
        "prompt": args.prompt.strip(),
        "lyrics": args.lyrics.strip(),
        "thinking": True,
        "vocal_language": args.vocal_language.strip() or "en",
        "audio_format": "wav",
        "model": args.model,
        "audio_duration": args.duration,
        "inference_steps": 8,
        "batch_size": 1,
        "lm_model_path": "acestep-5Hz-lm-0.6B",
        "use_cot_caption": False,
        "use_cot_language": False,
    }

    if args.bpm is not None:
        payload["bpm"] = args.bpm

    if args.seed is None:
        payload["use_random_seed"] = True
    else:
        payload["use_random_seed"] = False
        payload["seed"] = args.seed

    released = request_json("/release_task", payload)
    task_id = released.get("data", {}).get("task_id")
    if not task_id:
        raise RuntimeError(f"ACE-Step release_task returned no task_id: {released}")

    deadline = time.monotonic() + args.timeout_seconds
    terminal: dict[str, Any] | None = None

    while time.monotonic() < deadline:
        queried = request_json("/query_result", {"task_id_list": [task_id]})
        rows = queried.get("data")
        if not isinstance(rows, list) or not rows:
            time.sleep(args.poll_seconds)
            continue

        row = rows[0]
        status = int(row.get("status", 0))
        if status == 0:
            time.sleep(args.poll_seconds)
            continue
        if status == 2:
            raise RuntimeError(f"ACE-Step generation task failed: {row}")
        if status == 1:
            terminal = row
            break

        raise RuntimeError(f"ACE-Step returned unknown task status {status}: {row}")

    if terminal is None:
        raise TimeoutError(
            f"ACE-Step generation task {task_id} did not finish within {args.timeout_seconds}s"
        )

    raw_result = terminal.get("result")
    if isinstance(raw_result, str):
        result_rows = json.loads(raw_result)
    elif isinstance(raw_result, list):
        result_rows = raw_result
    else:
        raise RuntimeError(f"ACE-Step task result is not a list/string: {terminal}")

    if not result_rows:
        raise RuntimeError(f"ACE-Step task {task_id} returned no generated results")

    generated = result_rows[0]
    if int(generated.get("status", 0)) != 1:
        raise RuntimeError(f"ACE-Step generated result is not successful: {generated}")

    audio_url = (
        generated.get("file")
        or generated.get("url")
        or generated.get("first_audio_path")
    )
    if not audio_url:
        raise RuntimeError(f"ACE-Step result contains no audio URL: {generated}")

    output_path = Path(args.output)
    download_audio(str(audio_url), output_path)

    summary = {
        "taskId": task_id,
        "outputPath": str(output_path),
        "prompt": generated.get("prompt", payload["prompt"]),
        "lyrics": generated.get("lyrics", payload["lyrics"]),
        "metas": generated.get("metas") or {},
        "generationInfo": generated.get("generation_info"),
        "seedValue": generated.get("seed_value"),
        "lmModel": generated.get("lm_model"),
        "ditModel": generated.get("dit_model"),
        "audioUrl": audio_url,
    }

    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ACE_STEP_PROVIDER_CLIENT_ERROR: {exc}", file=sys.stderr)
        raise
