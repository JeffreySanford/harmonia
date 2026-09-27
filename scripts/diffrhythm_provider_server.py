#!/usr/bin/env python3
"""Persistent DiffRhythm v1.2 Base provider for Harmonia."""

import json
import os
import traceback
from http.server import (
    BaseHTTPRequestHandler,
    ThreadingHTTPServer,
)
from pathlib import Path

from diffrhythm_runtime import (
    DiffRhythmRuntime,
)


HOST = "127.0.0.1"

PORT = int(
    os.environ.get(
        "HARMONIA_DIFFRHYTHM_PORT",
        "8767",
    )
)

READY_FILE = Path(
    "/tmp/harmonia-runtime-ready"
)

RUNTIME = DiffRhythmRuntime()


class Handler(
    BaseHTTPRequestHandler
):
    server_version = (
        "HarmoniaDiffRhythm/1.0"
    )

    def _json(
        self,
        status,
        payload,
    ):
        body = json.dumps(
            payload
        ).encode(
            "utf-8"
        )

        self.send_response(
            status
        )

        self.send_header(
            "Content-Type",
            "application/json",
        )

        self.send_header(
            "Content-Length",
            str(
                len(body)
            ),
        )

        self.end_headers()

        self.wfile.write(
            body
        )

    def do_GET(
        self,
    ):
        if self.path == "/health":
            self._json(
                200,
                RUNTIME.status(),
            )

            return

        self._json(
            404,
            {
                "ok":
                    False,
                "error":
                    "not found",
            },
        )

    def do_POST(
        self,
    ):
        if self.path != "/generate":
            self._json(
                404,
                {
                    "ok":
                        False,
                    "error":
                        "not found",
                },
            )

            return

        try:
            length = int(
                self.headers.get(
                    "Content-Length",
                    "0",
                )
            )

            if (
                length <= 0
                or
                length > 65536
            ):
                raise ValueError(
                    "invalid request size"
                )

            payload = json.loads(
                self.rfile.read(
                    length
                ).decode(
                    "utf-8"
                )
            )

            result = (
                RUNTIME.generate(
                    payload
                )
            )

            self._json(
                200,
                result,
            )

        except Exception as error:
            traceback.print_exc()

            self._json(
                500,
                {
                    "ok":
                        False,
                    "error":
                        str(error),
                },
            )

    def log_message(
        self,
        fmt,
        *args,
    ):
        print(
            (
                "DiffRhythm provider HTTP: "
                f"{fmt % args}"
            ),
            flush=True,
        )


def main():
    READY_FILE.unlink(
        missing_ok=True
    )

    print(
        (
            "Preparing Harmonia "
            "DiffRhythm resident runtime"
        ),
        flush=True,
    )

    RUNTIME.prepare()

    server = (
        ThreadingHTTPServer(
            (
                HOST,
                PORT,
            ),
            Handler,
        )
    )

    READY_FILE.touch()

    print(
        (
            "Harmonia DiffRhythm provider "
            f"ready on {HOST}:{PORT}; "
            "v1.2 Base prepared on CPU; "
            "staged CUDA generation enabled"
        ),
        flush=True,
    )

    try:
        server.serve_forever()

    finally:
        READY_FILE.unlink(
            missing_ok=True
        )

        server.server_close()


if __name__ == "__main__":
    main()
