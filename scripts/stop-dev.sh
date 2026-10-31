#!/usr/bin/env bash
set -e

PORT="${PORT:-3000}"

# Gather PIDs listening on the specified port
PIDS=""
if command -v lsof >/dev/null 2>&1; then
  PORT_PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PORT_PIDS" ]; then
    PIDS="$PIDS $PORT_PIDS"
  fi
elif command -v fuser >/dev/null 2>&1; then
  PORT_PIDS=$(fuser "$PORT"/tcp 2>/dev/null || true)
  if [ -n "$PORT_PIDS" ]; then
    PIDS="$PIDS $PORT_PIDS"
  fi
fi

# Also check for any next dev processes in this project directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_PIDS=$(pgrep -f "node.*${PROJECT_ROOT}.*next.*dev" 2>/dev/null || true)
if [ -n "$DEV_PIDS" ]; then
  PIDS="$PIDS $DEV_PIDS"
fi

# Trim whitespace and deduplicate PIDs
PIDS=$(echo "$PIDS" | tr ' ' '\n' | grep -v '^$' | sort -u || true)

if [ -z "$PIDS" ]; then
  echo "No dev server running on port $PORT."
  exit 0
fi

echo "Stopping process(es): $PIDS..."
kill $PIDS 2>/dev/null || true

# Wait up to 3 seconds for graceful shutdown
STILL_RUNNING=""
for i in 1 2 3; do
  STILL_RUNNING=""
  for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      STILL_RUNNING="$STILL_RUNNING $pid"
    fi
  done
  if [ -z "$STILL_RUNNING" ]; then
    break
  fi
  sleep 1
done

# Force kill any lingering processes if still alive
if [ -n "$STILL_RUNNING" ]; then
  echo "Force stopping lingering process(es): $STILL_RUNNING..."
  kill -9 $STILL_RUNNING 2>/dev/null || true
fi

echo "Dev server stopped successfully."
