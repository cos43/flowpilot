#!/bin/bash
set -e

# Configuration
PORT=6001
LOG_FILE="deploy.log"
PID_FILE=".flowpilot.pid"

echo "🚀 Starting FlowPilot Deployment..."

# 1. Update Code (Reset to match remote strictness)
echo "📥 Fetching latest code..."
git fetch origin beta
git reset --hard origin/beta

# 2. Install Dependencies
echo "📦 Installing Dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi

# 3. Build Project
echo "🔨 Building Project..."
if command -v pnpm &> /dev/null; then
    pnpm build
else
    npm run build
fi

# 4. Stop Existing Process
echo "🛑 Stopping old process..."
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null; then
        kill "$PID" || true
        echo "Old process $PID stopped."
    else
        echo "Old process $PID not running."
    fi
    rm "$PID_FILE"
fi

# Fallback kill for any lingering next-server on the port
fuser -k -n tcp $PORT || true

# 5. Start New Process
echo "▶️  Starting new process on port $PORT..."
if command -v pnpm &> /dev/null; then
    nohup pnpm start --port $PORT > "$LOG_FILE" 2>&1 &
else
    nohup npm start -- --port $PORT > "$LOG_FILE" 2>&1 &
fi

NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "✅ Deployment Complete!"
echo "PID: $NEW_PID"
echo "Logs: tail -f $LOG_FILE"
