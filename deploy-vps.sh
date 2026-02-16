#!/bin/bash
# Script Deploy TPM App di VPS (Tanpa Docker)
# Pastikan sudah install: Python 3.10+, Node.js 18+, Nginx, MySQL Server, Certbot (opsional)

# Set variable
APP_NAME="tpm-app"
PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}-backend.service"

# Warna Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function
log() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 1. Cek Root Privileges
if [ "$EUID" -ne 0 ]; then
  error "Harap jalankan sebagai root (gunakan sudo ./deploy-vps.sh)"
fi

# Dapatkan user asli yang menjalankan sudo
REAL_USER=${SUDO_USER:-$USER}
REAL_GROUP=$(id -gn $REAL_USER)

log "Memulai deployment untuk $APP_NAME..."
log "User sistem: $REAL_USER"
log "Root Project: $PROJECT_ROOT"

# 2. Setup Backend
log "Setup Backend..."

if [ ! -d "$BACKEND_DIR" ]; then
    error "Direktori backend tidak ditemukan di: $BACKEND_DIR"
fi

# Pastikan permission folder project milik user asli (agar tidak perlu sudo untuk tulis file)
chown -R $REAL_USER:$REAL_GROUP "$PROJECT_ROOT"

# Buat Virtual Environment jika belum ada
if [ ! -d "$BACKEND_DIR/venv" ]; then
    log "Membuat Python virtual environment..."
    # Pastikan python3-venv terinstall
    if ! dpkg -s python3-venv >/dev/null 2>&1; then
        warn "python3-venv belum terinstall. Menginstall..."
        apt-get update && apt-get install -y python3-venv
    fi
    sudo -u $REAL_USER python3 -m venv "$BACKEND_DIR/venv" || error "Gagal membuat venv. Pastikan python3-venv terinstall."
fi

# Install dependencies
log "Install dependencies backend..."
VENV_PIP="$BACKEND_DIR/venv/bin/pip"
VENV_ALEMBIC="$BACKEND_DIR/venv/bin/alembic"

if [ ! -f "$VENV_PIP" ]; then
    error "Pip tidak ditemukan di $VENV_PIP. Setup venv gagal."
fi

sudo -u $REAL_USER "$VENV_PIP" install --upgrade pip
sudo -u $REAL_USER "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt"
sudo -u $REAL_USER "$VENV_PIP" install gunicorn uvicorn

# Cek .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
    warn "File .env backend tidak ditemukan!"
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        log "Menyalin .env.example ke .env..."
        sudo -u $REAL_USER cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        warn "SILAHKAN EDIT FILE '$BACKEND_DIR/.env' SEKARANG DENGAN KREDENSIAL DATABASE ANDA."
        read -p "Tekan Enter setelah Anda mengedit file .env..."
    else
        error "Tidak ada file .env atau .env.example di direktori backend."
    fi
fi

# Jalankan Migrasi Database
log "Menjalankan migrasi database..."
cd "$BACKEND_DIR" || error "Gagal masuk direktori backend"
export PYTHONPATH=$BACKEND_DIR
# Cek apakah alembic terinstall
if [ ! -f "$VENV_ALEMBIC" ]; then
    error "Alembic tidak ditemukan. Install dependencies gagal?"
fi
sudo -u $REAL_USER "$VENV_ALEMBIC" upgrade head || error "Migrasi database gagal."

# Buat Systemd Service untuk Backend
log "Membuat service systemd..."
cat > "$SERVICE_FILE" <<EOL
[Unit]
Description=Gunicorn instance to serve $APP_NAME Backend
After=network.target

[Service]
User=$REAL_USER
Group=$REAL_GROUP
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin:/usr/bin:/usr/local/bin"
ExecStart=$BACKEND_DIR/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 3

[Install]
WantedBy=multi-user.target
EOL

# Reload dan Start Service
systemctl daemon-reload
systemctl enable "${APP_NAME}-backend"
systemctl restart "${APP_NAME}-backend"
log "Backend service berhasil disetup."

# 3. Setup Frontend
log "Setup Frontend..."
cd "$FRONTEND_DIR" || error "Direktori frontend tidak ditemukan"

# Cek Node.js & NPM
if ! command -v npm &> /dev/null; then
    warn "npm tidak ditemukan path root. Mencoba mencari di user path..."
    # Coba cari npm di path user jika pakai NVM atau instalasi custom
    NPM_PATH=$(runuser -l $REAL_USER -c 'which npm')
    NPX_PATH=$(runuser -l $REAL_USER -c 'which npx')
    
    if [ -z "$NPM_PATH" ]; then
         error "NPM tidak ditemukan. Harap install Node.js (v18+) terlebih dahulu."
    fi
else
    NPM_PATH=$(which npm)
    NPX_PATH=$(which npx)
fi

log "Menggunakan NPM: $NPM_PATH"

# Install Node dependencies
log "Install dependencies frontend..."
sudo -u $REAL_USER "$NPM_PATH" install || error "Gagal install npm dependencies."

# Build untuk Web
log "Building frontend (Expo Web)..."
sudo -u $REAL_USER "$NPX_PATH" expo export -p web || error "Gagal build frontend."

WEB_BUILD_DIR="$FRONTEND_DIR/dist"
if [ ! -d "$WEB_BUILD_DIR" ]; then
    error "Build frontend gagal. Folder 'dist' tidak ditemukan."
fi

# Pindahkan build ke /var/www/tpm-frontend untuk menghindari masalah permission
DEPLOY_DIR="/var/www/tpm-frontend"
log "Menyalin build ke $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
# Hapus isi lama jika ada
rm -rf "$DEPLOY_DIR"/*
# Copy isi baru
cp -r "$WEB_BUILD_DIR"/* "$DEPLOY_DIR" || error "Gagal menyalin file build."
chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

# 4. Setup Apache
read -p "Masukkan nama domain LOKAL untuk di VPS (contoh: tpm.test): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    DOMAIN_NAME="tpm.test"
    log "Menggunakan default domain: $DOMAIN_NAME"
fi

APACHE_CONF="/etc/apache2/sites-available/$APP_NAME.conf"

# Cek apakah Apache terinstall
if ! command -v apache2 &> /dev/null && ! command -v httpd &> /dev/null; then
    error "Apache tidak ditemukan. Harap install Apache (apache2) terlebih dahulu."
fi

log "Mengaktifkan module Apache yang dibutuhkan..."
a2enmod rewrite proxy proxy_http headers

log "Membuat konfigurasi VirtualHost Apache untuk $DOMAIN_NAME..."
cat > "$APACHE_CONF" <<EOL
<VirtualHost *:80>
    ServerName $DOMAIN_NAME
    DocumentRoot $DEPLOY_DIR

    <Directory $DEPLOY_DIR>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA Routing (React Router)
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy API Requests ke Backend (FastAPI)
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:8000/api
    ProxyPassReverse /api http://127.0.0.1:8000/api
    
    # Proxy Docs (Optional)
    ProxyPass /docs http://127.0.0.1:8000/docs
    ProxyPassReverse /docs http://127.0.0.1:8000/docs

    ProxyPass /openapi.json http://127.0.0.1:8000/openapi.json
    ProxyPassReverse /openapi.json http://127.0.0.1:8000/openapi.json

    ErrorLog \${APACHE_LOG_DIR}/$APP_NAME-error.log
    CustomLog \${APACHE_LOG_DIR}/$APP_NAME-access.log combined
</VirtualHost>
EOL

# Tambahkan host lokal ke /etc/hosts agar VPS mengenali tpm.test
if ! grep -q "$DOMAIN_NAME" /etc/hosts; then
    log "Menambahkan $DOMAIN_NAME ke /etc/hosts..."
    echo "127.0.0.1 $DOMAIN_NAME" >> /etc/hosts
fi

# Enable Site
log "Mengaktifkan situs..."
a2ensite "$APP_NAME.conf"

# Test Apache Config
apache2ctl configtest
if [ $? -eq 0 ]; then
    systemctl reload apache2
    log "Apache berhasil disetup. Aplikasi internal live di: http://$DOMAIN_NAME"
else
    error "Konfigurasi Apache tidak valid."
fi

# 5. SSL (Skip for .test)
if [[ "$DOMAIN_NAME" == *".test" ]]; then
    log "Skipping Certbot SSL setup karena domain .test tidak didukung Let's Encrypt."
else
    read -p "Apakah ingin setup SSL dengan Certbot? (y/n): " SSL_CHOICE
    if [[ "$SSL_CHOICE" == "y" || "$SSL_CHOICE" == "Y" ]]; then
        if command -v certbot &> /dev/null; then
            certbot --apache -d "$DOMAIN_NAME"
        else
            warn "Certbot tidak ditemukan. Lewati setup SSL."
        fi
    fi
fi



log "Deployment Selesai!"
