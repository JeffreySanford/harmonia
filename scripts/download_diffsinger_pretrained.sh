#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_ROOT="${ROOT}/models/diffsinger"
RELEASE_BASE="https://github.com/MoonInTheRiver/DiffSinger/releases/download/pretrain-model"

mkdir -p "${MODELS_ROOT}"

has_checkpoint_package() {
  local dir="$1"
  test -f "${dir}/config.yaml" &&
    find "${dir}" -maxdepth 2 -type f -name 'model_ckpt_steps_*.ckpt' -print -quit |
      grep -q .
}

download_package() {
  local name="$1"
  local target_name="${2:-$1}"
  local target="${MODELS_ROOT}/${target_name}"
  local zip="${MODELS_ROOT}/${name}.zip"
  local unpack="${MODELS_ROOT}/.${name}-unpack"

  if has_checkpoint_package "${target}"; then
    echo "Using cached ${name} at ${target}"
    return 0
  fi

  echo "Downloading ${name}..."
  rm -rf "${unpack}"
  mkdir -p "${unpack}"

  curl -L --fail --retry 3 --retry-delay 2     -o "${zip}"     "${RELEASE_BASE}/${name}.zip"

  unzip -q -o "${zip}" -d "${unpack}"

  rm -rf "${target}"
  mkdir -p "${target}"

  if [ -d "${unpack}/${name}" ]; then
    cp -a "${unpack}/${name}/." "${target}/"
  else
    config="$(find "${unpack}" -type f -name config.yaml -print -quit)"
    if [ -z "${config}" ]; then
      echo "ERROR: ${name} archive did not contain config.yaml." >&2
      return 1
    fi
    cp -a "$(dirname "${config}")/." "${target}/"
  fi

  rm -rf "${unpack}" "${zip}"

  if ! has_checkpoint_package "${target}"; then
    echo "ERROR: ${name} package is incomplete after extraction." >&2
    return 1
  fi
}

echo "============================================================"
echo " HARMONIA DIFFSINGER PRETRAINED STACK"
echo "============================================================"

download_package "0228_opencpop_ds100_rel"
download_package "0102_xiaoma_pe"
download_package "0109_hifigan_bigpopcs_hop128" "hifigan"

echo
echo "DiffSinger pretrained stack is cached:"
find "${MODELS_ROOT}" -maxdepth 3 -type f \
  \( -name 'config.yaml' -o -name 'model_ckpt_steps_*.ckpt' \) \
  -print | sort

echo
echo "DIFFSINGER_PRETRAINED_STACK_OK"
