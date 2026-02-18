#!/bin/bash
# Script Deploy TPM App di VPS (Tanpa Docker)
# Pastikan sudah install: Python 3.10+, Node.js 18+, Nginx/Apache, MySQL Server

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

# ==========================================
# PARALLEL EXECUTION: BACKEND & FRONTEND
# ==========================================

log "Memulai proses instalasi Backend & Frontend secara paralel..."

(
    prefix="[BACKEND]"
    echo -e "${GREEN}$prefix${NC} Memulai setup backend..."
    
    # Symlink uploads fix
    UPLOADS_DEST="/var/www/tpm-frontend/uploads"
    mkdir -p "$UPLOADS_DEST"
    chown -R $REAL_USER:www-data "$UPLOADS_DEST"
    chmod -R 775 "$UPLOADS_DEST"

    # Buat symlink di backend
    if [ ! -L "$BACKEND_DIR/uploads" ]; then
        rm -rf "$BACKEND_DIR/uploads"
        ln -sfn "$UPLOADS_DEST" "$BACKEND_DIR/uploads"
        chown -h $REAL_USER:$REAL_GROUP "$BACKEND_DIR/uploads"
    fi

    chown -R $REAL_USER:$REAL_GROUP "$BACKEND_DIR"

    # Buat Virtual Environment jika belum ada
    if [ -d "$BACKEND_DIR/venv" ]; then
        echo -e "${GREEN}$prefix${NC} Menggunakan venv yang sudah ada..."
    else
        # Cek dependency sistem
        if ! dpkg -s python3-venv pkg-config default-libmysqlclient-dev >/dev/null 2>&1; then
            echo -e "${YELLOW}$prefix${NC} Menginstall system dependencies..."
            apt-get update -qq && apt-get install -y python3-venv python3-dev pkg-config default-libmysqlclient-dev build-essential
        fi
        
        # Create venv
        sudo -u $REAL_USER python3 -m venv "$BACKEND_DIR/venv" || { echo -e "${RED}$prefix ERROR${NC} Gagal buat venv"; exit 1; }
    fi

    # Variables
    VENV_PIP="$BACKEND_DIR/venv/bin/pip"
    VENV_ALEMBIC="$BACKEND_DIR/venv/bin/alembic"
    
    # Install pip packages (COMMENTED OUT AS REQUESTED)
    echo -e "${GREEN}$prefix${NC} Installing pip packages... (SKIPPED)"
    # sudo -u $REAL_USER "$VENV_PIP" install --upgrade pip >/dev/null
    # sudo -u $REAL_USER "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt" >/dev/null
    # sudo -u $REAL_USER "$VENV_PIP" install gunicorn uvicorn >/dev/null

    # Setup .env
    if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
        echo -e "${GREEN}$prefix${NC} Membuat .env dari example..."
        sudo -u $REAL_USER cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    fi

    # Migrasi DB
    echo -e "${GREEN}$prefix${NC} Menjalankan migrasi database..."
    export PYTHONPATH=$BACKEND_DIR
    sudo -u $REAL_USER "$VENV_ALEMBIC" upgrade head >/dev/null || { echo -e "${RED}$prefix ERROR${NC} Migrasi DB gagal"; exit 1; }

    # Setup Systemd
    echo -e "${GREEN}$prefix${NC} Membuat service systemd..."
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
    systemctl daemon-reload
    systemctl enable "${APP_NAME}-backend"
    systemctl restart "${APP_NAME}-backend"
    echo -e "${GREEN}$prefix${NC} Selesai!"
) &
PID_BACKEND=$!

(
    prefix="[FRONTEND]"
    echo -e "${GREEN}$prefix${NC} Memulai setup frontend..."

    if [ ! -d "$FRONTEND_DIR" ]; then echo -e "${RED}$prefix ERROR${NC} Dir frontend tidak ada"; exit 1; fi
    cd "$FRONTEND_DIR"

    # Cari NPM
    if command -v npm &> /dev/null; then
        NPM_PATH=$(which npm)
        NPX_PATH=$(which npx)
    else
        NPM_PATH=$(runuser -l $REAL_USER -c 'which npm')
        NPX_PATH=$(runuser -l $REAL_USER -c 'which npx')
    fi

    if [ -z "$NPM_PATH" ]; then
         echo -e "${RED}$prefix ERROR${NC} NPM tidak ditemukan"; exit 1;
    fi

    echo -e "${GREEN}$prefix${NC} npm install... (SKIPPED)"
    # sudo -u $REAL_USER "$NPM_PATH" install >/dev/null 2>&1 || { echo -e "${RED}$prefix ERROR${NC} npm install failed"; exit 1; }

    echo -e "${GREEN}$prefix${NC} Building Expo Web..."
    sudo -u $REAL_USER "$NPX_PATH" expo export -p web >/dev/null 2>&1 || { echo -e "${RED}$prefix ERROR${NC} Build failed"; exit 1; }

    # Copy Dist
    WEB_BUILD_DIR="$FRONTEND_DIR/dist"
    DEPLOY_DIR="/var/www/tpm-frontend"
    
    if [ -d "$WEB_BUILD_DIR" ]; then
        echo -e "${GREEN}$prefix${NC} Menyalin build ke $DEPLOY_DIR..."
        mkdir -p "$DEPLOY_DIR"
        mkdir -p "$DEPLOY_DIR/uploads"

        # Hapus file lama kecuali uploads
        find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {} +
        
        cp -r "$WEB_BUILD_DIR"/* "$DEPLOY_DIR"
        
        chown -R www-data:www-data "$DEPLOY_DIR"
        chown -R $REAL_USER:www-data "$DEPLOY_DIR/uploads"
        chmod -R 755 "$DEPLOY_DIR"
        chmod -R 775 "$DEPLOY_DIR/uploads"
    else
        echo -e "${RED}$prefix ERROR${NC} Folder dist tidak ditemukan"; exit 1;
    fi
    echo -e "${GREEN}$prefix${NC} Selesai!"
) &
PID_FRONTEND=$!

# Tunggu kedua proses selesai
wait $PID_BACKEND
BACKEND_STATUS=$?
wait $PID_FRONTEND
FRONTEND_STATUS=$?

if [ $BACKEND_STATUS -ne 0 ] || [ $FRONTEND_STATUS -ne 0 ]; then
    error "Salah satu proses (Backend/Frontend) gagal. Cek log di atas."
fi

log "Backend & Frontend setup selesai."

# Definisi ulang DEPLOY_DIR untuk script utama (karena subshell tidak mengekspor variabel)
DEPLOY_DIR="/var/www/tpm-frontend"

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
