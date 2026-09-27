#!/usr/bin/env python3
"""DiffRhythm D1 CUDA/runtime qualification probe.

This probe deliberately imports the real inference stack and validates
Harmonia's registry-managed Hugging Face cache without instantiating
DiffRhythm, MuQ-MuLan, or VAE model weights.
"""

import importlib.metadata
import json
import os
from pathlib import Path

import huggingface_hub
import onnxruntime
import torch
import torchaudio
import transformers
from huggingface_hub import snapshot_download
from muq import MuQMuLan

# Import the real pinned DiffRhythm inference modules.
# Importing classes/functions is allowed here; calling prepare_model is D2+.
from model import CFM, DiT
from infer.infer_utils import (
    decode_audio,
    get_style_prompt,
    prepare_model,
)


EXPECTED_REPOS = [
    {
        "repoId": "ASLP-lab/DiffRhythm-1_2",
        "revision": "185bdeb80541b9260d266c5f041859017441f307",
        "requiredFiles": [
            "cfm_model.pt",
        ],
    },
    {
        "repoId": "ASLP-lab/DiffRhythm-vae",
        "revision": "74e2afacfd91dd1b96662c96dcef763c1258768b",
        "requiredFiles": [
            "vae_model.pt",
        ],
    },
    {
        "repoId": "OpenMuQ/MuQ-MuLan-large",
        "revision": "2e01c796b71dca71b45251384c04cd7b237c9020",
        "requiredFiles": [
            "config.json",
            "pytorch_model.bin",
        ],
    },
    {
        "repoId": "OpenMuQ/MuQ-large-msd-iter",
        "revision": "0562a57814f6f8bbd9fdea0a25921a2fce1a841a",
        "requiredFiles": [
            "config.json",
            "model.safetensors",
        ],
    },
    {
        "repoId": "FacebookAI/xlm-roberta-base",
        "revision": "e73636d4f797dec63c3081bb6ed5c7b0bb3f2089",
        "requiredFiles": [
            "config.json",
            "model.safetensors",
            "sentencepiece.bpe.model",
            "tokenizer.json",
            "tokenizer_config.json",
        ],
    },
]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    require(
        os.environ.get("HF_HUB_OFFLINE") == "1",
        "HF_HUB_OFFLINE must be 1",
    )

    require(
        os.environ.get("TRANSFORMERS_OFFLINE") == "1",
        "TRANSFORMERS_OFFLINE must be 1",
    )

    require(
        torch.__version__.startswith("2.6.0"),
        f"unexpected torch version: {torch.__version__}",
    )

    require(
        torchaudio.__version__.startswith("2.6.0"),
        f"unexpected torchaudio version: {torchaudio.__version__}",
    )

    require(
        transformers.__version__ == "4.49.0",
        f"unexpected transformers version: {transformers.__version__}",
    )

    require(
        huggingface_hub.__version__ == "0.29.3",
        f"unexpected huggingface_hub version: {huggingface_hub.__version__}",
    )

    muq_version = importlib.metadata.version("muq")

    require(
        muq_version == "0.1.0",
        f"unexpected MuQ version: {muq_version}",
    )

    require(
        torch.cuda.is_available(),
        "CUDA is not available to PyTorch",
    )

    device_index = 0

    device_name = torch.cuda.get_device_name(
        device_index
    )

    properties = torch.cuda.get_device_properties(
        device_index
    )

    total_memory = int(
        properties.total_memory
    )

    memory_allocated = int(
        torch.cuda.memory_allocated(
            device_index
        )
    )

    memory_reserved = int(
        torch.cuda.memory_reserved(
            device_index
        )
    )

    snapshots = []

    for expected in EXPECTED_REPOS:
        local_path = snapshot_download(
            repo_id=expected["repoId"],
            revision=expected["revision"],
            local_files_only=True,
        )

        snapshot = Path(
            local_path
        )

        require(
            snapshot.name == expected["revision"],
            (
                f'{expected["repoId"]}: expected snapshot '
                f'{expected["revision"]}, got {snapshot.name}'
            ),
        )

        checks = []

        for relative_path in expected["requiredFiles"]:
            candidate = (
                snapshot /
                relative_path
            )

            require(
                candidate.is_file(),
                (
                    f'{expected["repoId"]}: missing required file '
                    f'{relative_path}'
                ),
            )

            size = int(
                candidate.stat().st_size
            )

            require(
                size > 0,
                (
                    f'{expected["repoId"]}: zero-byte required file '
                    f'{relative_path}'
                ),
            )

            checks.append(
                {
                    "relativePath":
                        relative_path,
                    "size":
                        size,
                }
            )

        snapshots.append(
            {
                "repoId":
                    expected["repoId"],
                "revision":
                    expected["revision"],
                "snapshotPath":
                    str(snapshot),
                "checks":
                    checks,
            }
        )

    result = {
        "ok":
            True,
        "provider":
            "diffrhythm",
        "sourceRevision":
            os.environ.get(
                "HARMONIA_DIFFRHYTHM_REF"
            ),
        "versions": {
            "torch":
                torch.__version__,
            "torchaudio":
                torchaudio.__version__,
            "torchCuda":
                torch.version.cuda,
            "transformers":
                transformers.__version__,
            "huggingfaceHub":
                huggingface_hub.__version__,
            "muq":
                muq_version,
            "onnxruntime":
                onnxruntime.__version__,
        },
        "imports": {
            "MuQMuLan":
                MuQMuLan.__name__,
            "CFM":
                CFM.__name__,
            "DiT":
                DiT.__name__,
            "prepareModel":
                prepare_model.__name__,
            "decodeAudio":
                decode_audio.__name__,
            "getStylePrompt":
                get_style_prompt.__name__,
        },
        "offline": {
            "hfHub":
                os.environ.get(
                    "HF_HUB_OFFLINE"
                ),
            "transformers":
                os.environ.get(
                    "TRANSFORMERS_OFFLINE"
                ),
        },
        "cuda": {
            "available":
                True,
            "deviceIndex":
                device_index,
            "deviceName":
                device_name,
            "totalMemoryBytes":
                total_memory,
            "memoryAllocatedBytes":
                memory_allocated,
            "memoryReservedBytes":
                memory_reserved,
        },
        "snapshots":
            snapshots,
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
