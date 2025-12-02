#!/usr/bin/env bash
set -euo pipefail
# Load environment variables from .env if present and export them
if [ -f "$(pwd)/.env" ]; then
  # Export all variables defined in .env for child processes
  set -a
  # shellcheck disable=SC1091
  . "$(pwd)/.env"
  set +a
fi

# download_musicgen_full.sh
# Downloads MusicGen model repos and a curated set of music datasets from
# Hugging Face into `models/` and `datasets/` respectively.
#
# Usage:
#   ./scripts/download_musicgen_full.sh [--models] [--datasets] [--run]
#
# By default the script performs a dry-run and prints what it would download.
# Pass `--run` to actually perform downloads. Set `HUGGINGFACE_HUB_TOKEN`
# to avoid rate-limits for large downloads.

QUIET=0
DO_MODELS=0
DO_DATASETS=0
DO_RUN=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --models) DO_MODELS=1; shift ;;
    --datasets) DO_DATASETS=1; shift ;;
    --run) DO_RUN=1; shift ;;
    --quiet) QUIET=1; shift ;;
    -h|--help)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

if [ "$DO_MODELS" -eq 0 ] && [ "$DO_DATASETS" -eq 0 ]; then
  # default: do both
  DO_MODELS=1
  DO_DATASETS=1
fi

ROOT_DIR="$(pwd)"
MODELS_DIR="$ROOT_DIR/models/facebook"
DATASETS_DIR="$ROOT_DIR/datasets"

mkdir -p "$MODELS_DIR"
mkdir -p "$DATASETS_DIR"

# Official MusicGen model repos on Hugging Face (official FB releases)
MODELS=(
  "facebook/musicgen-small"
  "facebook/musicgen-medium"
  "facebook/musicgen-large"
  "facebook/musicgen-melody"
  "facebook/musicgen-melody-large"
  "facebook/musicgen-stereo-small"
  "facebook/musicgen-stereo-medium"
  "facebook/musicgen-stereo-large"
  "facebook/musicgen-stereo-melody"
  "facebook/musicgen-stereo-melody-large"
  # EnCodec variants (used for tokenization by MusicGen)
  "facebook/encodec_32khz"
  "facebook/encodec_24khz"
  "facebook/encodec_48khz"
  # Demucs (source separation) - model checkpoints sometimes hosted on HF
  "facebook/demucs"
)

# Curated dataset repo IDs (Hugging Face dataset repo ids). This is a
# conservative list of widely used music/audio datasets. Some may be large.
# We will attempt to download each; failures are logged and skipped.
DATASETS=(
  "magenta/nsynth"
  "ionosphere/maestro"            # some mirrors use different ids; may fail and be skipped
  "freesound/audio-tagging"       # freesound tags/datasets (will vary)
  "marsyas/gtzan"                 # GTZAN music genre dataset
  "polyfloyd/fma"                 # FMA dataset mirrors (may be large)
  "muso-ai/musicnet"              # MusicNet
  "google/musiccaps"              # MusicCaps (text-to-audio dataset)
)

echo "Download script: dry-run mode. Use --run to actually download."
if [ "$DO_RUN" -eq 1 ]; then
  echo "*** Running downloads (this will use network and disk space) ***"
else
  echo "*** Dry run — no files will be downloaded. Pass --run to proceed. ***"
fi

echo
echo "Models to fetch:"
for m in "${MODELS[@]}"; do
  echo "  - $m -> $MODELS_DIR/$(basename $m)"
done

echo
echo "Datasets to fetch (curated list):"
for d in "${DATASETS[@]}"; do
  echo "  - $d -> $DATASETS_DIR/$(basename $d)"
done

if [ "$DO_RUN" -eq 0 ]; then
  echo
  echo "Exiting (dry-run). Re-run with --run to actually download."
  exit 0
fi

# Ensure python and huggingface_hub are available
echo
echo "Checking Python & huggingface_hub..."
if ! command -v python &>/dev/null; then
  echo "Python not found in PATH. Please install Python 3.9+" >&2
  exit 3
fi

python - <<'PY'
import sys
try:
    import huggingface_hub
    from huggingface_hub import snapshot_download
except Exception:
    print('Installing huggingface_hub...')
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--upgrade', 'huggingface_hub'])
    from huggingface_hub import snapshot_download

print('huggingface_hub ready')
PY

PYRUN=$(cat <<'PY'
from huggingface_hub import snapshot_download
import os, sys

ROOT=os.getcwd()
models_dir=os.path.join(ROOT,'models','facebook')
datasets_dir=os.path.join(ROOT,'datasets')

models=[
  'facebook/musicgen-small',
  'facebook/musicgen-medium',
  'facebook/musicgen-large',
  'facebook/musicgen-melody',
  'facebook/musicgen-melody-large',
  'facebook/musicgen-stereo-small',
  'facebook/musicgen-stereo-medium',
  'facebook/musicgen-stereo-large',
  'facebook/musicgen-stereo-melody',
  'facebook/musicgen-stereo-melody-large',
]

datasets=[
  'magenta/nsynth',
  'ionosphere/maestro',
  'freesound/audio-tagging',
  'marsyas/gtzan',
  'polyfloyd/fma',
  'muso-ai/musicnet',
  'google/musiccaps',
]

def try_snapshot(repo_id, dest_dir, repo_type='model'):
    print(f"Downloading {repo_id} into {dest_dir} (repo_type={repo_type})")
    try:
        path = snapshot_download(repo_id=repo_id, cache_dir=dest_dir, repo_type=repo_type, resume_download=True)
        print('Saved:', path)
    except Exception as e:
        print('Failed to download', repo_id, '->', e)

if __name__ == '__main__':
    do_models = os.environ.get('DOWNLOAD_MUSICGEN_DO_MODELS','1')=='1'
    do_dsets = os.environ.get('DOWNLOAD_MUSICGEN_DO_DATASETS','1')=='1'
    if do_models:
        for m in models:
            outdir = os.path.join(models_dir, m.replace('/','_'))
            os.makedirs(outdir, exist_ok=True)
            try_snapshot(m, outdir, repo_type='model')
    if do_dsets:
        for d in datasets:
            outdir = os.path.join(datasets_dir, d.replace('/','_'))
            os.makedirs(outdir, exist_ok=True)
            try_snapshot(d, outdir, repo_type='dataset')
PY
)

echo "Starting Python downloader (this may take a long time)..."
DOWNLOAD_MUSICGEN_DO_MODELS=${DO_MODELS}
DOWNLOAD_MUSICGEN_DO_DATASETS=${DO_DATASETS}

# Export control variables for the Python runner
export DOWNLOAD_MUSICGEN_DO_MODELS
export DOWNLOAD_MUSICGEN_DO_DATASETS

python - <<PYCODE
${PYRUN}
PYCODE

echo "All done." 
