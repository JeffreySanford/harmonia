#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 -n MODEL_NAME [-w WEIGHTS_URL] [-d]

Options:
  -n MODEL_NAME   Name to store under models/ (required)
  -w WEIGHTS_URL  Optional direct URL to download weights (optional)
  -d              Also download weights if WEIGHTS_URL provided
  -h              Show this help

This is a placeholder downloader that fetches metadata for a model and
saves it to models/<MODEL_NAME>/metadata.json. By default it only fetches
metadata. If you pass -w and -d it will attempt to download the weights
from the provided URL.

Note: This script is intentionally conservative and doesn't attempt to
scrape proprietary endpoints. Supply an explicit weights URL when you
want to fetch large binaries.
EOF
}

MODEL_NAME=""
WEIGHTS_URL=""
DO_DOWNLOAD=0

while getopts ":n:w:dh" opt; do
  case ${opt} in
    n) MODEL_NAME="$OPTARG" ;;
    w) WEIGHTS_URL="$OPTARG" ;;
    d) DO_DOWNLOAD=1 ;;
    h) usage; exit 0 ;;
    :) echo "Error: -$OPTARG requires an argument" >&2; usage; exit 2 ;;
    \?) echo "Invalid option: -$OPTARG" >&2; usage; exit 2 ;;
  esac
done

if [ -z "$MODEL_NAME" ]; then
  echo "Error: model name is required" >&2
  usage
  exit 2
fi

DEST_DIR="$(pwd)/models/${MODEL_NAME}"
mkdir -p "$DEST_DIR"

# Attempt to fetch a plausible metadata location — this is a heuristic placeholder.
# Prefer explicit metadata URLs in the future; many projects publish a config.json
# or README with metadata on GitHub/HF.
METADATA_URLS=(
  "https://huggingface.co/${MODEL_NAME}/raw/main/config.json"
  "https://raw.githubusercontent.com/facebookresearch/${MODEL_NAME}/main/config.json"
  "https://raw.githubusercontent.com/${MODEL_NAME}/main/config.json"
)

METADATA_FILE="$DEST_DIR/metadata.json"

echo "Fetching metadata for '${MODEL_NAME}' into $METADATA_FILE"

for url in "${METADATA_URLS[@]}"; do
  echo "Trying $url"
  if curl -fsSL "$url" -o "$METADATA_FILE"; then
    echo "Saved metadata from $url"
    break
  fi
done

if [ ! -s "$METADATA_FILE" ]; then
  # Fallback: write minimal metadata
  cat > "$METADATA_FILE" <<EOF
{
  "model_name": "${MODEL_NAME}",
  "fetched_at": "$(date --iso-8601=seconds)",
  "note": "No remote metadata found; placeholder created. Provide a metadata file or use -w to download weights."
}
EOF
  echo "No remote metadata found — created placeholder metadata."
fi

if [ "$DO_DOWNLOAD" -eq 1 ]; then
  if [ -z "$WEIGHTS_URL" ]; then
    echo "Error: -d specified but no -w WEIGHTS_URL provided" >&2
    exit 2
  fi

  WEIGHTS_PATH="$DEST_DIR/$(basename "$WEIGHTS_URL")"
  echo "Downloading weights from $WEIGHTS_URL to $WEIGHTS_PATH"
  curl -L --progress-bar "$WEIGHTS_URL" -o "$WEIGHTS_PATH"
  echo "Weights downloaded to $WEIGHTS_PATH"
fi

echo "Done. Metadata at: $METADATA_FILE"
