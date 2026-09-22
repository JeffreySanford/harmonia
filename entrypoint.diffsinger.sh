#!/usr/bin/env bash
set -euo pipefail

echo "Starting Harmonia DiffSinger provider runtime"
rm -f /tmp/harmonia-runtime-ready

MODELS_ROOT="${HARMONIA_DIFFSINGER_MODELS_ROOT:-/workspace/models/diffsinger}"
VOCODER_DIR="${MODELS_ROOT}/hifigan"
VOCODER_URL="https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/0109_hifigan_bigpopcs_hop128.zip"
VOCODER_ZIP="${VOCODER_DIR}/0109_hifigan_bigpopcs_hop128.zip"

mkdir -p "${MODELS_ROOT}" "${VOCODER_DIR}" /opt/DiffSinger/checkpoints

if ! find "${VOCODER_DIR}" -type f -name '*.ckpt' -print -quit | grep -q .; then
  echo "DiffSinger vocoder is not cached; downloading HiFi-GAN (~900MB) once..."
  curl -L --fail --retry 3 -o "${VOCODER_ZIP}" "${VOCODER_URL}"
  unzip -o "${VOCODER_ZIP}" -d "${VOCODER_DIR}"
else
  echo "Using cached DiffSinger vocoder from ${VOCODER_DIR}"
fi

for source in "${MODELS_ROOT}"/*; do
  [ -e "${source}" ] || continue
  name="$(basename "${source}")"
  ln -sfn "${source}" "/opt/DiffSinger/checkpoints/${name}"
done

echo "DiffSinger runtime dependencies and model cache are ready"
touch /tmp/harmonia-runtime-ready
exec "$@"
