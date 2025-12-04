#!/bin/bash
# Docker Status Script for Harmonia
# Shows the current status of all Harmonia containers

echo "🐳 Harmonia Docker Status"
echo "========================"
echo ""

echo "📊 Containers:"
docker ps -a --filter "name=harmonia" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Disk Usage:"
docker system df

echo ""
echo "🌐 Networks:"
docker network ls --filter "name=harmonia"

echo ""
echo "💿 Volumes:"
docker volume ls --filter "name=harmonia"
