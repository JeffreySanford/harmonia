#!/usr/bin/env bash
set -euo pipefail

READY_FILE=/tmp/harmonia-runtime-ready
rm -f "${READY_FILE}"

echo "Starting Harmonia Stable Audio 3 provider"
echo "Stable Audio 3 revision: ${HARMONIA_STABLE_AUDIO_3_REF:-unknown}"

if [ -z "${HF_TOKEN:-}" ]; then
  if [ -n "${HUGGING_FACE_HUB_TOKEN:-}" ]; then
    export HF_TOKEN="${HUGGING_FACE_HUB_TOKEN}"
  elif [ -n "${HUGGINGFACE_HUB_TOKEN:-}" ]; then
    export HF_TOKEN="${HUGGINGFACE_HUB_TOKEN}"
  fi
fi

if [ -z "${HF_TOKEN:-}" ]; then
  echo "WARNING: no Hugging Face token is configured."
  echo "Stable Audio 3 model inference requires gated-model access."
else
  echo "Hugging Face token available through the canonical HF_TOKEN runtime variable."
fi

python - <<'PY'
import torch
import torchaudio
from stable_audio_3 import StableAudioModel

assert torch.__version__.startswith("2.7.1"), torch.__version__
assert torchaudio.__version__.startswith("2.7.1"), torchaudio.__version__
print(
    "Stable Audio 3 runtime import ready; "
    f"cuda={torch.cuda.is_available()}"
)
PY

touch "${READY_FILE}"
exec "$@"
