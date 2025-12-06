#!/usr/bin/env bash
set -euo pipefail

# Downloads a small public DiffSinger pretrain asset and extracts into models/diffsinger
mkdir -p models/diffsinger
cd models/diffsinger

ASSET_URL="https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/0102_xiaoma_pe.zip"
ZIPFILE="0102_xiaoma_pe.zip"

if [ -f "$ZIPFILE" ]; then
  echo "$ZIPFILE already exists, skipping download"
else
  echo "Downloading $ASSET_URL"
  curl -L -o "$ZIPFILE" "$ASSET_URL"
fi

if [ -d "0102_xiaoma_pe" ]; then
  echo "Already extracted"
else
  echo "Extracting $ZIPFILE"
  unzip -o "$ZIPFILE" -d 0102_xiaoma_pe || true
fi

echo "Contents of models/diffsinger/"
ls -la
ls -la 0102_xiaoma_pe || true
