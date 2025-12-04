#!/bin/bash
# Stop ML/Music Generation Docker Container

echo "🛑 Stopping Harmonia ML Container"
echo "=================================="
echo ""

docker-compose stop harmonia 2>&1 | grep -v "version.*obsolete" || true

echo "✅ Container stopped"
echo ""
