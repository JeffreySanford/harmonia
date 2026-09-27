#!/usr/bin/env python3
"""DiffRhythm v1.2 provider shell for Harmonia M16."""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = "127.0.0.1"

PORT = int(
    os.environ.get(
        "HARMONIA_DIFFRHYTHM_PORT",
        "8767",
    )
)

MODELS_ROOT = Path(
    os.environ.get(
        "HARMONIA_DIFFRHYTHM_MODELS_ROOT",
        "/workspace/models/diffrhythm",
    )
)

SOURCE_REVISION = os.environ.get(
    "HARMONIA_DIFFRHYTHM_REF",
    "",
)

READY_FILE = Path(
    "/tmp/harmonia-runtime-ready"
)


def runtime_status():
    """
    M16-B proves provider-process readiness only.

    Model readiness deliberately remains false until registry-managed
    DiffRhythm/MuQ/VAE artifacts and the actual inference runtime are
    qualified in later M16 slices.
    """

    return {
        "ok": True,
        "ready": False,
        "busy": False,
        "model": None,
        "provider": "diffrhythm",
        "sourceRevision": SOURCE_REVISION,
        "modelsRoot": str(MODELS_ROOT),
        "modelsRootExists": MODELS_ROOT.exists(),
        "offline": (
            os.environ.get("HF_HUB_OFFLINE") == "1"
            and os.environ.get("TRANSFORMERS_OFFLINE") == "1"
        ),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "HarmoniaDiffRhythm/0.1"

    def _json(self, status, payload):
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
            "application/json"
        )

        self.send_header(
            "Content-Length",
            str(len(body))
        )

        self.end_headers()

        self.wfile.write(
            body
        )

    def do_GET(self):
        if self.path == "/health":
            self._json(
                200,
                runtime_status(),
            )
            return

        self._json(
            404,
            {
                "ok": False,
                "error": "not found",
            },
        )

    def do_POST(self):
        self._json(
            503,
            {
                "ok": False,
                "error": (
                    "DiffRhythm inference is not enabled "
                    "until M16 runtime qualification completes"
                ),
            },
        )

    def log_message(
        self,
        fmt,
        *args,
    ):
        print(
            f"DiffRhythm provider HTTP: {fmt % args}",
            flush=True,
        )


def main():
    READY_FILE.unlink(
        missing_ok=True
    )

    server = ThreadingHTTPServer(
        (
            HOST,
            PORT,
        ),
        Handler,
    )

    READY_FILE.touch()

    print(
        (
            "Harmonia DiffRhythm provider shell listening "
            f"on {HOST}:{PORT}; model loading disabled; "
            "offline runtime enforced"
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
