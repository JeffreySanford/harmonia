# Examples & Quickstarts

This document collects short examples and commands to run local inference,
verification checks, and quick experiment scaffolding using the artifacts
downloaded into this workspace (`models/` and `datasets/`).

1) List local models

```bash
./scripts/generate_with_musicgen.py --list
```

1) Inspect a particular model folder

```bash
./scripts/generate_with_musicgen.py --model facebook_musicgen-small
```

1) Run the environment smoke check (computes checksums and writes a report)

```bash
python tests/env_tests/smoke_check.py
```

1) Retrieve CI-generated smoke reports

If you run the GitHub Actions workflow `Smoke Checks` (which runs on push), the generated
report artifacts are attached to the workflow run. In the Actions UI select the run and
download `smoke-reports` to inspect `smoke_report_<timestamp>.json` files.

1) Re-run the downloader (if needed)

```bash
# requires HUGGINGFACE_HUB_TOKEN in .env or exported
./scripts/download_musicgen_full.sh --models --datasets --run
```

1) Start an interactive notebook (if you have Jupyter installed)

```bash
pip install -r requirements.txt
jupyter lab notebooks/quickstart.ipynb
```

Notes

- This repository uses local files for inference — no HF downloads are performed
  by the example scripts unless you explicitly run the downloader.
- For heavy experiments or GPU execution, prefer running inside Docker + WSL2.
