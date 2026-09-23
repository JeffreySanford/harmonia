#!/bin/bash
set -euo pipefail

echo "Starting Harmonia ML worker..."
docker compose --profile worker up -d --build worker
docker compose --profile worker ps worker
