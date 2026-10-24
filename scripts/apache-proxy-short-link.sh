#!/usr/bin/env bash
# Menambahkan proxy /s/ (link pendek struk) ke vhost Apache yang sudah memakai proxy /api.
#
# Yang dilakukan:
#   1. Mencari file vhost Apache yang punya "ProxyPass /api" di SITES_DIR.
#   2. Menyisipkan ProxyPass /s/ dan ProxyPassReverse /s/ tepat setelah
#      ProxyPassReverse /api (berlaku untuk vhost :80 dan HTTPS yang ada di file yang sama).
#   3. Membuat cadangan setiap file sebelum diubah, menjalankan configtest,
#      lalu reload Apache. Kalau configtest gagal, cadangan dikembalikan.
#
# Idempoten: file yang sudah punya "ProxyPass /s/" dilewati.
#
# Pemakaian (di VPS, sebagai root):
#   sudo bash scripts/apache-proxy-short-link.sh
#   sudo DRY_RUN=1 bash scripts/apache-proxy-short-link.sh          # hanya tampilkan rencana
#   sudo RESTART_BACKEND=1 bash scripts/apache-proxy-short-link.sh  # juga restart backend + migrasi
#
# Variabel yang bisa diubah lewat environment:
#   SITES_DIR, BACKEND_URL, APP_NAME, BACKEND_DIR, DOMAIN, DRY_RUN, RESTART_BACKEND

set -euo pipefail

SITES_DIR="${SITES_DIR:-/etc/apache2/sites-available}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
APP_NAME="${APP_NAME:-tpm-app}"
BACKEND_DIR="${BACKEND_DIR:-/opt/tpm/backend}"
DOMAIN="${DOMAIN:-tpm.cianjur.space}"
DRY_RUN="${DRY_RUN:-0}"
RESTART_BACKEND="${RESTART_BACKEND:-0}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

if [[ $EUID -ne 0 ]]; then
    echo "Jalankan sebagai root (sudo)." >&2
    exit 1
fi

if ! command -v apache2ctl >/dev/null 2>&1; then
    echo "apache2ctl tidak ditemukan. Pastikan Apache terpasang." >&2
    exit 1
fi

if [[ ! -d "$SITES_DIR" ]]; then
    echo "Folder $SITES_DIR tidak ada. Atur SITES_DIR." >&2
    exit 1
fi

# File vhost yang memuat proxy /api. Spasi setelah "/api" supaya /api/v1/realtime/ws tidak ikut.
mapfile -t FILES < <(grep -l -E "^[[:space:]]*ProxyPass[[:space:]]+/api[[:space:]]" "$SITES_DIR"/*.conf 2>/dev/null || true)

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "Tidak ada vhost di $SITES_DIR yang punya 'ProxyPass /api'. Tidak ada yang diubah." >&2
    exit 1
fi

CADANGAN=()
DIUBAH=0

for file in "${FILES[@]}"; do
    log "Memeriksa $file"

    if grep -q -E "^[[:space:]]*ProxyPass[[:space:]]+/s/" "$file"; then
        log "  Sudah ada ProxyPass /s/, dilewati."
        continue
    fi

    if ! grep -q -E "^[[:space:]]*ProxyPassReverse[[:space:]]+/api[[:space:]]" "$file"; then
        log "  Tidak ada ProxyPassReverse /api, dilewati. Tambahkan proxy /s/ secara manual."
        continue
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        log "  [DRY_RUN] Akan menambahkan ProxyPass /s/ setelah ProxyPassReverse /api."
        continue
    fi

    cadangan="$file.bak-$(date +%Y%m%d%H%M%S)"
    cp -p "$file" "$cadangan"
    CADANGAN+=("$file|$cadangan")
    log "  Cadangan: $cadangan"

    # Sisipkan setelah setiap ProxyPassReverse /api (satu blok per vhost di file itu).
    sed -i -E \
        "/^[[:space:]]*ProxyPassReverse[[:space:]]+\/api[[:space:]]/a\\
    # Link pendek struk (/s/{kode}): halamannya dilayani backend (tag OG untuk pratinjau chat)\\
    ProxyPass /s/ ${BACKEND_URL}/s/\\
    ProxyPassReverse /s/ ${BACKEND_URL}/s/" \
        "$file"

    DIUBAH=$((DIUBAH + 1))
    log "  ProxyPass /s/ ditambahkan."
done

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN selesai. Tidak ada file yang diubah."
    exit 0
fi

if [[ "$DIUBAH" -eq 0 ]]; then
    log "Tidak ada file yang perlu diubah."
else
    log "Menjalankan configtest Apache..."
    if ! apache2ctl configtest; then
        log "configtest gagal. Mengembalikan cadangan."
        for pasangan in "${CADANGAN[@]}"; do
            asli="${pasangan%%|*}"
            bak="${pasangan##*|}"
            cp -p "$bak" "$asli"
            log "  Dikembalikan: $asli"
        done
        exit 1
    fi

    log "Reload Apache..."
    systemctl reload apache2
    log "Apache sudah di-reload."
fi

if [[ "$RESTART_BACKEND" == "1" ]]; then
    log "Restart backend ${APP_NAME}-backend..."
    systemctl restart "${APP_NAME}-backend"

    if [[ -x "$BACKEND_DIR/venv/bin/alembic" ]]; then
        log "Menjalankan migrasi (alembic upgrade head)..."
        (cd "$BACKEND_DIR" && "$BACKEND_DIR/venv/bin/alembic" upgrade head)
    else
        log "alembic tidak ditemukan di $BACKEND_DIR/venv/bin. Jalankan migrasi manual."
    fi
fi

log "Cek cepat (harus memuat og:image):"
log "  curl -s https://$DOMAIN/s/<kode> | grep og:image"
