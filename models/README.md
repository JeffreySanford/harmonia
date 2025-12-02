# Models & Datasets (local)

This file summarizes the MusicGen models and curated datasets downloaded into this workspace and provides quick commands for verification and usage.

Location
- Models: `models/facebook/` (each Hugging Face repo downloaded into a folder named like `facebook_musicgen-small`).
- Datasets: `datasets/` (each dataset repo downloaded into a folder named like `magenta_nsynth` or `marsyas_gtzan`).

What was downloaded (examples)
- Models (official Facebook releases):
  - `facebook/musicgen-small`
  - `facebook/musicgen-medium`
  - `facebook/musicgen-large`
  - `facebook/musicgen-melody`
  - `facebook/musicgen-melody-large`
  - `facebook/musicgen-stereo-*` variants
  - `facebook/encodec_32khz`, `facebook/encodec_24khz`, `facebook/encodec_48khz`
  - `facebook/demucs` (source separation model checkpoints)

- Datasets (curated set):
  - `magenta/nsynth`
  - `ionosphere/maestro` (may be mirrored)
  - `freesound/audio-tagging`
  - `marsyas/gtzan`
  - `polyfloyd/fma`
  - `muso-ai/musicnet`
  - `google/musiccaps`

Quick verification commands

```bash
# show sizes
du -sh models datasets

# list the largest model files
find models -type f -printf "%s %p\n" | sort -nr | head -n 30

# compute SHA256 for the largest N files (example)
find models -type f -size +100M -print0 | xargs -0 sha256sum > models/checksums.sha256
```

How to re-run downloads

```bash
# make sure you have a token in .env or exported
./scripts/download_musicgen_full.sh --models --datasets --run
```

Notes
- Do not commit `models/` or `datasets/` to Git. They are ignored by `.gitignore`.
- Keep your `.env` private. It is not committed.
- If you need only a subset of models/datasets, edit `scripts/download_musicgen_full.sh` to remove unwanted repo ids.

If you'd like, I can also generate an inventory file (JSON) listing each downloaded repo id, path, size, and snapshot id — tell me if you want that created next.
# models/

This folder should contain model artifacts and model-specific config directories.

Suggested layout:

- `facebook/`
  - `sm/`  — small model weights/configs
  - `med/` — medium model weights/configs
  - `lr/`  — large (low-rate?) or other variants
  - `styles/` — style models or finetunes

Notes:
- Do not commit large model weights to Git. Prefer a model registry, cloud storage, or Git LFS.
- Use `scripts/` to implement model downloaders that fetch from remote hosts into `models/`.
- For GPU usage, run containers with the NVIDIA Container Toolkit or use a host with WSL2 + GPU passthrough.
