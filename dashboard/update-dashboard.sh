#!/bin/bash
# Script Auto Update untuk Dashboard TPM
# Hanya update dashboard (git pull + rebuild). Backend/frontend tidak tersentuh.
# API URL diambil dari .env.production yang dibuat saat deploy (tidak ditanya ulang).
# Jalankan dari root repo: sudo ./dashboard/update-dashboard.sh

APP_NAME="tpm-dashboard"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASHBOARD_DIR="$PROJECT_ROOT/dashboard"
DEPLOY_DIR="/var/www/tpm-dashboard"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[UPDATE]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then error "Harap jalankan sebagai root (gunakan sudo ./dashboard/update-dashboard.sh)"; fi

REAL_USER=${SUDO_USER:-$USER}
REAL_GROUP=$(id -gn $REAL_USER)

log "Memulai update dashboard..."
log "User: $REAL_USER | Root: $PROJECT_ROOT"

# 1. Pull kode terbaru
log "Menarik kode terbaru dari Git..."
sudo -u $REAL_USER git -C "$PROJECT_ROOT" pull origin main || error "Gagal git pull"

[ -d "$DASHBOARD_DIR" ] || error "Dir dashboard tidak ada: $DASHBOARD_DIR"
cd "$DASHBOARD_DIR"

# 2. Discovery: cari npx agresif (NVM support)
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
    echo -e "${RED}[ERROR]${NC} npx tidak ditemukan untuk user $REAL_USER."
    exit 1
fi
NPM_BIN="$(dirname "$NPX_BIN")/npm"

# 3. Install + rebuild (Vite baca ulang .env.production dari deploy)
log "npm install..."
sudo -u $REAL_USER "$NPM_BIN" install || error "npm install gagal"

log "Rebuilding dashboard..."
sudo -u $REAL_USER "$NPM_BIN" run build || error "Build gagal. Check log di atas."

# 4. Deploy (dashboard statis, tidak ada uploads dan tidak ada service yang perlu direstart)
log "Deploying ke $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
find "$DEPLOY_DIR" -mindepth 1 -exec rm -rf {} +
cp -r dist/* "$DEPLOY_DIR"/

chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

log "Update Selesai!"
