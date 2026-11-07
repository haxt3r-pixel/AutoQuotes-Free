#!/usr/bin/env bash
# AutoQuotes Free Linux Launcher
# Starts the server (if not running) and opens the app in Chrome.
# When the browser tab closes, the server shuts down automatically.

set -euo pipefail

# Ensure Node.js binaries are on PATH (desktop launchers don't inherit shell PATH)
export PATH="$HOME/.local/share/pi-node/node-v22.23.1-linux-x64/bin:$HOME/.nvm/versions/node/*/bin:$PATH"

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_KEY="$(printf '%s' "$PROJECT_DIR" | cksum | cut -d' ' -f1)"
APP_URL="http://127.0.0.1:3000"
PID_FILE="${TMPDIR:-/tmp}/autoquote-${PROJECT_KEY}.pid"
LOG_FILE="${TMPDIR:-/tmp}/autoquote-${PROJECT_KEY}.log"

open_browser() {
  if command -v google-chrome >/dev/null 2>&1; then
    google-chrome --new-window "$APP_URL" &>/dev/null &
  elif command -v chromium-browser >/dev/null 2>&1; then
    chromium-browser --new-window "$APP_URL" &>/dev/null &
  elif command -v chromium >/dev/null 2>&1; then
    chromium --new-window "$APP_URL" &>/dev/null &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL" &>/dev/null &
  else
    echo "No browser found. Open $APP_URL manually."
  fi
}

# ── If server is already running ──
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Server already running (PID $PID). Opening browser..."
    open_browser
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# ── Check if anything is already on port 3000 ──
if ss -tlnp 2>/dev/null | grep -qE ':3000\s'; then
  echo "Port 3000 is in use. Stop the other application before launching this copy."
  exit 1
fi

# ── Start the server (auto-shutdown when the UI tab closes) ──
echo "Starting AutoQuotes Free server..."
cd "$PROJECT_DIR" || exit 1

export AUTO_SHUTDOWN=1
export AUTOQUOTE_PID_FILE="$PID_FILE"
export HOST=127.0.0.1
export PORT=3000

# Prefer built server when available; fall back to tsx for source runs.
if [ -f "$PROJECT_DIR/dist/main.js" ]; then
  node "$PROJECT_DIR/dist/main.js" > "$LOG_FILE" 2>&1 &
else
  npx tsx src/main.ts > "$LOG_FILE" 2>&1 &
fi
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# ── Wait for server to be ready ──
echo -n "Waiting for server"
for _ in $(seq 1 40); do
  if curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/health" | grep -q 200; then
    echo " ready!"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "Server exited early. See $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 0.5
  echo -n "."
done
echo ""

# ── Open Chrome ──
echo "Launching browser..."
open_browser
echo "Done. Close the app tab to stop the server automatically."
