#!/bin/bash
# Open shell in ML/Music Generation Docker Container

if ! docker ps --format '{{.Names}}' | grep -q '^harmonia-dev$'; then
    echo "❌ Container 'harmonia-dev' is not running"
    echo ""
    echo "Start it first:"
    echo "  bash scripts/docker-ml-start.sh"
    echo ""
    exit 1
fi

echo "🐚 Opening shell in harmonia-dev container..."
echo "   (Type 'exit' to leave the container)"
echo ""
docker exec -it harmonia-dev bash
