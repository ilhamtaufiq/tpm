#!/usr/bin/env bash

set -euo pipefail

# Start TPM local development services without Docker.
# Backend and frontend are launched together, and both are stopped on Ctrl+C.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

BACKEND_PID=""
FRONTEND_PID=""

log() {
  printf '\n\033[1;34m==>\033[0m %s\n' "$1"
}

cleanup() {
  printf '\n'
  log "Stopping local development services"

  if [[ -n "${BACKEND_PID}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if [[ ! -d "$BACKEND_DIR/venv" ]]; then
  echo "Backend virtual environment not found at backend/venv." >&2
  echo "Run ./setup-local-lubuntu.sh first." >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Frontend dependencies not found at frontend/node_modules." >&2
  echo "Run ./setup-local-lubuntu.sh first." >&2
  exit 1
fi

log "Starting backend on http://localhost:8000"
(
  cd "$BACKEND_DIR"
  # shellcheck disable=SC1091
  source venv/bin/activate
  exec uvicorn app.main:app --reload
) &
BACKEND_PID=$!

log "Starting frontend web dev server"
(
  cd "$FRONTEND_DIR"
  exec npm run web
) &
FRONTEND_PID=$!

cat <<'EOF'

Local development services are running.

Backend:
  http://localhost:8000
  http://localhost:8000/docs

Frontend:
  Web dev server is starting in this terminal.

Press Ctrl+C to stop both services.
EOF

wait -n "$BACKEND_PID" "$FRONTEND_PID"
