#!/bin/bash

# Kinetic Ledger Docker Launcher
# This script starts the complete application stack in Docker

set -e

echo "🚀 Starting Kinetic Ledger Application Stack..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker and Docker Compose detected"
echo ""

# Load environment variables
if [ -f .env.docker ]; then
    export $(cat .env.docker | grep -v '#' | xargs)
    echo "✅ Loaded environment from .env.docker"
else
    echo "⚠️  .env.docker not found, using defaults"
fi

echo ""
echo "🔨 Building Docker images..."
docker compose build

echo ""
echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "✅ Services started!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Service URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Web Dapp:             http://localhost:3000"
echo "   Motion Blend Studio:  http://localhost:3000/blend"
echo ""
echo "🔧 Motion Blend API:     http://localhost:8000"
echo "   API Docs (Swagger):   http://localhost:8000/docs"
echo "   API Docs (ReDoc):     http://localhost:8000/redoc"
echo "   Health Check:         http://localhost:8000/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:            docker compose logs -f"
echo "   View web-dapp logs:   docker compose logs -f web-dapp"
echo "   View api logs:        docker compose logs -f motion-blend-service"
echo "   Stop services:        docker compose down"
echo "   Rebuild images:       docker compose build --no-cache"
echo ""
echo "✨ Application is ready! Opening web dapp in browser..."
echo ""

# Try to open in browser (macOS)
if command -v open &> /dev/null; then
    open http://localhost:3000/blend
# Try to open in browser (Linux)
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000/blend
fi

echo "🎉 Setup complete! You can now:"
echo "   1. Go to http://localhost:3000/blend"
echo "   2. Select two motion BVH files"
echo "   3. Configure blend parameters"
echo "   4. Click 'Start Blending' to blend the motions"
echo "   5. View 3D preview and quality metrics"
echo "   6. Mint NFT with USDC payment"
echo ""
