#!/bin/bash
set -euo pipefail

if ! docker ps --format '{{.Names}}' | grep -q '^harmonia-worker$'; then
    echo "Container 'harmonia-worker' is not running."
    echo "Start it with: pnpm docker:ml:start"
    exit 1
fi

docker exec -it harmonia-worker bash
