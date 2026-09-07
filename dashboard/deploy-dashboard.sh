#!/bin/bash
# Script Deploy Dashboard TPM di VPS (Tanpa Docker)
# Subdomain terpisah, static build Vite + Apache.
# Jalankan dari root repo: sudo ./dashboard/deploy-dashboard.sh

APP_NAME="tpm-dashboard"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASHBOARD_DIR="$PROJECT_ROOT/dashboard"
DEPLOY_DIR="/var/www/tpm-dashboard"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then error "Harap jalankan sebagai root (gunakan sudo ./dashboard/deploy-dashboard.sh)"; fi

REAL_USER=${SUDO_USER:-$USER}
REAL_GROUP=$(id -gn $REAL_USER)

log "Deploy dashboard dari $DASHBOARD_DIR ..."
[ -d "$DASHBOARD_DIR" ] || error "Dir dashboard tidak ada: $DASHBOARD_DIR"

# 1. Domain (untuk bake API URL ke build Vite)
read -p "Masukkan domain dashboard (contoh: dashboard.tpm.test): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    DOMAIN_NAME="dashboard.test"
    log "Menggunakan default domain: $DOMAIN_NAME"
fi

if [[ "$DOMAIN_NAME" == *".test" ]]; then
    API_URL="http://$DOMAIN_NAME/api/v1"
    WS_URL="ws://$DOMAIN_NAME/api/v1"
else
    API_URL="https://$DOMAIN_NAME/api/v1"
    WS_URL="wss://$DOMAIN_NAME/api/v1"
fi

# 2. Cari NPM (NVM support)
if command -v npm &> /dev/null; then
    NPM_PATH=$(which npm)
else
    NPM_PATH=$(runuser -l $REAL_USER -c 'which npm')
fi
[ -z "$NPM_PATH" ] && error "NPM tidak ditemukan"

cd "$DASHBOARD_DIR"

# 3. Bake API URL (Vite embed env saat build; .env.production dipakai ulang oleh update-dashboard.sh)
log "Menulis .env.production ($API_URL)..."
sudo -u $REAL_USER tee .env.production > /dev/null <<EOL
VITE_API_BASE_URL=$API_URL
VITE_WS_BASE_URL=$WS_URL
EOL

log "npm install..."
sudo -u $REAL_USER "$NPM_PATH" install || error "npm install gagal"

log "Building dashboard..."
sudo -u $REAL_USER "$NPM_PATH" run build || error "Build gagal"

# 4. Copy dist
if [ -d "dist" ]; then
    log "Menyalin build ke $DEPLOY_DIR..."
    mkdir -p "$DEPLOY_DIR"
    find "$DEPLOY_DIR" -mindepth 1 -exec rm -rf {} +
    cp -r dist/* "$DEPLOY_DIR"/

    chown -R www-data:www-data "$DEPLOY_DIR"
    chmod -R 755 "$DEPLOY_DIR"
else
    error "Folder dist tidak ditemukan"
fi

# 5. Setup Apache
if ! command -v apache2 &> /dev/null; then
    error "Apache tidak ditemukan. Harap install Apache (apache2) terlebih dahulu."
fi

log "Mengaktifkan module Apache yang dibutuhkan..."
a2enmod rewrite proxy proxy_http proxy_wstunnel headers

APACHE_CONF="/etc/apache2/sites-available/$APP_NAME.conf"

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
        RewriteRule ^index\\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy API Requests ke Backend (FastAPI)
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 86400

    # WebSocket realtime endpoint harus diproxy sebagai ws:// agar upgrade jalan
    ProxyPass /api/v1/realtime/ws ws://127.0.0.1:8000/api/v1/realtime/ws retry=0
    ProxyPassReverse /api/v1/realtime/ws ws://127.0.0.1:8000/api/v1/realtime/ws

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

# Hanya untuk .test (resolusi lokal). Domain publik JANGAN ditulis ke
# /etc/hosts — menimpa DNS publik dengan 127.0.0.1 dan merusak certbot/curl.
if [[ "$DOMAIN_NAME" == *".test" ]]; then
    if ! grep -q "$DOMAIN_NAME" /etc/hosts; then
        log "Menambahkan $DOMAIN_NAME ke /etc/hosts..."
        echo "127.0.0.1 $DOMAIN_NAME" >> /etc/hosts
    fi
fi

log "Mengaktifkan situs..."
a2ensite "$APP_NAME.conf"

apache2ctl configtest
if [ $? -eq 0 ]; then
    systemctl reload apache2
    log "Dashboard live di: http://$DOMAIN_NAME"
else
    error "Konfigurasi Apache tidak valid."
fi

# 6. SSL (Skip for .test)
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
