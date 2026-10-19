#!/bin/bash
# Stop WhatsApp Gateway LaunchAgent daemon
PLIST="$HOME/Library/LaunchAgents/com.krishclothing.whatsapp-gateway.plist"

echo "🛑 Stopping WhatsApp Gateway..."
launchctl unload -w "$PLIST" 2>/dev/null || true

# Kill any remaining process on 5050 if any
PID=$(lsof -ti :5050 2>/dev/null)
if [ -n "$PID" ]; then
  kill -9 "$PID" 2>/dev/null || true
fi

echo "✅ WhatsApp Gateway stopped."
