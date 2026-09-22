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


exec "$@"
