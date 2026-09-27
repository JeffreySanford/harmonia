#!/usr/bin/env python3
"""Reusable offline DiffRhythm v1.2 Base runtime for Harmonia."""

import gc
import json
import os
import random
import threading
import time
import traceback
import wave
from pathlib import Path

import numpy as np
import torch
import torchaudio
from einops import rearrange
from huggingface_hub import (
    hf_hub_download,
    snapshot_download,
)
from muq import MuQMuLan

from model import CFM, DiT
from infer.infer_utils import (
    CNENTokenizer,
    decode_audio,
    get_lrc_token,
    get_negative_style_prompt,
    get_reference_latent,
    get_style_prompt,
    load_checkpoint,
)


BASE_REPO = "ASLP-lab/DiffRhythm-1_2"
BASE_REV = "185bdeb80541b9260d266c5f041859017441f307"

VAE_REPO = "ASLP-lab/DiffRhythm-vae"
VAE_REV = "74e2afacfd91dd1b96662c96dcef763c1258768b"

MULAN_REPO = "OpenMuQ/MuQ-MuLan-large"
MULAN_REV = "2e01c796b71dca71b45251384c04cd7b237c9020"

MUQ_REPO = "OpenMuQ/MuQ-large-msd-iter"
MUQ_REV = "0562a57814f6f8bbd9fdea0a25921a2fce1a841a"

XLMR_REPO = "FacebookAI/xlm-roberta-base"
XLMR_REV = "e73636d4f797dec63c3081bb6ed5c7b0bb3f2089"

MODEL_ID = "diffrhythm-v12-base"

max_frames = 2048
audio_length = 95

SAMPLE_RATE = 44100
EXPECTED_CHANNELS = 2
DEFAULT_SEED = 1604

QUALIFIED_CACHE_DIR = Path(
    "./pretrained"
).resolve()

CACHE_DIR = (
    "/tmp/harmonia-diffrhythm-hf-cache"
)

CACHE_REPO_ALIASES = {
    BASE_REPO:
        BASE_REPO,
    VAE_REPO:
        VAE_REPO,
    MULAN_REPO:
        MULAN_REPO,
    MUQ_REPO:
        MUQ_REPO,
    XLMR_REPO:
        XLMR_REPO,

    # MuQ-MuLan internally requests this
    # un-namespaced consumer cache key.
    "xlm-roberta-base":
        XLMR_REPO,
}


def require(
    condition,
    message,
):
    if not condition:
        raise RuntimeError(
            message
        )


def repo_cache_name(
    repo_id,
):
    return (
        "models--" +
        repo_id.replace(
            "/",
            "--",
        )
    )


def cuda_sync():
    if torch.cuda.is_available():
        torch.cuda.synchronize()


def clear_cuda():
    gc.collect()

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


def reset_peak():
    cuda_sync()

    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()


def cuda_measurement():
    if not torch.cuda.is_available():
        return {
            "allocatedBytes":
                0,
            "reservedBytes":
                0,
            "maxAllocatedBytes":
                0,
            "maxReservedBytes":
                0,
        }

    cuda_sync()

    return {
        "allocatedBytes":
            int(
                torch.cuda.memory_allocated()
            ),
        "reservedBytes":
            int(
                torch.cuda.memory_reserved()
            ),
        "maxAllocatedBytes":
            int(
                torch.cuda.max_memory_allocated()
            ),
        "maxReservedBytes":
            int(
                torch.cuda.max_memory_reserved()
            ),
    }


def inspect_wav(
    path,
):
    with wave.open(
        str(path),
        "rb",
    ) as wav:
        channels = (
            wav.getnchannels()
        )

        sample_rate = (
            wav.getframerate()
        )

        frames = (
            wav.getnframes()
        )

        sample_width = (
            wav.getsampwidth()
        )

    return {
        "channels":
            int(channels),
        "sampleRate":
            int(sample_rate),
        "frames":
            int(frames),
        "sampleWidthBytes":
            int(sample_width),
        "durationSeconds":
            float(
                frames /
                sample_rate
            ),
        "fileSizeBytes":
            int(
                path.stat().st_size
            ),
    }


class DiffRhythmRuntime:
    """
    Persistent Harmonia DiffRhythm runtime.

    MuQ, CFM and VAE are constructed once and retained in
    CPU memory between requests. Each generation moves only
    the active stage to CUDA, matching the RTX-3080 lifecycle
    qualified by M16-D4.
    """

    def __init__(self):
        self._lock = (
            threading.Lock()
        )

        self._prepared = False
        self._busy = False
        self._last_error = None

        self._model = None

        self._muq = None
        self._cfm = None
        self._vae = None
        self._tokenizer = None

        self._runtime_aliases = []
        self._snapshots = []

    def _offline(self):
        return (
            os.environ.get(
                "HF_HUB_OFFLINE"
            ) == "1"
            and
            os.environ.get(
                "TRANSFORMERS_OFFLINE"
            ) == "1"
        )

    def status(self):
        cuda_available = (
            torch.cuda.is_available()
        )

        gpu = (
            torch.cuda.get_device_name(0)
            if cuda_available
            else None
        )

        allocated = (
            int(
                torch.cuda.memory_allocated()
            )
            if cuda_available
            else 0
        )

        return {
            "ok":
                True,
            "ready":
                self._prepared,
            "busy":
                self._busy,
            "model":
                self._model,
            "provider":
                "diffrhythm",
            "sourceRevision":
                os.environ.get(
                    "HARMONIA_DIFFRHYTHM_REF",
                    "",
                ),
            "cuda":
                cuda_available,
            "gpu":
                gpu,
            "lastError":
                self._last_error,
            "offline":
                self._offline(),
            "residentDevice":
                (
                    "cpu"
                    if self._prepared
                    else None
                ),
            "preparedArtifacts":
                len(
                    self._snapshots
                ),
            "cudaAllocatedBytes":
                allocated,
        }

    def _prepare_runtime_cache(
        self,
    ):
        runtime_cache = Path(
            CACHE_DIR
        )

        runtime_cache.mkdir(
            parents=True,
            exist_ok=True,
        )

        aliases = []

        for (
            requested_repo,
            canonical_repo,
        ) in (
            CACHE_REPO_ALIASES.items()
        ):
            target = (
                QUALIFIED_CACHE_DIR /
                repo_cache_name(
                    canonical_repo
                )
            )

            require(
                target.is_dir(),
                (
                    f"{canonical_repo}: "
                    "qualified cache missing "
                    f"at {target}"
                ),
            )

            alias = (
                runtime_cache /
                repo_cache_name(
                    requested_repo
                )
            )

            if (
                alias.exists()
                or
                alias.is_symlink()
            ):
                if (
                    alias.is_symlink()
                ):
                    alias.unlink()
                else:
                    raise RuntimeError(
                        (
                            "Refusing to replace "
                            f"non-symlink {alias}"
                        )
                    )

            alias.symlink_to(
                target,
                target_is_directory=True,
            )

            aliases.append(
                {
                    "requestedRepo":
                        requested_repo,
                    "canonicalRepo":
                        canonical_repo,
                    "aliasPath":
                        str(alias),
                    "targetPath":
                        str(target),
                }
            )

        return aliases

    def _verify_snapshot(
        self,
        repo_id,
        revision,
    ):
        path = Path(
            snapshot_download(
                repo_id=repo_id,
                revision=revision,
                cache_dir=CACHE_DIR,
                local_files_only=True,
            )
        )

        require(
            path.name == revision,
            (
                f"{repo_id}: expected "
                f"{revision}, got "
                f"{path.name}"
            ),
        )

        return {
            "repoId":
                repo_id,
            "revision":
                revision,
            "path":
                str(path),
        }

    def _load_muq_cpu(
        self,
    ):
        model = (
            MuQMuLan.from_pretrained(
                MULAN_REPO,
                revision=MULAN_REV,
                cache_dir=CACHE_DIR,
                local_files_only=True,
            )
            .to("cpu")
            .eval()
        )

        return model

    def _load_cfm_cpu(
        self,
    ):
        checkpoint_path = (
            hf_hub_download(
                repo_id=BASE_REPO,
                revision=BASE_REV,
                filename="cfm_model.pt",
                cache_dir=CACHE_DIR,
                local_files_only=True,
            )
        )

        config_path = Path(
            "config/diffrhythm-1b.json"
        )

        model_config = (
            json.loads(
                config_path.read_text(
                    encoding="utf-8"
                )
            )
        )

        cfm = CFM(
            transformer=DiT(
                **model_config["model"],
                max_frames=max_frames,
            ),
            num_channels=
                model_config[
                    "model"
                ][
                    "mel_dim"
                ],
            max_frames=max_frames,
        )

        cfm = (
            load_checkpoint(
                cfm,
                checkpoint_path,
                device="cpu",
                use_ema=False,
            )
        )

        return (
            cfm
            .to("cpu")
            .eval()
        )

    def _load_vae_cpu(
        self,
    ):
        checkpoint_path = (
            hf_hub_download(
                repo_id=VAE_REPO,
                revision=VAE_REV,
                filename="vae_model.pt",
                cache_dir=CACHE_DIR,
                local_files_only=True,
            )
        )

        return (
            torch.jit.load(
                checkpoint_path,
                map_location="cpu",
            )
            .to("cpu")
            .eval()
        )

    def prepare(
        self,
    ):
        with self._lock:
            if self._prepared:
                return self.status()

            self._last_error = None

            try:
                require(
                    self._offline(),
                    (
                        "DiffRhythm provider "
                        "requires HF_HUB_OFFLINE=1 "
                        "and TRANSFORMERS_OFFLINE=1"
                    ),
                )

                require(
                    torch.cuda.is_available(),
                    (
                        "DiffRhythm Base requires "
                        "an available CUDA GPU"
                    ),
                )

                self._runtime_aliases = (
                    self._prepare_runtime_cache()
                )

                self._snapshots = [
                    self._verify_snapshot(
                        BASE_REPO,
                        BASE_REV,
                    ),
                    self._verify_snapshot(
                        VAE_REPO,
                        VAE_REV,
                    ),
                    self._verify_snapshot(
                        MULAN_REPO,
                        MULAN_REV,
                    ),
                    self._verify_snapshot(
                        MUQ_REPO,
                        MUQ_REV,
                    ),
                    self._verify_snapshot(
                        XLMR_REPO,
                        XLMR_REV,
                    ),
                ]

                print(
                    (
                        "Preparing reusable "
                        "DiffRhythm MuQ on CPU"
                    ),
                    flush=True,
                )

                self._muq = (
                    self._load_muq_cpu()
                )

                print(
                    (
                        "Preparing reusable "
                        "DiffRhythm CFM on CPU"
                    ),
                    flush=True,
                )

                self._cfm = (
                    self._load_cfm_cpu()
                )

                print(
                    (
                        "Preparing reusable "
                        "DiffRhythm VAE on CPU"
                    ),
                    flush=True,
                )

                self._vae = (
                    self._load_vae_cpu()
                )

                self._tokenizer = (
                    CNENTokenizer()
                )

                clear_cuda()

                self._model = (
                    MODEL_ID
                )

                self._prepared = True

                print(
                    (
                        "DiffRhythm reusable "
                        "CPU runtime prepared"
                    ),
                    flush=True,
                )

                return self.status()

            except Exception as error:
                self._last_error = (
                    str(error)
                )

                traceback.print_exc()

                raise

    def _validate_output(
        self,
        value,
    ):
        output_path = str(
            value or ""
        ).strip()

        if not output_path:
            raise ValueError(
                "output is required"
            )

        allowed = (
            output_path.startswith(
                "/workspace/generated/"
            )
            or
            output_path.startswith(
                "/workspace/exports/"
            )
            or
            output_path.startswith(
                "/tmp/"
            )
        )

        if not allowed:
            raise ValueError(
                (
                    "output must be under "
                    "/workspace/generated, "
                    "/workspace/exports, "
                    "or /tmp"
                )
            )

        return Path(
            output_path
        )

    def _return_models_to_cpu(
        self,
    ):
        for attribute in (
            "_muq",
            "_cfm",
            "_vae",
        ):
            model = getattr(
                self,
                attribute,
            )

            if model is None:
                continue

            try:
                model = model.to(
                    "cpu"
                )

                setattr(
                    self,
                    attribute,
                    model,
                )

            except Exception:
                traceback.print_exc()

        clear_cuda()

    def generate(
        self,
        payload,
    ):
        model_id = str(
            payload.get(
                "model",
                MODEL_ID,
            )
            or MODEL_ID
        ).strip()

        if model_id != MODEL_ID:
            raise ValueError(
                (
                    "unsupported DiffRhythm "
                    f"model: {model_id}"
                )
            )

        prompt = str(
            payload.get(
                "prompt"
            )
            or ""
        ).strip()

        if not prompt:
            raise ValueError(
                "prompt is required"
            )

        lyrics = str(
            payload.get(
                "lyrics"
            )
            or ""
        ).strip()

        if not lyrics:
            raise ValueError(
                "lyrics is required"
            )

        requested_duration = int(
            payload.get(
                "duration",
                audio_length,
            )
        )

        if (
            requested_duration !=
            audio_length
        ):
            raise ValueError(
                (
                    "DiffRhythm v1.2 Base "
                    "currently requires "
                    "duration=95"
                )
            )

        output_path = (
            self._validate_output(
                payload.get(
                    "output"
                )
            )
        )

        seed = int(
            payload.get(
                "seed",
                DEFAULT_SEED,
            )
        )

        with self._lock:
            self._busy = True
            self._last_error = None

            try:
                if not self._prepared:
                    self.prepare()

                output_path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                output_path.unlink(
                    missing_ok=True
                )

                random.seed(seed)
                np.random.seed(seed)
                torch.manual_seed(seed)
                torch.cuda.manual_seed_all(
                    seed
                )

                clear_cuda()

                generation_started = (
                    time.monotonic()
                )

                #
                # Stage 1:
                # MuQ -> CUDA -> style -> CPU.
                #
                self._muq = (
                    self._muq
                    .to("cuda")
                    .eval()
                )

                style_prompt = (
                    get_style_prompt(
                        self._muq,
                        prompt=prompt,
                    )
                    .cpu()
                )

                require(
                    list(
                        style_prompt.shape
                    ) == [1, 512],
                    (
                        "unexpected style "
                        "prompt shape "
                        f"{list(style_prompt.shape)}"
                    ),
                )

                self._muq = (
                    self._muq.to(
                        "cpu"
                    )
                )

                clear_cuda()

                #
                # Stage 2:
                # CFM -> CUDA -> latent -> CPU.
                #
                self._cfm = (
                    self._cfm
                    .to("cuda")
                    .eval()
                )

                (
                    lrc_prompt,
                    start_time,
                    end_frame,
                    song_duration,
                ) = get_lrc_token(
                    max_frames,
                    lyrics,
                    self._tokenizer,
                    audio_length,
                    "cuda",
                )

                require(
                    end_frame ==
                        max_frames,
                    (
                        "expected "
                        f"{max_frames} frames, "
                        f"got {end_frame}"
                    ),
                )

                negative_style_prompt = (
                    get_negative_style_prompt(
                        "cuda"
                    )
                )

                (
                    latent_prompt,
                    pred_frames,
                ) = get_reference_latent(
                    "cuda",
                    max_frames,
                    False,
                    None,
                    None,
                    None,
                )

                style_prompt = (
                    style_prompt.to(
                        "cuda"
                    )
                )

                clear_cuda()
                reset_peak()

                diffusion_started = (
                    time.monotonic()
                )

                (
                    generated_latents,
                    trajectory,
                ) = self._cfm.sample(
                    cond=latent_prompt,
                    text=lrc_prompt,
                    duration=end_frame,
                    style_prompt=
                        style_prompt,
                    negative_style_prompt=
                        negative_style_prompt,
                    steps=32,
                    cfg_strength=4.0,
                    start_time=start_time,
                    latent_pred_segments=
                        pred_frames,
                    batch_infer_num=1,
                    song_duration=
                        song_duration,
                    seed=seed,
                )

                cuda_sync()

                diffusion_seconds = (
                    time.monotonic() -
                    diffusion_started
                )

                diffusion_vram = (
                    cuda_measurement()
                )

                require(
                    len(
                        generated_latents
                    ) == 1,
                    (
                        "expected one generated "
                        "latent batch"
                    ),
                )

                latent_cpu = (
                    generated_latents[0]
                    .to(torch.float32)
                    .transpose(1, 2)
                    .contiguous()
                    .cpu()
                )

                require(
                    latent_cpu.shape[-1] ==
                        max_frames,
                    (
                        "unexpected latent "
                        "frame count "
                        f"{latent_cpu.shape[-1]}"
                    ),
                )

                del generated_latents
                del trajectory
                del style_prompt
                del negative_style_prompt
                del latent_prompt
                del lrc_prompt
                del start_time
                del song_duration

                self._cfm = (
                    self._cfm.to(
                        "cpu"
                    )
                )

                clear_cuda()

                #
                # Stage 3:
                # VAE -> CUDA -> inference-mode
                # chunk-128 decode -> CPU.
                #
                self._vae = (
                    self._vae
                    .to("cuda")
                    .eval()
                )

                latent_cuda = (
                    latent_cpu.to(
                        "cuda"
                    )
                )

                clear_cuda()
                reset_peak()

                decode_started = (
                    time.monotonic()
                )

                with torch.inference_mode():
                    decoded = decode_audio(
                        latent_cuda,
                        self._vae,
                        chunked=True,
                        overlap=32,
                        chunk_size=128,
                    )

                cuda_sync()

                decode_seconds = (
                    time.monotonic() -
                    decode_started
                )

                decode_vram = (
                    cuda_measurement()
                )

                del latent_cuda

                require(
                    decoded.ndim == 3,
                    (
                        "unexpected decoded "
                        f"rank {decoded.ndim}"
                    ),
                )

                require(
                    decoded.shape[1] ==
                        EXPECTED_CHANNELS,
                    (
                        "expected stereo "
                        "decoded audio"
                    ),
                )

                generated_song = (
                    rearrange(
                        decoded,
                        "b d n -> d (b n)",
                    )
                    .to(torch.float32)
                )

                absolute_peak = (
                    torch.max(
                        torch.abs(
                            generated_song
                        )
                    )
                )

                require(
                    torch.isfinite(
                        absolute_peak
                    ).item(),
                    (
                        "generated audio "
                        "peak is not finite"
                    ),
                )

                require(
                    absolute_peak.item() >
                        1e-8,
                    (
                        "generated audio "
                        "is effectively silent"
                    ),
                )

                generated_song = (
                    generated_song
                    .div(
                        absolute_peak
                    )
                    .clamp(
                        -1,
                        1,
                    )
                    .mul(
                        32767
                    )
                    .to(
                        torch.int16
                    )
                    .cpu()
                )

                torchaudio.save(
                    str(
                        output_path
                    ),
                    generated_song,
                    sample_rate=44100,
                )

                require(
                    output_path.is_file(),
                    (
                        "DiffRhythm output "
                        "was not created"
                    ),
                )

                wav = inspect_wav(
                    output_path
                )

                require(
                    wav[
                        "channels"
                    ] ==
                        EXPECTED_CHANNELS,
                    "output is not stereo",
                )

                require(
                    wav[
                        "sampleRate"
                    ] ==
                        SAMPLE_RATE,
                    (
                        "output sample rate "
                        "is not 44100"
                    ),
                )

                require(
                    wav[
                        "sampleWidthBytes"
                    ] == 2,
                    (
                        "output is not "
                        "16-bit PCM"
                    ),
                )

                require(
                    94.5 <=
                    wav[
                        "durationSeconds"
                    ] <=
                    95.5,
                    (
                        "unexpected output "
                        "duration"
                    ),
                )

                self._vae = (
                    self._vae.to(
                        "cpu"
                    )
                )

                del decoded
                del generated_song
                del latent_cpu

                clear_cuda()

                total_seconds = (
                    time.monotonic() -
                    generation_started
                )

                result = {
                    "ok":
                        True,
                    "provider":
                        "diffrhythm",
                    "model":
                        MODEL_ID,
                    "prompt":
                        prompt,
                    "lyrics":
                        lyrics,
                    "seed":
                        seed,
                    "duration":
                        audio_length,
                    "steps":
                        32,
                    "cfgStrength":
                        4.0,
                    "sampleRate":
                        wav[
                            "sampleRate"
                        ],
                    "channels":
                        wav[
                            "channels"
                        ],
                    "output":
                        str(
                            output_path
                        ),
                    "size":
                        wav[
                            "fileSizeBytes"
                        ],
                    "durationSeconds":
                        wav[
                            "durationSeconds"
                        ],
                    "timing": {
                        "diffusionSeconds":
                            diffusion_seconds,
                        "decodeSeconds":
                            decode_seconds,
                        "totalSeconds":
                            total_seconds,
                    },
                    "vram": {
                        "diffusion":
                            diffusion_vram,
                        "decode":
                            decode_vram,
                    },
                }

                return result

            except Exception as error:
                self._last_error = (
                    str(error)
                )

                traceback.print_exc()

                raise

            finally:
                self._return_models_to_cpu()

                self._busy = False
