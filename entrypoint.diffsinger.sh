#!/usr/bin/env bash
set -euo pipefail

echo "Starting Harmonia DiffSinger compatibility provider"
rm -f /tmp/harmonia-runtime-ready

MODELS_ROOT="${HARMONIA_DIFFSINGER_MODELS_ROOT:-/workspace/models/diffsinger}"

ACOUSTIC_NAME="0228_opencpop_ds100_rel"
PITCH_NAME="0102_xiaoma_pe"
VOCODER_NAME="0109_hifigan_bigpopcs_hop128"
VOCODER_CACHE_NAME="hifigan"

ACOUSTIC_DIR="${MODELS_ROOT}/${ACOUSTIC_NAME}"
PITCH_DIR="${MODELS_ROOT}/${PITCH_NAME}"
VOCODER_DIR="${MODELS_ROOT}/${VOCODER_CACHE_NAME}"

ACOUSTIC_URL="https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/${ACOUSTIC_NAME}.zip"
PITCH_URL="https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/${PITCH_NAME}.zip"
VOCODER_URL="https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model/${VOCODER_NAME}.zip"

mkdir -p "${MODELS_ROOT}" /opt/DiffSinger/checkpoints

has_checkpoint_package() {
  local dir="$1"
  test -f "${dir}/config.yaml" &&
    find "${dir}" -maxdepth 2 -type f -name 'model_ckpt_steps_*.ckpt' -print -quit |
      grep -q .
}

download_checkpoint_package() {
  local name="$1"
  local url="$2"
  local target="$3"
  local zip="/tmp/${name}.zip"
  local unpack="/tmp/${name}-unpack"

  echo "Caching DiffSinger package ${name}..."
  rm -rf "${unpack}" "${zip}"
  mkdir -p "${unpack}"

  curl -L --fail --retry 3 --retry-delay 2 -o "${zip}" "${url}"
  unzip -q -o "${zip}" -d "${unpack}"

  rm -rf "${target}"
  mkdir -p "${target}"

  if [ -d "${unpack}/${name}" ]; then
    cp -a "${unpack}/${name}/." "${target}/"
  else
    local config
    config="$(find "${unpack}" -type f -name config.yaml -print -quit)"
    if [ -z "${config}" ]; then
      echo "ERROR: ${name} archive did not contain config.yaml." >&2
      return 1
    fi
    cp -a "$(dirname "${config}")/." "${target}/"
  fi

  rm -rf "${unpack}" "${zip}"

  if ! has_checkpoint_package "${target}"; then
    echo "ERROR: ${name} cache is incomplete after extraction." >&2
    return 1
  fi
}

if has_checkpoint_package "${ACOUSTIC_DIR}"; then
  echo "Using cached DiffSinger acoustic model from ${ACOUSTIC_DIR}"
else
  download_checkpoint_package "${ACOUSTIC_NAME}" "${ACOUSTIC_URL}" "${ACOUSTIC_DIR}"
fi

if has_checkpoint_package "${PITCH_DIR}"; then
  echo "Using cached DiffSinger pitch estimator from ${PITCH_DIR}"
else
  download_checkpoint_package "${PITCH_NAME}" "${PITCH_URL}" "${PITCH_DIR}"
fi

if has_checkpoint_package "${VOCODER_DIR}"; then
  echo "Using cached DiffSinger vocoder from ${VOCODER_DIR}"
else
  download_checkpoint_package "${VOCODER_NAME}" "${VOCODER_URL}" "${VOCODER_DIR}"
fi

ln -sfnT "${ACOUSTIC_DIR}" "/opt/DiffSinger/checkpoints/${ACOUSTIC_NAME}"
ln -sfnT "${PITCH_DIR}" "/opt/DiffSinger/checkpoints/${PITCH_NAME}"
ln -sfnT "${VOCODER_DIR}" "/opt/DiffSinger/checkpoints/${VOCODER_NAME}"

test -f "/opt/DiffSinger/checkpoints/${ACOUSTIC_NAME}/config.yaml"
test -f "/opt/DiffSinger/checkpoints/${PITCH_NAME}/config.yaml"
test -f "/opt/DiffSinger/checkpoints/${VOCODER_NAME}/config.yaml"

find "/opt/DiffSinger/checkpoints/${ACOUSTIC_NAME}"   -type f -name 'model_ckpt_steps_*.ckpt' -print -quit | grep -q .
find "/opt/DiffSinger/checkpoints/${PITCH_NAME}"   -type f -name 'model_ckpt_steps_*.ckpt' -print -quit | grep -q .
find "/opt/DiffSinger/checkpoints/${VOCODER_NAME}"   -type f -name 'model_ckpt_steps_*.ckpt' -print -quit | grep -q .

echo "DiffSinger acoustic, pitch-estimator, and vocoder caches are ready"
touch /tmp/harmonia-runtime-ready
exec "$@"
