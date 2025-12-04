#!/bin/bash
# Docker Cleanup Script for Harmonia
# Removes dangling images, stopped containers, and unused networks

set -e

echo "🧹 Harmonia Docker Cleanup"
echo "=========================="
echo ""

# Remove dangling images (those with <none> tag)
echo "📦 Removing dangling images..."
docker image prune -f

# Remove stopped containers (optional - uncomment if needed)
# echo "🗑️  Removing stopped containers..."
# docker container prune -f

# Remove unused networks
echo "🌐 Removing unused networks..."
docker network prune -f

# Remove unused volumes (BE CAREFUL - this removes data!)
# echo "💾 Removing unused volumes..."
# docker volume prune -f

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Current disk usage:"
docker system df
