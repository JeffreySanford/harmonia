#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=harmonia:latest

# Ensure image exists
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  echo "Image $IMAGE_NAME not found — building"
  docker build -t "$IMAGE_NAME" .
fi

# Run an interactive container mounting the repository and models folder
docker run --rm -it \
  -v "$(pwd)":/workspace \
  -v "$(pwd)/models":/workspace/models \
  -p 8000:8000 \
  --workdir /workspace \
  "$IMAGE_NAME" bash
