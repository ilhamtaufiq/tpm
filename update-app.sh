#!/bin/bash
# Script Auto Update untuk TPM Super App
# Gunakan ini jika server SUDAH dideploy sebelumnya dan hanya ingin update kode.

APP_NAME="tpm-app"
# Ambil current directory saat script dijalankan
PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DEPLOY_DIR="/var/www/tpm-frontend"

# Warna Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Helpers
log() { echo -e "${GREEN}[UPDATE]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Cek apakah dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then error "Harap jalankan sebagai root (gunakan sudo ./update-app.sh)"; fi

# User Asli
REAL_USER=${SUDO_USER:-$USER}
REAL_GROUP=$(id -gn $REAL_USER)
VENV_PIP="$BACKEND_DIR/venv/bin/pip"
VENV_ALEMBIC="$BACKEND_DIR/venv/bin/alembic"

log "Memulai update aplikasi $APP_NAME..."
log "User: $REAL_USER | Root: $PROJECT_ROOT"

# 1. Pull Kode Terbaru dari Git
log "Menarik kode terbaru dari Git..."
sudo -u $REAL_USER git pull origin main || error "Gagal git pull"

# ============================
# PARALLEL UPDATE PROCESS
# ============================

(
    prefix="[BACKEND]"
    echo -e "${GREEN}$prefix${NC} Memproses update backend..."
    cd "$BACKEND_DIR"
    
    # Update Python dependencies
    echo -e "${YELLOW}$prefix${NC} Updating Python dependencies..."
    sudo -u $REAL_USER "$BACKEND_DIR/venv/bin/pip" install -r "requirements.txt" || { echo -e "${RED}$prefix ERROR${NC} Pip install failed"; exit 1; }

    # Jalankan Migrasi DB (Pindah ke folder backend agar alembic.ini terbaca)
    echo -e "${YELLOW}$prefix${NC} Menjalankan migrasi database..."
    export PYTHONPATH="$BACKEND_DIR"
    sudo -u $REAL_USER "$BACKEND_DIR/venv/bin/python" -m alembic upgrade head || { echo -e "${RED}$prefix ERROR${NC} Migrasi gagal"; exit 1; }

    # Restart Service Backend
    echo -e "${GREEN}$prefix${NC} Restarting Gunicorn Service..."
    systemctl restart "${APP_NAME}-backend"
    echo -e "${GREEN}$prefix${NC} Backend updated & restarted."
) &
PID_BACKEND=$!

(
    prefix="[FRONTEND]"
    echo -e "${GREEN}$prefix${NC} Memproses update frontend..."
    cd "$FRONTEND_DIR"
    
    # Cari executable NPM/NPX
    if command -v npm &> /dev/null; then
         NPM_PATH=$(which npm); NPX_PATH=$(which npx)
    else
         NPM_PATH=$(runuser -l $REAL_USER -c 'which npm'); NPX_PATH=$(runuser -l $REAL_USER -c 'which npx')
    fi

    # Update NPM dependencies (SKIPPED AS REQUESTED)
    # echo -e "${YELLOW}$prefix${NC} Updating NPM dependencies..."
    # sudo -u $REAL_USER "$NPM_PATH" install >/dev/null 2>&1 || { echo -e "${RED}$prefix ERROR${NC} NPM install failed"; exit 1; }

    # Rebuild Expo Web
    echo -e "${GREEN}$prefix${NC} Rebuilding Expo Web..."
    sudo -u $REAL_USER "$NPX_PATH" expo export -p web >/dev/null 2>&1 || { echo -e "${RED}$prefix ERROR${NC} Build failed"; exit 1; }

    # Deploy
    echo -e "${GREEN}$prefix${NC} Deploying to web server..."
    mkdir -p "$DEPLOY_DIR"
    # Hapus isi lama
    rm -rf "$DEPLOY_DIR"/*
    # Copy isi baru
    cp -r "$FRONTEND_DIR/dist"/* "$DEPLOY_DIR"
    chown -R www-data:www-data "$DEPLOY_DIR"
    chmod -R 755 "$DEPLOY_DIR"
    
    echo -e "${GREEN}$prefix${NC} Frontend updated & deployed."
) &
PID_FRONTEND=$!

# Tunggu kedua proses selesai
wait $PID_BACKEND
wait $PID_FRONTEND

log "Update Selesai!"
