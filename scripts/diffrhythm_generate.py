#!/usr/bin/env python3
"""Harmonia DiffRhythm v1.2 Base real-generation qualification."""

import argparse
import gc
import json
import math
import os
import random
import time
import wave
from pathlib import Path

import numpy as np
import torch
import torchaudio
from einops import rearrange
from huggingface_hub import hf_hub_download, snapshot_download
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

QUALIFIED_CACHE_DIR = Path(
    "./pretrained"
).resolve()

CACHE_DIR = "/tmp/harmonia-diffrhythm-hf-cache"

CACHE_REPO_ALIASES = {
    BASE_REPO: BASE_REPO,
    VAE_REPO: VAE_REPO,
    MULAN_REPO: MULAN_REPO,
    MUQ_REPO: MUQ_REPO,
    XLMR_REPO: XLMR_REPO,

    # MuQ-MuLan's config uses this un-namespaced consumer key.
    "xlm-roberta-base": XLMR_REPO,
}

max_frames = 2048
audio_length = 95

SAMPLE_RATE = 44100
EXPECTED_CHANNELS = 2
SEED = 1604

# Upstream chunked decode defaults to 128 latent frames.
# Harmonia first preserves that exact path, then retries with
# a smaller chunk only if the RTX 3080 reports a decode OOM.
DECODE_CHUNK_SIZES = (128, 64)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def repo_cache_name(repo_id):
    return (
        "models--" +
        repo_id.replace("/", "--")
    )


def prepare_runtime_cache():
    runtime_cache = Path(
        CACHE_DIR
    )

    runtime_cache.mkdir(
        parents=True,
        exist_ok=True,
    )

    aliases = []

    for requested_repo, canonical_repo in CACHE_REPO_ALIASES.items():
        target = (
            QUALIFIED_CACHE_DIR /
            repo_cache_name(
                canonical_repo
            )
        )

        require(
            target.is_dir(),
            (
                f"{canonical_repo}: qualified "
                f"cache missing at {target}"
            ),
        )

        alias = (
            runtime_cache /
            repo_cache_name(
                requested_repo
            )
        )

        if (
            alias.exists() or
            alias.is_symlink()
        ):
            if alias.is_symlink():
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


def verify_snapshot(
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
            f"{revision}, got {path.name}"
        ),
    )

    return str(path)


def cuda_sync():
    torch.cuda.synchronize()


def clear_cuda():
    gc.collect()
    torch.cuda.empty_cache()
    cuda_sync()


def reset_peak():
    cuda_sync()
    torch.cuda.reset_peak_memory_stats()


def cuda_measurement():
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


def load_muq():
    return (
        MuQMuLan.from_pretrained(
            MULAN_REPO,
            revision=MULAN_REV,
            cache_dir=CACHE_DIR,
            local_files_only=True,
        )
        .to("cuda")
        .eval()
    )


def load_cfm():
    checkpoint_path = hf_hub_download(
        repo_id=BASE_REPO,
        revision=BASE_REV,
        filename="cfm_model.pt",
        cache_dir=CACHE_DIR,
        local_files_only=True,
    )

    config_path = Path(
        "config/diffrhythm-1b.json"
    )

    model_config = json.loads(
        config_path.read_text(
            encoding="utf-8"
        )
    )

    cfm = CFM(
        transformer=DiT(
            **model_config["model"],
            max_frames=max_frames,
        ),
        num_channels=
            model_config["model"]["mel_dim"],
        max_frames=max_frames,
    )

    cfm = cfm.to("cuda")

    cfm = load_checkpoint(
        cfm,
        checkpoint_path,
        device="cuda",
        use_ema=False,
    )

    return cfm.eval()


def load_vae():
    checkpoint_path = hf_hub_download(
        repo_id=VAE_REPO,
        revision=VAE_REV,
        filename="vae_model.pt",
        cache_dir=CACHE_DIR,
        local_files_only=True,
    )

    return (
        torch.jit.load(
            checkpoint_path,
            map_location="cpu",
        )
        .to("cuda")
        .eval()
    )


def inspect_wav(path):
    with wave.open(
        str(path),
        "rb",
    ) as wav:
        channels = wav.getnchannels()
        sample_rate = wav.getframerate()
        frames = wav.getnframes()
        sample_width = wav.getsampwidth()

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


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--output",
        default=(
            "/workspace/generated/"
            "diffrhythm/m16-d4/output.wav"
        ),
    )

    parser.add_argument(
        "--evidence",
        default=(
            "/workspace/generated/"
            "diffrhythm/m16-d4/generation.json"
        ),
    )

    return parser.parse_args()


def main():
    args = parse_args()

    require(
        os.environ.get(
            "HF_HUB_OFFLINE"
        ) == "1",
        "HF_HUB_OFFLINE must equal 1",
    )

    require(
        os.environ.get(
            "TRANSFORMERS_OFFLINE"
        ) == "1",
        "TRANSFORMERS_OFFLINE must equal 1",
    )

    require(
        torch.cuda.is_available(),
        "CUDA is unavailable",
    )

    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)

    runtime_aliases = (
        prepare_runtime_cache()
    )

    snapshots = [
        {
            "repoId":
                BASE_REPO,
            "revision":
                BASE_REV,
            "path":
                verify_snapshot(
                    BASE_REPO,
                    BASE_REV,
                ),
        },
        {
            "repoId":
                VAE_REPO,
            "revision":
                VAE_REV,
            "path":
                verify_snapshot(
                    VAE_REPO,
                    VAE_REV,
                ),
        },
        {
            "repoId":
                MULAN_REPO,
            "revision":
                MULAN_REV,
            "path":
                verify_snapshot(
                    MULAN_REPO,
                    MULAN_REV,
                ),
        },
        {
            "repoId":
                MUQ_REPO,
            "revision":
                MUQ_REV,
            "path":
                verify_snapshot(
                    MUQ_REPO,
                    MUQ_REV,
                ),
        },
        {
            "repoId":
                XLMR_REPO,
            "revision":
                XLMR_REV,
            "path":
                verify_snapshot(
                    XLMR_REPO,
                    XLMR_REV,
                ),
        },
    ]

    output_path = Path(
        args.output
    )

    evidence_path = Path(
        args.evidence
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    evidence_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path.unlink(
        missing_ok=True
    )

    evidence_path.unlink(
        missing_ok=True
    )

    clear_cuda()

    baseline = cuda_measurement()

    #
    # 1. MuQ-MuLan style conditioning.
    #
    reset_peak()

    muq = load_muq()

    style_text = (
        "cinematic electronic rock, "
        "driving drums, wide stereo image, "
        "bright synthesizers, energetic and expansive"
    )

    style_prompt = (
        get_style_prompt(
            muq,
            prompt=style_text,
        )
        .cpu()
    )

    require(
        list(
            style_prompt.shape
        ) == [1, 512],
        (
            "Unexpected style prompt shape "
            f"{list(style_prompt.shape)}"
        ),
    )

    style_vram = cuda_measurement()

    #
    # MuQ must not remain resident during diffusion.
    #
    muq = muq.to("cpu")
    del muq

    gc.collect()
    torch.cuda.empty_cache()
    cuda_sync()

    after_muq_release = (
        cuda_measurement()
    )

    #
    # 2. Load only the real Base CFM for diffusion.
    #
    # D3 proved both CFM and VAE can coexist, but the first
    # real generation showed that VAE decode activation memory
    # is the actual RTX 3080 constraint. Keep the decode stage
    # isolated from CFM residency.
    #
    reset_peak()

    cfm = load_cfm()

    cfm_resident_vram = (
        cuda_measurement()
    )

    #
    # 3. Real lyric/token conditioning.
    #
    tokenizer = CNENTokenizer()

    lrc_text = (
        "[00:00.00] Northern signal crossing the open sky\n"
        "[00:48.00] Prairie lights carry the rhythm home"
    )

    (
        lrc_prompt,
        start_time,
        end_frame,
        song_duration,
    ) = get_lrc_token(
        max_frames,
        lrc_text,
        tokenizer,
        audio_length,
        "cuda",
    )

    require(
        end_frame == max_frames,
        (
            f"Expected {max_frames} frames, "
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

    #
    # 4. Real 32-step DiffRhythm diffusion.
    #
    clear_cuda()
    reset_peak()

    diffusion_started = (
        time.monotonic()
    )

    (
        generated_latents,
        trajectory,
    ) = cfm.sample(
        cond=latent_prompt,
        text=lrc_prompt,
        duration=end_frame,
        style_prompt=style_prompt,
        negative_style_prompt=
            negative_style_prompt,
        steps=32,
        cfg_strength=4.0,
        start_time=start_time,
        latent_pred_segments=
            pred_frames,
        batch_infer_num=1,
        song_duration=song_duration,
        seed=SEED,
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
            "Expected one generated latent "
            f"batch, got {len(generated_latents)}"
        ),
    )

    #
    # Preserve the completed diffusion result on CPU before
    # touching the VAE. This gives us a durable decode recovery
    # boundary and lets CFM leave CUDA completely.
    #
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
            "Unexpected latent frame count "
            f"{latent_cpu.shape[-1]}"
        ),
    )

    latent_checkpoint_path = (
        output_path.with_name(
            "latent.pt"
        )
    )

    torch.save(
        {
            "model":
                "diffrhythm-v12-base",
            "sourceRevision":
                os.environ.get(
                    "HARMONIA_DIFFRHYTHM_REF"
                ),
            "seed":
                SEED,
            "maxFrames":
                max_frames,
            "latent":
                latent_cpu,
        },
        latent_checkpoint_path,
    )

    require(
        latent_checkpoint_path.is_file(),
        "latent.pt was not retained",
    )

    #
    # CFM diffusion is complete. Release every diffusion-side
    # CUDA tensor before loading the VAE.
    #
    del generated_latents
    del trajectory

    del style_prompt
    del negative_style_prompt
    del latent_prompt
    del lrc_prompt
    del start_time
    del song_duration

    cfm = cfm.to("cpu")
    del cfm

    gc.collect()
    torch.cuda.empty_cache()
    cuda_sync()

    after_cfm_release_vram = (
        cuda_measurement()
    )

    #
    # 5. Load the real TorchScript VAE only after CFM has left
    # CUDA. D3 measured VAE-alone residency at ~607 MiB.
    #
    reset_peak()

    vae = load_vae()

    vae_resident_vram = (
        cuda_measurement()
    )

    #
    # Try upstream's default chunk_size=128 first.
    # If decode_export OOMs, clean CUDA and retry at 64.
    #
    decoded = None
    decode_vram = None
    decode_seconds = None
    decode_chunk_size = None
    decode_attempts = []

    for candidate_chunk_size in DECODE_CHUNK_SIZES:
        latent_cuda = None

        try:
            clear_cuda()
            reset_peak()

            latent_cuda = (
                latent_cpu
                .to(
                    "cuda",
                    non_blocking=False,
                )
            )

            decode_started = (
                time.monotonic()
            )

            with torch.inference_mode():
                decoded = decode_audio(
                    latent_cuda,
                    vae,
                    chunked=True,
                    overlap=32,
                    chunk_size=
                        candidate_chunk_size,
                )

            cuda_sync()

            decode_seconds = (
                time.monotonic() -
                decode_started
            )

            decode_vram = (
                cuda_measurement()
            )

            decode_chunk_size = (
                candidate_chunk_size
            )

            decode_attempts.append(
                {
                    "chunkSize":
                        candidate_chunk_size,
                    "status":
                        "ok",
                    "maxAllocatedBytes":
                        decode_vram[
                            "maxAllocatedBytes"
                        ],
                    "maxReservedBytes":
                        decode_vram[
                            "maxReservedBytes"
                        ],
                }
            )

            break

        except RuntimeError as error:
            message = str(error)

            if (
                "out of memory"
                not in message.lower()
            ):
                raise

            decode_attempts.append(
                {
                    "chunkSize":
                        candidate_chunk_size,
                    "status":
                        "oom",
                    "error":
                        message,
                }
            )

            if latent_cuda is not None:
                del latent_cuda

            if decoded is not None:
                del decoded
                decoded = None

            gc.collect()
            torch.cuda.empty_cache()
            cuda_sync()

            if (
                candidate_chunk_size ==
                DECODE_CHUNK_SIZES[-1]
            ):
                raise

    require(
        decoded is not None,
        "VAE decode produced no audio",
    )

    require(
        decode_chunk_size in
            DECODE_CHUNK_SIZES,
        "No successful decode chunk size",
    )

    if latent_cuda is not None:
        del latent_cuda

    require(
        decoded.ndim == 3,
        (
            "Expected decoded tensor rank 3, "
            f"got {decoded.ndim}"
        ),
    )

    require(
        decoded.shape[1] ==
            EXPECTED_CHANNELS,
        (
            "Expected stereo decode, got "
            f"{decoded.shape[1]} channels"
        ),
    )

    #
    # Match pinned upstream output normalization.
    #
    generated_song = rearrange(
        decoded,
        "b d n -> d (b n)",
    )

    generated_song = (
        generated_song
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
        "Generated audio peak is not finite",
    )

    require(
        absolute_peak.item() >
            1e-8,
        "Generated audio is effectively silent",
    )

    generated_song = (
        generated_song
        .div(
            absolute_peak
        )
        .clamp(-1, 1)
        .mul(32767)
        .to(torch.int16)
        .cpu()
    )

    decoded_samples = int(
        generated_song.shape[-1]
    )

    require(
        generated_song.shape[0] ==
            EXPECTED_CHANNELS,
        "Final output is not stereo",
    )

    #
    # 6. Persist real WAV.
    #
    torchaudio.save(
        str(output_path),
        generated_song,
        sample_rate=44100,
    )

    require(
        output_path.is_file(),
        "output.wav was not created",
    )

    wav = inspect_wav(
        output_path
    )

    require(
        wav["channels"] ==
            EXPECTED_CHANNELS,
        (
            "output.wav channels="
            f'{wav["channels"]}'
        ),
    )

    require(
        wav["sampleRate"] ==
            SAMPLE_RATE,
        (
            "output.wav sampleRate="
            f'{wav["sampleRate"]}'
        ),
    )

    require(
        wav["sampleWidthBytes"] == 2,
        (
            "Expected 16-bit PCM WAV, "
            f'width={wav["sampleWidthBytes"]}'
        ),
    )

    require(
        94.5 <=
        wav["durationSeconds"] <=
        95.5,
        (
            "Unexpected durationSeconds="
            f'{wav["durationSeconds"]}'
        ),
    )

    require(
        wav["fileSizeBytes"] >
            1_000_000,
        (
            "WAV is unexpectedly small: "
            f'{wav["fileSizeBytes"]}'
        ),
    )

    #
    # 7. Release remaining decode-side residency.
    #
    # Diffusion-side tensors and CFM were already released at
    # the CPU latent boundary above. Do not delete them twice.
    #
    del decoded
    del generated_song
    del latent_cpu

    try:
        vae = vae.to("cpu")
    except Exception:
        pass

    del vae

    gc.collect()
    torch.cuda.empty_cache()
    cuda_sync()

    released_vram = (
        cuda_measurement()
    )

    result = {
        "ok":
            True,
        "qualificationComplete":
            True,
        "provider":
            "diffrhythm",
        "model":
            "diffrhythm-v12-base",
        "sourceRevision":
            os.environ.get(
                "HARMONIA_DIFFRHYTHM_REF"
            ),
        "seed":
            SEED,
        "audioLengthRequestedSeconds":
            audio_length,
        "maxFrames":
            max_frames,
        "steps":
            32,
        "cfgStrength":
            4.0,
        "chunkedDecode":
            True,
        "decodeInferenceMode":
            True,
        "decodeChunkSize":
            decode_chunk_size,
        "decodeAttempts":
            decode_attempts,
        "latentCheckpoint": {
            "path":
                str(latent_checkpoint_path),
            "fileSizeBytes":
                int(
                    latent_checkpoint_path.stat().st_size
                ),
        },
        "stylePrompt": {
            "text":
                style_text,
            "shape":
                [1, 512],
        },
        "lyrics": {
            "fixture":
                lrc_text,
            "endFrame":
                end_frame,
        },
        "output": {
            "path":
                str(output_path),
            "sampleRate":
                wav["sampleRate"],
            "channels":
                wav["channels"],
            "frames":
                wav["frames"],
            "durationSeconds":
                wav["durationSeconds"],
            "fileSizeBytes":
                wav["fileSizeBytes"],
            "sampleWidthBytes":
                wav["sampleWidthBytes"],
            "decodedSamples":
                decoded_samples,
        },
        "timing": {
            "diffusionSeconds":
                diffusion_seconds,
            "decodeSeconds":
                decode_seconds,
            "totalInferenceSeconds":
                (
                    diffusion_seconds +
                    decode_seconds
                ),
        },
        "vram": {
            "baseline":
                baseline,
            "styleConditioning":
                style_vram,
            "afterMuqRelease":
                after_muq_release,
            "cfmResident":
                cfm_resident_vram,
            "diffusion":
                diffusion_vram,
            "afterCfmRelease":
                after_cfm_release_vram,
            "vaeResident":
                vae_resident_vram,
            "chunkedDecode":
                decode_vram,
            "released":
                released_vram,
        },
        "runtimeAliases":
            runtime_aliases,
        "snapshots":
            snapshots,
    }

    evidence_path.write_text(
        json.dumps(
            result,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            result,
            separators=(",", ":"),
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
