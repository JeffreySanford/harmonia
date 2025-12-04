#!/usr/bin/env bash
# Wrapper to run the node JS debug script
# Usage: ./scripts/debug-llm.sh [args]
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
node "$SCRIPT_DIR/debug-llm.js" "$@"
