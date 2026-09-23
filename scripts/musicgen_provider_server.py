#!/usr/bin/env python3
"""Persistent MusicGen provider process for Harmonia."""

import gc
import json
import os
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from audiocraft.models import MusicGen

HOST = "127.0.0.1"
PORT = int(os.environ.get("HARMONIA_MUSICGEN_PORT", "8765"))
READY_FILE = Path("/tmp/harmonia-runtime-ready")

INSTRUMENT_PROMPTS = {
    "piano": "solo piano melody, classical, clean recording",
    "guitar_acoustic": "acoustic guitar strumming, folk music, warm tones",
    "guitar_electric": "electric guitar solo, rock music, distorted",
    "bass": "upright bass walking line, jazz, warm and woody",
    "drums": "drum kit groove, rock beat, energetic",
    "violin": "violin solo, classical, expressive",
    "cello": "cello solo, orchestral, rich and deep",
    "flute": "flute melody, classical, pure and clear",
    "trumpet": "trumpet solo, jazz, bright and brassy",
    "saxophone": "saxophone solo, jazz, smooth and mellow",
    "clarinet": "clarinet solo, classical, warm and reedy",
    "trombone": "trombone solo, orchestral, powerful",
    "horn": "french horn solo, orchestral, noble",
    "tuba": "tuba solo, orchestral, deep and resonant",
    "cymbals": "cymbal crashes, orchestral, shimmering",
    "timpani": "timpani rolls, orchestral, thunderous",
    "bass_drum": "bass drum hits, orchestral, powerful",
    "organ": "pipe organ, classical, grand and resonant",
    "accordion": "accordion melody, folk, lively",
    "celesta": "celesta glissando, classical, tinkling",
    "marimba": "marimba solo, contemporary, wooden tones",
    "male_voice": "male vocal solo, classical, operatic",
    "female_voice": "female vocal solo, classical, lyrical",
    "choir": "choir singing, classical, harmonious",
    "synth_lead": "synthesizer lead, electronic, bright",
    "synth_pad": "synthesizer pad, ambient, lush",
    "bass_synth": "synthesizer bass, electronic, deep",
    "drum_machine": "electronic drum machine, techno, mechanical",
}


class MusicGenRuntime:
    def __init__(self):
        self._lock = threading.Lock()
        self._model = None
        self._model_name = None
        self._busy = False
        self._last_error = None

    def status(self):
        return {
            "ready": True,
            "busy": self._busy,
            "model": self._model_name,
            "cuda": torch.cuda.is_available(),
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "lastError": self._last_error,
        }

    def _unload_model(self):
        if self._model is not None:
            print(f"Unloading MusicGen model: {self._model_name}", flush=True)
            self._model = None
            self._model_name = None
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    def _ensure_model(self, model_name):
        if self._model is not None and self._model_name == model_name:
            print(f"Reusing resident MusicGen model: {model_name}", flush=True)
            return self._model

        self._unload_model()
        print(f"Loading MusicGen model into GPU memory: {model_name}", flush=True)
        self._model = MusicGen.get_pretrained(model_name)
        self._model_name = model_name
        print(f"MusicGen model resident: {model_name}", flush=True)
        return self._model

    def generate(self, payload):
        instrument = str(payload.get("instrument") or "").strip()
        if not instrument:
            raise ValueError("instrument is required")

        model_name = str(
            payload.get("model")
            or os.environ.get("HARMONIA_MUSICGEN_MODEL", "facebook/musicgen-small")
        ).strip()
        duration = int(payload.get("duration", 5))
        if duration < 1 or duration > 120:
            raise ValueError("duration must be between 1 and 120 seconds")

        output_path = str(payload.get("output") or "").strip()
        if not output_path:
            raise ValueError("output is required")
        if not (
            output_path.startswith("/workspace/generated/")
            or output_path.startswith("/workspace/exports/")
            or output_path.startswith("/tmp/")
        ):
            raise ValueError(
                "output must be under /workspace/generated, /workspace/exports, or /tmp"
            )

        prompt = str(payload.get("prompt") or "").strip()
        if not prompt:
            lower = instrument.lower()
            if "vocal" in lower or "singing" in lower or "voice" in lower:
                prompt = instrument
            else:
                prompt = INSTRUMENT_PROMPTS.get(
                    instrument, f"{instrument} solo, musical instrument"
                )

        with self._lock:
            self._busy = True
            self._last_error = None
            try:
                model = self._ensure_model(model_name)
                model.set_generation_params(
                    duration=duration,
                    temperature=1.0,
                    top_k=250,
                    top_p=0.0,
                    cfg_coef=3.0,
                    use_sampling=True,
                )

                print(
                    f"Generating {duration}s with {model_name}: {prompt}",
                    flush=True,
                )
                wav = model.generate([prompt], progress=True)
                audio = wav[0].detach().cpu().numpy()

                if audio.ndim == 1:
                    audio = audio.reshape(1, -1)
                elif audio.ndim > 2:
                    audio = np.squeeze(audio)
                    if audio.ndim == 1:
                        audio = audio.reshape(1, -1)

                peak = float(np.max(np.abs(audio)))
                if peak > 0:
                    audio = audio / peak
                audio = (audio * 32767).astype(np.int16).T

                output = Path(output_path)
                output.parent.mkdir(parents=True, exist_ok=True)
                sf.write(str(output), audio, model.sample_rate)

                size = output.stat().st_size
                print(
                    f"Generation complete: {output_path} ({size} bytes)",
                    flush=True,
                )
                return {
                    "ok": True,
                    "model": model_name,
                    "instrument": instrument,
                    "prompt": prompt,
                    "duration": duration,
                    "sampleRate": model.sample_rate,
                    "output": output_path,
                    "size": size,
                }
            except Exception as exc:
                self._last_error = str(exc)
                traceback.print_exc()
                raise
            finally:
                self._busy = False


RUNTIME = MusicGenRuntime()


class Handler(BaseHTTPRequestHandler):
    server_version = "HarmoniaMusicGen/1.0"

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
        print(f"MusicGen provider HTTP: {fmt % args}", flush=True)


def main():
    READY_FILE.unlink(missing_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    READY_FILE.touch()
    print(
        f"Harmonia MusicGen provider listening on {HOST}:{PORT}; model loads lazily",
        flush=True,
    )
    try:
        server.serve_forever()
    finally:
        READY_FILE.unlink(missing_ok=True)
        server.server_close()


if __name__ == "__main__":
    main()
