#!/usr/bin/env python3
"""Persistent Stable Audio 3 Small-Music provider for Harmonia."""

import gc
import json
import os
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import soundfile as sf
import torch
from stable_audio_3 import StableAudioModel

HOST = "127.0.0.1"
PORT = int(os.environ.get("HARMONIA_STABLE_AUDIO_3_PORT", "8766"))
READY_FILE = Path("/tmp/harmonia-runtime-ready")

SUPPORTED_MODELS = {
    "small-music": 120.0,
}


class StableAudioRuntime:
    def __init__(self):
        self._lock = threading.Lock()
        self._model = None
        self._model_name = None
        self._device = None
        self._busy = False
        self._last_error = None

    def status(self):
        return {
            "ready": True,
            "busy": self._busy,
            "model": self._model_name,
            "device": self._device,
            "cuda": torch.cuda.is_available(),
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "lastError": self._last_error,
        }

    def _unload_model(self):
        if self._model is None:
            return

        print(
            f"Unloading Stable Audio 3 model: {self._model_name}",
            flush=True,
        )
        self._model = None
        self._model_name = None
        self._device = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _resolve_device(self):
        configured = os.environ.get("HARMONIA_STABLE_AUDIO_3_DEVICE", "").strip()
        if configured:
            return configured
        return "cuda" if torch.cuda.is_available() else "cpu"

    def _ensure_model(self, model_name):
        if model_name not in SUPPORTED_MODELS:
            raise ValueError(
                f"unsupported Stable Audio 3 model '{model_name}'; "
                f"supported models: {', '.join(SUPPORTED_MODELS)}"
            )

        device = self._resolve_device()

        if (
            self._model is not None
            and self._model_name == model_name
            and self._device == device
        ):
            print(
                f"Reusing resident Stable Audio 3 model: {model_name} on {device}",
                flush=True,
            )
            return self._model

        self._unload_model()
        print(
            f"Loading Stable Audio 3 model: {model_name} on {device}",
            flush=True,
        )

        try:
            self._model = StableAudioModel.from_pretrained(
                model_name,
                device=device,
            )
        except Exception as exc:
            message = str(exc)
            if (
                "gated" in message.lower()
                or "401" in message
                or "403" in message
                or "authorized" in message.lower()
            ):
                raise RuntimeError(
                    "Stable Audio 3 model access failed. Accept the gated "
                    "stabilityai/stable-audio-3-small-music terms on Hugging "
                    "Face and configure HUGGINGFACE_HUB_TOKEN in Harmonia."
                ) from exc
            raise

        self._model_name = model_name
        self._device = device
        print(
            f"Stable Audio 3 model resident: {model_name} on {device}",
            flush=True,
        )
        return self._model

    def generate(self, payload):
        model_name = str(
            payload.get("model")
            or os.environ.get(
                "HARMONIA_STABLE_AUDIO_3_MODEL",
                "small-music",
            )
        ).strip()

        if model_name not in SUPPORTED_MODELS:
            raise ValueError(f"unsupported Stable Audio 3 model: {model_name}")

        prompt = str(payload.get("prompt") or "").strip()
        if not prompt:
            raise ValueError("prompt is required")

        duration = float(payload.get("duration", 5))
        max_duration = SUPPORTED_MODELS[model_name]
        if duration < 1 or duration > max_duration:
            raise ValueError(
                f"duration must be between 1 and {max_duration:g} seconds"
            )

        output_path = str(payload.get("output") or "").strip()
        if not output_path:
            raise ValueError("output is required")
        if not (
            output_path.startswith("/workspace/generated/")
            or output_path.startswith("/workspace/exports/")
            or output_path.startswith("/tmp/")
        ):
            raise ValueError(
                "output must be under /workspace/generated, "
                "/workspace/exports, or /tmp"
            )

        steps = int(payload.get("steps", 8))
        if steps < 1 or steps > 100:
            raise ValueError("steps must be between 1 and 100")

        seed = int(payload.get("seed", -1))

        with self._lock:
            self._busy = True
            self._last_error = None
            try:
                model = self._ensure_model(model_name)
                print(
                    f"Generating {duration:g}s with {model_name}: {prompt}",
                    flush=True,
                )

                audio = model.generate(
                    prompt=prompt,
                    duration=duration,
                    steps=steps,
                    seed=seed,
                    batch_size=1,
                )

                waveform = audio[0].detach().cpu().to(torch.float32).numpy()
                if waveform.ndim != 2:
                    raise RuntimeError(
                        f"unexpected Stable Audio tensor shape: {waveform.shape}"
                    )

                output = Path(output_path)
                output.parent.mkdir(parents=True, exist_ok=True)

                # Stable Audio 3's native output contract is 44.1 kHz stereo
                # float audio. Preserve that rather than quantizing to PCM16.
                sf.write(
                    str(output),
                    waveform.T,
                    model.model.sample_rate,
                    subtype="FLOAT",
                )

                size = output.stat().st_size
                print(
                    f"Stable Audio 3 generation complete: {output_path} "
                    f"({size} bytes)",
                    flush=True,
                )

                return {
                    "ok": True,
                    "model": model_name,
                    "device": self._device,
                    "prompt": prompt,
                    "duration": duration,
                    "steps": steps,
                    "seed": seed,
                    "sampleRate": model.model.sample_rate,
                    "channels": waveform.shape[0],
                    "output": output_path,
                    "size": size,
                }
            except Exception as exc:
                self._last_error = str(exc)
                traceback.print_exc()
                raise
            finally:
                self._busy = False


RUNTIME = StableAudioRuntime()


class Handler(BaseHTTPRequestHandler):
    server_version = "HarmoniaStableAudio3/1.0"

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, RUNTIME.status())
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path != "/generate":
            self._json(404, {"ok": False, "error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 65536:
                raise ValueError("invalid request size")

            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            result = RUNTIME.generate(payload)
            self._json(200, result)
        except Exception as exc:
            self._json(500, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        print(f"Stable Audio 3 provider HTTP: {fmt % args}", flush=True)


def main():
    READY_FILE.unlink(missing_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    READY_FILE.touch()
    print(
        f"Harmonia Stable Audio 3 provider listening on {HOST}:{PORT}; "
        "model loads lazily",
        flush=True,
    )
    try:
        server.serve_forever()
    finally:
        READY_FILE.unlink(missing_ok=True)
        server.server_close()


if __name__ == "__main__":
    main()
