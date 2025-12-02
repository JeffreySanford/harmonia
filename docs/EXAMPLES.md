# Examples & Quickstarts

This document collects short examples and commands to run local inference,
verification checks, and quick experiment scaffolding using the artifacts
downloaded into this workspace (`models/` and `datasets/`).

1) List local models

```bash
./scripts/generate_with_musicgen.py --list
```

2) Inspect a particular model folder

```bash
./scripts/generate_with_musicgen.py --model facebook_musicgen-small
```

3) Run the environment smoke check (computes checksums and writes a report)

```bash
python tests/env_tests/smoke_check.py
```

4) Re-run the downloader (if needed)

```bash
# requires HUGGINGFACE_HUB_TOKEN in .env or exported
./scripts/download_musicgen_full.sh --models --datasets --run
```

5) Start an interactive notebook (if you have Jupyter installed)

```bash
pip install -r requirements.txt
jupyter lab notebooks/quickstart.ipynb
```

Notes
- This repository uses local files for inference — no HF downloads are performed
  by the example scripts unless you explicitly run the downloader.
- For heavy experiments or GPU execution, prefer running inside Docker + WSL2.
