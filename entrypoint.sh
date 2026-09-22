#!/usr/bin/env bash
set -euo pipefail

# Entry point for worker containers.
# Verifies mounts and optionally installs ML deps when requested via ENV.

echo "Starting harmonia worker container"

MODELS_ROOT="${HARMONIA_MODELS_ROOT:-/workspace/models}"

if [ ! -d "$MODELS_ROOT" ]; then
  echo "Warning: models root not found at $MODELS_ROOT" >&2
else
  echo "Models root: $MODELS_ROOT"
  ls -la "$MODELS_ROOT" || true
fi


if [ "${INSTALL_ML_DEPS:-0}" = "1" ]; then
  echo "INSTALL_ML_DEPS=1: installing heavy ML deps from requirements.txt (this may take time)"
  python -m pip install --upgrade pip
  pip install -r /workspace/requirements.txt || true
fi

exec "$@"
