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
    echo -e "${YELLOW}$prefix${NC} Checking virtual environment..."
    
    # Recreate venv if it's invalid (e.g. was copied from Windows with 'Scripts' instead of 'bin')
    if [ -d "venv" ] && [ ! -f "venv/bin/pip" ]; then
        echo -e "${YELLOW}$prefix${NC} Found invalid venv (possibly from Windows). Recreating..."
        rm -rf venv
    fi

    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}$prefix${NC} Creating new virtual environment..."
        sudo -u $REAL_USER python3 -m venv venv || {
            echo -e "${RED}$prefix ERROR${NC} Gagal membuat venv."
            echo -e "${YELLOW}Solusi:${NC} Jalankan 'sudo apt update && sudo apt install -y python3-venv' di server."
            exit 1
        }
    fi

    echo -e "${YELLOW}$prefix${NC} Updating Python dependencies..."
    sudo -u $REAL_USER ./venv/bin/pip install --upgrade pip --break-system-packages
    sudo -u $REAL_USER ./venv/bin/pip install -r "requirements.txt" --break-system-packages || { echo -e "${RED}$prefix ERROR${NC} Pip install failed"; exit 1; }

    # Jalankan Migrasi DB
    echo -e "${YELLOW}$prefix${NC} Menjalankan migrasi database..."
    export PYTHONPATH=$PROJECT_ROOT:$BACKEND_DIR
    
    # Jalankan alembic upgrade head
    if sudo -u $REAL_USER bash -c "export PYTHONPATH=$PROJECT_ROOT:$BACKEND_DIR; cd $BACKEND_DIR && ./venv/bin/alembic upgrade head"; then
        echo -e "${GREEN}$prefix${NC} Migrasi DB Sukses!"
    else
        echo -e "${RED}$prefix ERROR${NC} Migrasi DB gagal."
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
    
    # Discovery logic: Mencari npx dengan lebih agresif (NVM support)
    FIND_NPX_CMD='
        if command -v npx &>/dev/null; then 
            which npx
        elif [ -f "$HOME/.nvm/nvm.sh" ]; then 
            source "$HOME/.nvm/nvm.sh" && which npx
        elif [ -f "/usr/local/bin/npx" ]; then echo "/usr/local/bin/npx"
        elif [ -f "/usr/bin/npx" ]; then echo "/usr/bin/npx"
        fi
    '
    NPX_BIN=$(runuser -l $REAL_USER -c "$FIND_NPX_CMD")
    
    if [ -z "$NPX_BIN" ]; then
        echo -e "${RED}$prefix ERROR${NC} npx tidak ditemukan untuk user $REAL_USER."
        echo -e "${YELLOW}Debug PATH:${NC} $(runuser -l $REAL_USER -c 'echo $PATH')"
        exit 1
    fi

    # Rebuild Expo Web
    echo -e "${GREEN}$prefix${NC} Rebuilding Expo Web using $NPX_BIN..."
    runuser -l $REAL_USER -c "cd $FRONTEND_DIR && $NPX_BIN expo export -p web --non-interactive" || { 
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

# Tunggu kedua proses selesai dan cek exit code
wait $PID_BACKEND
STATUS_BACKEND=$?
wait $PID_FRONTEND
STATUS_FRONTEND=$?

if [ $STATUS_BACKEND -ne 0 ] || [ $STATUS_FRONTEND -ne 0 ]; then
    echo -e "${RED}---------------------------------------${NC}"
    error "Update GAGAL. Periksa log di atas untuk detail kesalahan."
fi

log "Update Selesai!"
