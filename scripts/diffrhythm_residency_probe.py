#!/usr/bin/env python3
"""DiffRhythm v1.2 staged CUDA residency qualification.

No audio is generated here.

Stages:
  baseline
  MuQ-MuLan load
  real text style embedding
  MuQ release
  95-second Base CFM load
  CFM + VAE combined attempt
  VAE-alone residency
  final release
"""

import gc
import json
import os
from pathlib import Path

import torch
from huggingface_hub import hf_hub_download, snapshot_download
from muq import MuQMuLan

from model import CFM, DiT
from infer.infer_utils import (
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

QUALIFIED_CACHE_DIR = Path("./pretrained").resolve()

# MuQ-MuLan's published config refers to its XLM-R tower as
# "xlm-roberta-base", while Harmonia registers the canonical
# immutable repository as FacebookAI/xlm-roberta-base.
#
# Keep the qualified registry cache read-only. Build a tiny writable
# Hugging Face cache namespace in /tmp whose repository directories
# are symlinks into the qualified cache.
CACHE_DIR = "/tmp/harmonia-diffrhythm-hf-cache"

CACHE_REPO_ALIASES = {
    BASE_REPO: BASE_REPO,
    VAE_REPO: VAE_REPO,
    MULAN_REPO: MULAN_REPO,
    MUQ_REPO: MUQ_REPO,
    XLMR_REPO: XLMR_REPO,

    # Exact consumer key embedded in MuQ-MuLan config.json.
    "xlm-roberta-base": XLMR_REPO,
}

max_frames = 2048

device = "cuda"

stages = []


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def synchronize():
    torch.cuda.synchronize()


def reset_peak():
    synchronize()
    torch.cuda.reset_peak_memory_stats()


def memory(stage, status="ok", detail=None):
    synchronize()

    row = {
        "stage": stage,
        "status": status,
        "allocatedBytes": int(
            torch.cuda.memory_allocated()
        ),
        "reservedBytes": int(
            torch.cuda.memory_reserved()
        ),
        "maxAllocatedBytes": int(
            torch.cuda.max_memory_allocated()
        ),
        "maxReservedBytes": int(
            torch.cuda.max_memory_reserved()
        ),
    }

    if detail is not None:
        row["detail"] = detail

    stages.append(row)

    print(
        json.dumps(
            {
                "event": "stage",
                **row,
            },
            separators=(",", ":"),
        ),
        flush=True,
    )

    return row


def clear_cuda():
    gc.collect()
    torch.cuda.empty_cache()
    synchronize()


def repo_cache_name(repo_id):
    return "models--" + repo_id.replace("/", "--")


def prepare_runtime_cache():
    runtime_cache = Path(CACHE_DIR)

    runtime_cache.mkdir(
        parents=True,
        exist_ok=True,
    )

    aliases = []

    for requested_repo, canonical_repo in CACHE_REPO_ALIASES.items():
        canonical_path = (
            QUALIFIED_CACHE_DIR /
            repo_cache_name(canonical_repo)
        )

        require(
            canonical_path.is_dir(),
            (
                f"{canonical_repo}: qualified cache "
                f"directory missing at {canonical_path}"
            ),
        )

        alias_path = (
            runtime_cache /
            repo_cache_name(requested_repo)
        )

        if (
            alias_path.exists() or
            alias_path.is_symlink()
        ):
            if alias_path.is_symlink():
                alias_path.unlink()
            else:
                raise RuntimeError(
                    (
                        "Refusing to replace non-symlink "
                        f"runtime cache path {alias_path}"
                    )
                )

        alias_path.symlink_to(
            canonical_path,
            target_is_directory=True,
        )

        aliases.append(
            {
                "requestedRepo":
                    requested_repo,
                "canonicalRepo":
                    canonical_repo,
                "aliasPath":
                    str(alias_path),
                "targetPath":
                    str(canonical_path),
            }
        )

    return {
        "path":
            str(runtime_cache),
        "qualifiedCache":
            str(QUALIFIED_CACHE_DIR),
        "aliases":
            aliases,
    }


def local_snapshot(repo_id, revision):
    return Path(
        snapshot_download(
            repo_id=repo_id,
            revision=revision,
            cache_dir=CACHE_DIR,
            local_files_only=True,
        )
    )


def verify_local_snapshots():
    expected = [
        (BASE_REPO, BASE_REV),
        (VAE_REPO, VAE_REV),
        (MULAN_REPO, MULAN_REV),
        (MUQ_REPO, MUQ_REV),
        (XLMR_REPO, XLMR_REV),
    ]

    result = []

    for repo_id, revision in expected:
        path = local_snapshot(
            repo_id,
            revision,
        )

        require(
            path.name == revision,
            (
                f"{repo_id}: expected pinned snapshot "
                f"{revision}, got {path.name}"
            ),
        )

        result.append(
            {
                "repoId": repo_id,
                "revision": revision,
                "path": str(path),
            }
        )

    return result


def load_muq():
    return (
        MuQMuLan.from_pretrained(
            MULAN_REPO,
            revision=MULAN_REV,
            cache_dir=CACHE_DIR,
            local_files_only=True,
        )
        .to(device)
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

    # Mirror pinned upstream ordering.
    cfm = cfm.to(device)

    cfm = load_checkpoint(
        cfm,
        checkpoint_path,
        device=device,
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

    vae = torch.jit.load(
        checkpoint_path,
        map_location="cpu",
    ).to(device)

    return vae.eval()


def release_module(module):
    if module is None:
        return

    try:
        module.to("cpu")
    except Exception:
        pass

    del module

    gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.synchronize()


def main():
    require(
        os.environ.get("HF_HUB_OFFLINE") == "1",
        "HF_HUB_OFFLINE must equal 1",
    )

    require(
        os.environ.get("TRANSFORMERS_OFFLINE") == "1",
        "TRANSFORMERS_OFFLINE must equal 1",
    )

    require(
        torch.cuda.is_available(),
        "CUDA is unavailable",
    )

    runtime_cache = prepare_runtime_cache()

    snapshots = verify_local_snapshots()

    gpu_name = torch.cuda.get_device_name(0)

    total_memory = int(
        torch.cuda.get_device_properties(
            0
        ).total_memory
    )

    clear_cuda()

    reset_peak()
    memory(
        "baseline"
    )

    #
    # Stage 1: real MuQ-MuLan residency.
    #
    reset_peak()

    try:
        muq = load_muq()
        memory(
            "muq-loaded"
        )
    except torch.cuda.OutOfMemoryError as error:
        clear_cuda()

        memory(
            "muq-loaded",
            status="oom",
            detail=str(error),
        )

        raise

    #
    # Stage 2: exercise the actual text-style path.
    #
    reset_peak()

    style_text = (
        "cinematic electronic music, "
        "wide stereo image, energetic drums"
    )

    style_prompt = get_style_prompt(muq, prompt=style_text).cpu()

    memory(
        "style-embedded",
        detail={
            "shape":
                list(style_prompt.shape),
            "dtype":
                str(style_prompt.dtype),
            "device":
                str(style_prompt.device),
        },
    )

    require(
        style_prompt.numel() > 0,
        "style embedding is empty",
    )

    require(
        str(style_prompt.device) == "cpu",
        "style embedding must survive on CPU",
    )

    #
    # Stage 3: evict MuQ before diffusion.
    #
    reset_peak()

    muq = muq.to("cpu")
    del muq
    gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.synchronize()

    memory(
        "muq-released"
    )

    #
    # Stage 4: real 95-second Base CFM.
    #
    cfm = None
    cfm_status = "not-run"

    reset_peak()

    try:
        cfm = load_cfm()

        memory(
            "cfm-loaded"
        )

        cfm_status = "ok"

    except torch.cuda.OutOfMemoryError as error:
        cfm_status = "oom"

        clear_cuda()

        memory(
            "cfm-loaded",
            status="oom",
            detail=str(error),
        )

    #
    # Stage 5: diagnostic CFM + VAE combination.
    #
    vae = None
    combined_status = "not-run"

    if cfm_status == "ok":
        reset_peak()

        try:
            vae = load_vae()

            memory(
                "cfm-plus-vae-loaded"
            )

            combined_status = "ok"

        except torch.cuda.OutOfMemoryError as error:
            combined_status = "oom"

            clear_cuda()

            memory(
                "cfm-plus-vae-loaded",
                status="oom",
                detail=str(error),
            )

    else:
        memory(
            "cfm-plus-vae-loaded",
            status="skipped",
            detail="CFM did not fit",
        )

    #
    # Stage 6: establish whether VAE fits after
    # CFM has left CUDA. This is the critical
    # sequential-generation capability.
    #
    if cfm is not None:
        try:
            cfm.to("cpu")
        except Exception:
            pass

        del cfm
        cfm = None

    gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.synchronize()

    vae_alone_status = "not-run"

    if vae is not None:
        reset_peak()

        memory(
            "vae-alone-loaded"
        )

        vae_alone_status = "ok"

    else:
        clear_cuda()
        reset_peak()

        try:
            vae = load_vae()

            memory(
                "vae-alone-loaded"
            )

            vae_alone_status = "ok"

        except torch.cuda.OutOfMemoryError as error:
            vae_alone_status = "oom"

            clear_cuda()

            memory(
                "vae-alone-loaded",
                status="oom",
                detail=str(error),
            )

    #
    # Stage 7: final release.
    #
    if vae is not None:
        try:
            vae.to("cpu")
        except Exception:
            pass

        del vae
        vae = None

    del style_prompt

    gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.synchronize()

    reset_peak()

    memory(
        "released"
    )

    conclusions = {
        "muqFits":
            True,
        "styleEmbeddingFits":
            True,
        "cfmFits":
            cfm_status == "ok",
        "cfmPlusVaeFits":
            combined_status == "ok",
        "vaeAloneFits":
            vae_alone_status == "ok",
        "sequential95SecondPathCandidate":
            (
                cfm_status == "ok"
                and
                vae_alone_status == "ok"
            ),
    }

    result = {
        "ok":
            True,
        "qualificationComplete":
            True,
        "provider":
            "diffrhythm",
        "sourceRevision":
            os.environ.get(
                "HARMONIA_DIFFRHYTHM_REF"
            ),
        "model":
            "diffrhythm-v12-base",
        "maxFrames":
            max_frames,
        "gpu": {
            "name":
                gpu_name,
            "totalMemoryBytes":
                total_memory,
        },
        "runtimeCache":
            runtime_cache,
        "snapshots":
            snapshots,
        "stages":
            stages,
        "conclusions":
            conclusions,
    }

    print(
        json.dumps(
            result,
            separators=(",", ":"),
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
