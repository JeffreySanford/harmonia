#!/usr/bin/env bash
set -euo pipefail

rm -f /tmp/harmonia-runtime-ready

python - <<'PY'
from importlib.metadata import version

expected = "0.3.8"
actual = version("diffsinger-utau")

if actual != expected:
    raise SystemExit(
        f"expected diffsinger-utau {expected}, found {actual}"
    )

import yaml

print(
    f"DiffSinger UTAU provider shell ready: "
    f"diffsinger-utau={actual} "
    f"PyYAML={yaml.__version__}"
)
PY

touch /tmp/harmonia-runtime-ready

exec "$@"
