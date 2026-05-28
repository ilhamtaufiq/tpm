#!/usr/bin/env bash

set -euo pipefail

# TPM local development setup for Lubuntu / Ubuntu-based Linux.
# This script intentionally uses native local services, not Docker.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

NODE_VERSION="${NODE_VERSION:-20}"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"
DB_NAME="${DB_NAME:-tpm_db}"
DB_USER="${DB_USER:-tpm_dev}"
DB_PASSWORD="${DB_PASSWORD:-toor}"

log() {
  printf '\n\033[1;34m==>\033[0m %s\n' "$1"
}

warn() {
  printf '\n\033[1;33mWARNING:\033[0m %s\n' "$1"
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Required file not found: $1" >&2
    exit 1
  fi
}

require_dir() {
  if [[ ! -d "$1" ]]; then
    echo "Required directory not found: $1" >&2
    exit 1
  fi
}

require_dir "$BACKEND_DIR"
require_dir "$FRONTEND_DIR"
require_file "$BACKEND_DIR/requirements.txt"
require_file "$BACKEND_DIR/.env.example"
require_file "$FRONTEND_DIR/package.json"

log "Installing system packages"
sudo apt update
sudo apt install -y \
  git curl build-essential pkg-config \
  python3 python3-pip \
  default-libmysqlclient-dev \
  mysql-server

log "Ensuring MySQL service is enabled and running"
sudo systemctl enable --now mysql

log "Creating local MySQL database and development user"
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost'
  IDENTIFIED BY '${DB_PASSWORD}';

ALTER USER '${DB_USER}'@'localhost'
  IDENTIFIED BY '${DB_PASSWORD}';

GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

log "Installing nvm if needed"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
mkdir -p "$NVM_DIR"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"

log "Installing and selecting Node.js ${NODE_VERSION}"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

log "Installing uv if needed"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

log "Ensuring project Python ${PYTHON_VERSION} is available"
uv python install "$PYTHON_VERSION"

log "Preparing backend virtual environment with Python ${PYTHON_VERSION}"
cd "$BACKEND_DIR"
if [[ -d venv ]]; then
  EXISTING_PYTHON_VERSION="$(venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
  if [[ "$EXISTING_PYTHON_VERSION" != "$PYTHON_VERSION" ]]; then
    warn "Existing backend/venv uses Python ${EXISTING_PYTHON_VERSION:-unknown}; recreating it with Python ${PYTHON_VERSION}."
    rm -rf venv
  fi
fi

if [[ ! -d venv ]]; then
  uv venv --python "$PYTHON_VERSION" venv
fi

# shellcheck disable=SC1091
source venv/bin/activate
uv pip install --python venv/bin/python -r requirements.txt

log "Writing backend/.env for local development"
if [[ ! -f .env ]]; then
  cp .env.example .env
fi

python3 - <<PY
from pathlib import Path

env_path = Path(".env")
updates = {
    "DB_HOST": "localhost",
    "DB_PORT": "3306",
    "DB_NAME": "${DB_NAME}",
    "DB_USER": "${DB_USER}",
    "DB_PASSWORD": "${DB_PASSWORD}",
    "UPLOAD_DIR": "local_uploads",
    "CORS_ORIGINS": "http://localhost:3000,http://localhost:5173,http://localhost:8081,http://127.0.0.1:3000,http://127.0.0.1:8081",
}

lines = env_path.read_text().splitlines()
seen = set()
new_lines = []

for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        key, _, _ = line.partition("=")
        if key in updates:
            new_lines.append(f"{key}={updates[key]}")
            seen.add(key)
            continue
    new_lines.append(line)

for key, value in updates.items():
    if key not in seen:
        new_lines.append(f"{key}={value}")

env_path.write_text("\n".join(new_lines) + "\n")
PY

log "Running backend database migrations"
mkdir -p local_uploads
alembic upgrade head

log "Seeding default users"
python seed_users.py

deactivate

log "Installing frontend dependencies"
cd "$FRONTEND_DIR"
npm install

log "Setup complete"
cat <<EOF

Local development environment is ready.

Backend:
  cd backend
  source venv/bin/activate
  uvicorn app.main:app --reload

Frontend:
  cd frontend
  npm run web

Database:
  name: ${DB_NAME}
  user: ${DB_USER}

Notes:
  - This workflow does not use Docker.
  - The backend virtual environment uses Python ${PYTHON_VERSION}
    even if the system default Python is newer.
  - If you do not want to keep the default local DB password,
    rerun this script with DB_PASSWORD set, for example:
      DB_PASSWORD='your-local-password' ./setup-local-lubuntu.sh
EOF
