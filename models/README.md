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
