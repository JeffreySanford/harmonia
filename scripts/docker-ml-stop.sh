#!/bin/bash
set -euo pipefail

echo "Stopping Harmonia ML worker..."
docker compose --profile worker stop worker
