#!/bin/bash
# Docker Stop Script for Harmonia
# Gracefully stops all Docker services

set -e

echo "🛑 Stopping Harmonia Docker Services"
echo "===================================="
echo ""

# Stop MongoDB services
echo "📊 Stopping MongoDB services..."
docker-compose -f docker-compose.mongo.yml down

# Optionally stop the main dev container if running
if docker ps -q -f name=harmonia-dev > /dev/null 2>&1; then
    echo "🐳 Stopping main dev container..."
    docker stop harmonia-dev || true
fi

echo ""
echo "✅ All Docker services stopped"
