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
    export CI=true
    prefix="[BACKEND]"
    echo -e "${GREEN}$prefix${NC} Memproses update backend..."
    cd "$BACKEND_DIR"
    
    # Update Python dependencies
    echo -e "${YELLOW}$prefix${NC} Updating Python dependencies..."
    sudo -u $REAL_USER "$BACKEND_DIR/venv/bin/pip" install -r "requirements.txt" || { echo -e "${RED}$prefix ERROR${NC} Pip install failed"; exit 1; }

    # Jalankan Migrasi DB (Pindah ke folder backend agar alembic.ini terbaca)
    echo -e "${YELLOW}$prefix${NC} Menjalankan migrasi database..."
    export PYTHONPATH="$BACKEND_DIR"
    
    # Cek jika ada multiple heads dan gabungkan otomatis
    NUM_HEADS=$("$BACKEND_DIR/venv/bin/python" -m alembic heads | grep -c "(head)")
    # Fallback jika grep -c (head) tidak akurat (beberapa versi alembic beda format)
    if [ "$NUM_HEADS" -eq 0 ]; then
        NUM_HEADS=$("$BACKEND_DIR/venv/bin/python" -m alembic heads | grep -v "INFO" | grep -v "Context" | wc -l)
    fi

    if [ "$NUM_HEADS" -gt 1 ]; then
        echo -e "${YELLOW}$prefix WARNING${NC} Terdeteksi multiple heads ($NUM_HEADS). Melakukan merge otomatis..."
        "$BACKEND_DIR/venv/bin/python" -m alembic merge -m "auto merge remote heads" heads || { echo -e "${RED}$prefix ERROR${NC} Auto merge gagal"; exit 1; }
    fi

    MIGRATION_OUT=$("$BACKEND_DIR/venv/bin/python" -m alembic upgrade head 2>&1)
    if [ $? -ne 0 ]; then

        echo "$MIGRATION_OUT" > "$BACKEND_DIR/migration_error.log"
        echo -e "${RED}$prefix ERROR${NC} Migrasi gagal!"
        echo -e "${YELLOW}$prefix LOGS:${NC}"
        echo "$MIGRATION_OUT" | tail -n 10
        echo -e "${RED}$prefix${NC} Log lengkap tersimpan di: $BACKEND_DIR/migration_error.log"
        exit 1
    fi

    # Restart Service Backend
    echo -e "${GREEN}$prefix${NC} Restarting Gunicorn Service..."
    systemctl restart "${APP_NAME}-backend"
    
    # Permission & Symlink fix for uploads
    echo -e "${YELLOW}$prefix${NC} Setting up uploads symlink to /var/www/tpm-frontend/uploads..."
    UPLOADS_DEST="/var/www/tpm-frontend/uploads"
    
    # Buat folder fisik di frontend deployment jika belum ada
    mkdir -p "$UPLOADS_DEST"
    chown -R $REAL_USER:www-data "$UPLOADS_DEST"
    chmod -R 775 "$UPLOADS_DEST"

    # Jika folder uploads di backend adalah folder asli (bukan symlink), pindahkan isinya dan ganti jadi symlink
    if [ -d "$BACKEND_DIR/uploads" ] && [ ! -L "$BACKEND_DIR/uploads" ]; then
        echo -e "${YELLOW}$prefix${NC} Moving existing uploads to $UPLOADS_DEST..."
        cp -rn "$BACKEND_DIR/uploads"/. "$UPLOADS_DEST/" 2>/dev/null
        rm -rf "$BACKEND_DIR/uploads"
    fi

    # Buat symlink
    ln -sfn "$UPLOADS_DEST" "$BACKEND_DIR/uploads"
    chown -h $REAL_USER:$REAL_GROUP "$BACKEND_DIR/uploads"
    
    # Fix ownership in case root created some files during migration
    chown -R $REAL_USER:$REAL_GROUP "$BACKEND_DIR"
    
    echo -e "${GREEN}$prefix${NC} Backend updated & restarted."
) &
PID_BACKEND=$!

(
    export CI=true
    prefix="[FRONTEND]"
    echo -e "${GREEN}$prefix${NC} Memproses update frontend..."
    cd "$FRONTEND_DIR"
    
    # Rebuild Expo Web using runuser to ensure NVM/Node environment is loaded
    echo -e "${GREEN}$prefix${NC} Rebuilding Expo Web (This may take a few minutes)..."
    runuser -l $REAL_USER -c "cd $FRONTEND_DIR && npx expo export -p web --non-interactive" || { 
        echo -e "${RED}$prefix ERROR${NC} Build failed. Check logs above."; 
        exit 1; 
    }

    # Deploy
    echo -e "${GREEN}$prefix${NC} Deploying to web server..."
    mkdir -p "$DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR/uploads" # Pastikan uploads ada

    # Hapus isi lama KECUALI folder uploads agar foto tidak hilang
    echo -e "${YELLOW}$prefix${NC} Cleaning old files (preserving uploads)..."
    find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {} +
    
    # Copy isi baru
    cp -r "$FRONTEND_DIR/dist"/* "$DEPLOY_DIR"
    
    # Atur izin: Folder umum untuk www-data, folder uploads untuk backend user
    chown -R www-data:www-data "$DEPLOY_DIR"
    chown -R $REAL_USER:www-data "$DEPLOY_DIR/uploads"
    chmod -R 755 "$DEPLOY_DIR"
    chmod -R 775 "$DEPLOY_DIR/uploads"
    
    echo -e "${GREEN}$prefix${NC} Frontend updated & deployed."
) &
PID_FRONTEND=$!

# Tunggu kedua proses selesai
wait $PID_BACKEND
wait $PID_FRONTEND

log "Update Selesai!"
