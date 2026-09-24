#!/usr/bin/env python3
"""CLI client for the persistent Harmonia Stable Audio 3 provider."""

import argparse
import json
import sys
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--duration", type=float, default=5)
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--steps", type=int, default=8)
    parser.add_argument("--seed", type=int, default=-1)
    args = parser.parse_args()

    payload = {
        "output": args.output,
        "duration": args.duration,
        "model": args.model,
        "prompt": args.prompt,
        "steps": args.steps,
        "seed": args.seed,
    }

    request = urllib.request.Request(
        "http://127.0.0.1:8766/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=1200) as response:
            body = response.read().decode("utf-8")
            print(body)
            if response.status != 200:
                return 1
            result = json.loads(body)
            return 0 if result.get("ok") else 1
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(body or str(exc), file=sys.stderr)
        return 1
    except Exception as exc:
        print(
            f"Stable Audio 3 provider request failed: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
