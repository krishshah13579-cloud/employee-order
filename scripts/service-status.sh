#!/bin/bash
# Check WhatsApp Gateway Status
echo "=== WhatsApp Gateway Status ==="
if lsof -i :5050 >/dev/null 2>&1; then
  echo "✅ Gateway Process: ACTIVE on port 5050"
  curl -s http://localhost:5050/api/status | grep -o '{"status":[^}]*}' || curl -s http://localhost:5050/api/status
  echo ""
else
  echo "❌ Gateway Process: OFFLINE"
fi
