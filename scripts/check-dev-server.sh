#!/usr/bin/env bash
# check-dev-server.sh — Quick diagnostic for Lunartide dev server state
# Does NOT kill any process. Read-only diagnostic only.

set -euo pipefail

PORT="${PORT:-5173}"
URL="http://127.0.0.1:${PORT}"

echo "=== Lunartide Dev Server Check ==="
echo "Port: ${PORT}"
echo ""

# Check listener
LISTENER_LINE=$(lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)

if [ -z "$LISTENER_LINE" ]; then
  echo "Listener: ABSENT"
  echo "PID: N/A"
  echo "Owner: none"
  echo ""
  echo "GET /: skipped (no server)"
  echo ""
  echo "Server state preserved: n/a"
  exit 0
fi

echo "Listener: PRESENT"
echo "$LISTENER_LINE" | head -1
echo ""

# Extract PID
PID=$(echo "$LISTENER_LINE" | awk 'NR==2 {print $2}')
if [ -z "$PID" ]; then
  PID=$(echo "$LISTENER_LINE" | awk 'NR>1 {print $2; exit}')
fi

if [ -n "$PID" ]; then
  echo "PID: ${PID}"
  # Show process details
  ps -p "$PID" -o pid,ppid,command 2>/dev/null || true
else
  echo "PID: (could not extract)"
fi
echo ""

# GET /
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${URL}/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "GET /: 200 OK"
else
  echo "GET /: ${HTTP_CODE} (expected 200)"
fi

echo ""
echo "Server state preserved: checked (see above)"
