#!/bin/bash

# Configuration
APP_NAME="tpm-app"
LOG_FILE="/var/log/cloudflare_setup.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[CLOUDFLARE]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

# Check Root
if [ "$EUID" -ne 0 ]; then error "Please run as root"; fi

# 1. Install Cloudflared
log "Checking Cloudflared installation..."
if ! command -v cloudflared &> /dev/null; then
    log "Installing Cloudflared..."
    # Add Cloudflare GPG key
    mkdir -p --mode=0755 /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

    # Add repo
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | tee /etc/apt/sources.list.d/cloudflared.list

    apt-get update && apt-get install cloudflared -y || error "Failed to install cloudflared"
else
    log "Cloudflared is already installed."
fi

# 2. Authenticate & Create Tunnel
log "=== Cloudflare Tunnel Setup ==="
echo "If you already have a tunnel credentials file (JSON), place it in /root/.cloudflared/"
echo "Otherwise, we need to authenticate."

if [ ! -d "/root/.cloudflared" ] || [ -z "$(ls -A /root/.cloudflared/*.json 2>/dev/null)" ]; then
    warn "No credentials found. Please authenticate via browser."
    cloudflared tunnel login || error "Login failed"
fi

# Create Tunnel
read -p "Enter a name for your tunnel (e.g., tpm-vpstunnel): " TUNNEL_NAME
if [ -z "$TUNNEL_NAME" ]; then error "Tunnel name required"; fi

log "Creating tunnel '$TUNNEL_NAME'..."
cloudflared tunnel create "$TUNNEL_NAME" || warn "Tunnel might already exist, continuing..."

# Get Tunnel ID (from JSON file that was just created/exists)
CREDS_FILE=$(find /root/.cloudflared -name "*.json" | head -n 1)
TUNNEL_ID=$(jq -r .TunnelID < "$CREDS_FILE")
log "Tunnel ID: $TUNNEL_ID"

# 3. Configure Tunnel (Ingress Rules)
read -p "Enter the PUBLIC domain/hostname to route (e.g., tpm.cianjur.space): " PUBLIC_DOMAIN
if [ -z "$PUBLIC_DOMAIN" ]; then error "Public domain name required"; fi

read -p "Enter the LOCAL domain configured in Apache (default: tpm.test): " LOCAL_DOMAIN
if [ -z "$LOCAL_DOMAIN" ]; then LOCAL_DOMAIN="tpm.test"; fi

log "Routing Public $PUBLIC_DOMAIN -> Local $LOCAL_DOMAIN (via Tunnel)..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$PUBLIC_DOMAIN"

CONFIG_DIR="/etc/cloudflared"
mkdir -p "$CONFIG_DIR"

log "Creating configuration file at $CONFIG_DIR/config.yml..."
cat > "$CONFIG_DIR/config.yml" <<EOL
tunnel: $TUNNEL_ID
credentials-file: $CREDS_FILE

ingress:
  - hostname: $PUBLIC_DOMAIN
    service: http://localhost:80
    originRequest:
      httpHostHeader: $LOCAL_DOMAIN
  - service: http_status:404
EOL

# 4. Install & Start Service
log "Installing Cloudflared system service..."
cloudflared service install || warn "Service might already be installed"

systemctl enable cloudflared
systemctl restart cloudflared

# 5. Configure Apache (Optional Security)
read -p "Do you want to restrict Apache to listen ONLY on localhost (Recommended for Tunnels)? (y/n): " RESTRICT_APACHE
if [[ "$RESTRICT_APACHE" == "y" || "$RESTRICT_APACHE" == "Y" ]]; then
    log "Configuring Apache ports..."
    sed -i 's/^Listen 80/Listen 127.0.0.1:80/' /etc/apache2/ports.conf
    # Also check sites-enabled for specific virtual hosts
    sed -i 's/<VirtualHost \*:80>/<VirtualHost 127.0.0.1:80>/' /etc/apache2/sites-enabled/*.conf
    
    systemctl restart apache2
    log "Apache is now listening on 127.0.0.1:80 only."
fi

log "Setup Complete! Check status with: systemctl status cloudflared"
