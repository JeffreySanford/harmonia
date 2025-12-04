#!/bin/bash
# Start ML/Music Generation Docker Container
# This container is used for Python/MusicGen workloads

set -e

echo "🎵 Starting Harmonia ML Container"
echo "=================================="
echo ""

# Use docker-compose for proper path handling
docker-compose up -d harmonia 2>&1 | grep -v "version.*obsolete" || true

echo ""
echo "🔗 ML Container Info:"
echo "   Name:      harmonia-dev"
echo "   Image:     harmonia-harmonia:latest"
echo "   Port:      8000"
echo "   Status:    $(docker inspect -f '{{.State.Status}}' harmonia-dev 2>/dev/null || echo 'Not found')"
echo ""
echo "📝 Usage:"
echo "   Shell:     pnpm run docker:ml:shell"
echo "   Stop:      pnpm run docker:ml:stop"
echo "   Logs:      docker logs harmonia-dev"
echo ""
