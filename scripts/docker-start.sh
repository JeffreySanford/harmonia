#!/bin/bash
# Pre-Dev Startup Check for Harmonia
# Verifies MongoDB is running before starting the application

echo "🚀 Harmonia Pre-Dev Check"
echo "========================"
echo ""

# Check if MongoDB is running on port 27017
if nc -z localhost 27017 2>/dev/null || timeout 1 bash -c 'cat < /dev/null > /dev/tcp/127.0.0.1/27017' 2>/dev/null; then
    echo "✅ MongoDB is running (hardened native installation)"
    echo ""
    echo "🔗 Services:"
    echo "   MongoDB:  mongodb://localhost:27017/harmonia (secured)"
    echo "   Backend:  http://localhost:3000/api (starting...)"
    echo "   Frontend: http://localhost:4200 (starting...)"
    echo ""
    echo "ℹ️  Music generation: Use 'harmonia-harmonia' Docker container"
    echo "   (MusicGen/Python ML workloads run in Docker)"
    echo ""
    exit 0
else
    echo "❌ MongoDB is NOT running!"
    echo ""
    echo "🔧 To start MongoDB:"
    echo "   Windows Service: net start MongoDB"
    echo "   PowerShell:      Start-Service MongoDB"
    echo ""
    exit 1
fi
