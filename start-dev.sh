#!/bin/bash

# Kinetic Ledger Local Dev Launcher
# Starts both motion-blend-service (Python) and web-dapp (Node.js) locally

set -e

REPO_ROOT="/Users/ted/git clone repos/kinetic-ledger"
cd "$REPO_ROOT"

echo "🚀 Starting Kinetic Ledger Local Development Stack..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $MOTION_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    wait 2>/dev/null || true
    echo "✅ Services stopped"
}

trap cleanup EXIT INT TERM

echo "📦 Installing Python dependencies..."
cd apps/motion-blend-service
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m pip install -q -r requirements.txt 2>&1 | grep -v "already satisfied" | tail -3

echo "✅ Python dependencies installed"
echo ""

echo "🚀 Starting Motion Blend Service on port 8000..."
cd "$REPO_ROOT/apps/motion-blend-service"
PORT=8000 /Library/Frameworks/Python.framework/Versions/3.10/bin/python3 main.py > /tmp/motion-blend.log 2>&1 &
MOTION_PID=$!
echo "   PID: $MOTION_PID"

echo ""
echo "⏳ Waiting for Motion Blend Service to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Motion Blend Service is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Motion Blend Service failed to start"
        cat /tmp/motion-blend.log
        exit 1
    fi
    sleep 1
done

echo ""
echo "🌐 Starting Web Dapp on port 3000..."
cd "$REPO_ROOT"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@9.12.0 > /dev/null 2>&1
fi

pnpm -C apps/web-dapp dev &
WEB_PID=$!
echo "   PID: $WEB_PID"

echo ""
echo "⏳ Waiting for Web Dapp to be ready..."
sleep 10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ All services are running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Service URLs:"
echo "   🌐 Web Dapp:             http://localhost:3000"
echo "   🎬 Motion Blending:      http://localhost:3000/blend"
echo ""
echo "   🔧 Motion Blend API:     http://localhost:8000"
echo "   📚 API Docs:             http://localhost:8000/docs"
echo "   ❤️  Health:              http://localhost:8000/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Log Files:"
echo "   Motion Blend Service: tail -f /tmp/motion-blend.log"
echo ""
echo "Press Ctrl+C to stop all services..."
echo ""

# Open browser
if command -v open &> /dev/null; then
    sleep 5
    open http://localhost:3000/blend
fi

# Keep script running
wait
