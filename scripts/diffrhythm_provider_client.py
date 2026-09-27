#!/usr/bin/env python3
"""HTTP client for Harmonia's resident DiffRhythm provider."""

import argparse
import json
import sys
import urllib.error
import urllib.request


PROVIDER_URL = (
    "http://127.0.0.1:8767/generate"
)


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a song through Harmonia's "
            "resident DiffRhythm provider."
        )
    )

    parser.add_argument(
        "--model",
        required=True,
    )

    parser.add_argument(
        "--prompt",
        required=True,
    )

    parser.add_argument(
        "--lyrics",
        required=True,
    )

    parser.add_argument(
        "--duration",
        required=True,
        type=int,
    )

    parser.add_argument(
        "--output",
        required=True,
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=None,
    )

    return parser.parse_args()


def main():
    args = parse_args()

    payload = {
        "model":
            args.model,
        "prompt":
            args.prompt,
        "lyrics":
            args.lyrics,
        "duration":
            args.duration,
        "output":
            args.output,
    }

    if args.seed is not None:
        payload["seed"] = args.seed

    body = json.dumps(
        payload
    ).encode(
        "utf-8"
    )

    request = urllib.request.Request(
        PROVIDER_URL,
        data=body,
        headers={
            "Content-Type":
                "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=300,
        ) as response:
            response_body = (
                response
                .read()
                .decode(
                    "utf-8"
                )
            )

    except urllib.error.HTTPError as error:
        response_body = (
            error.read()
            .decode(
                "utf-8",
                errors="replace",
            )
        )

        raise RuntimeError(
            (
                "DiffRhythm provider returned "
                f"HTTP {error.code}: "
                f"{response_body}"
            )
        ) from error

    result = json.loads(
        response_body
    )

    if result.get("ok") is not True:
        raise RuntimeError(
            (
                "DiffRhythm provider returned "
                f"an unsuccessful result: "
                f"{json.dumps(result)}"
            )
        )

    print(
        json.dumps(
            result,
            separators=(
                ",",
                ":",
            ),
        )
    )


if __name__ == "__main__":
    try:
        main()

    except Exception as error:
        print(
            str(error),
            file=sys.stderr,
        )

        raise
