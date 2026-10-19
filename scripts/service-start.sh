#!/bin/bash
# Start and load the 24/7/365 WhatsApp Gateway LaunchAgent daemon
PLIST="$HOME/Library/LaunchAgents/com.krishclothing.whatsapp-gateway.plist"

echo "🧵 Starting 24/7/365 WhatsApp Dispatch Gateway..."

# Unload previous instance if loaded
launchctl unload "$PLIST" 2>/dev/null || true

# Load and start daemon
launchctl load -w "$PLIST"

sleep 2

# Check status
if lsof -i :5050 >/dev/null 2>&1; then
  echo "✅ WhatsApp Gateway is RUNNING 24/7 on port 5050."
  echo "📡 Check status: curl http://localhost:5050/api/status"
  echo "📲 View QR: http://localhost:5050/qr"
else
  echo "⏳ Daemon loaded, waiting for port 5050..."
  sleep 2
  lsof -i :5050
fi
