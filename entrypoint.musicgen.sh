#!/usr/bin/env bash
set -euo pipefail

echo "Starting Harmonia MusicGen provider runtime"
rm -f /tmp/harmonia-runtime-ready

mkdir -p \
  "${HF_HOME:-/workspace/models/musicgen/huggingface}" \
  "${TORCH_HOME:-/workspace/models/musicgen/torch}" \
  /workspace/generated

python3.9 - <<'PY'
import sys
import torch
import audiocraft

print(f"Python: {sys.version.split()[0]}")
print(f"AudioCraft: {getattr(audiocraft, '__version__', 'unknown')}")
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if not torch.cuda.is_available():
    raise SystemExit("MusicGen provider requires CUDA")
print(f"GPU: {torch.cuda.get_device_name(0)}")
PY

echo "MusicGen runtime dependencies and GPU are ready"
exec "$@"
