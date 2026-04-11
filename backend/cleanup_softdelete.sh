#!/bin/bash
# ============================================================
# cleanup_softdelete.sh
# Hapus permanen semua record soft-deleted (deleted_at IS NOT NULL)
# 
# Usage:
#   ./cleanup_softdelete.sh              # Interactive (konfirmasi)
#   ./cleanup_softdelete.sh --yes        # Skip konfirmasi
#   ./cleanup_softdelete.sh --dry        # Dry-run, hanya lihat jumlah
# ============================================================

set -euo pipefail

# ---- Konfigurasi Database (ambil dari .env atau set manual) ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -E '^(DB_|MYSQL_|DATABASE_)' | xargs 2>/dev/null || true)
fi

DB_HOST="${DB_HOST:-${MYSQL_HOST:-localhost}}"
DB_PORT="${DB_PORT:-${MYSQL_PORT:-3306}}"
DB_USER="${DB_USER:-${MYSQL_USER:-root}}"
DB_PASS="${DB_PASS:-${MYSQL_PASSWORD:-}}"
DB_NAME="${DB_NAME:-${MYSQL_DATABASE:-${DATABASE_NAME:-tpm}}}"

# ---- Tabel dengan soft-delete ----
TABLES=(
    "spare_parts"
    "customers"
    "mobils"
    "armada_jasa_angkut"
    "supirs"
    "jasa_servis"
    "karyawans"
    "suppliers"
)

# ---- Warna ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---- Parse arguments ----
DRY_RUN=false
SKIP_CONFIRM=false

for arg in "$@"; do
    case "$arg" in
        --dry)    DRY_RUN=true ;;
        --yes|-y) SKIP_CONFIRM=true ;;
        --help|-h)
            echo "Usage: $0 [--dry] [--yes|-y]"
            echo "  --dry    Hanya tampilkan jumlah, tanpa hapus"
            echo "  --yes    Skip konfirmasi"
            exit 0
            ;;
    esac
done

# ---- Helper: jalankan query MySQL ----
run_query() {
    local query="$1"
    if [ -n "$DB_PASS" ]; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "$query" 2>/dev/null
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" -sN -e "$query" 2>/dev/null
    fi
}

# ---- Main ----
echo "============================================================"
echo "  CLEANUP SOFT-DELETED RECORDS"
echo "============================================================"
echo ""
echo -e "  Database: ${CYAN}${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
echo ""

# Test koneksi
if ! run_query "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Gagal koneksi ke database!${NC}"
    echo "   Periksa konfigurasi di .env atau set variabel DB_HOST, DB_USER, DB_PASS, DB_NAME"
    exit 1
fi

# Hitung jumlah soft-deleted per tabel
printf "  ${BOLD}%-25s %20s${NC}\n" "Tabel" "Soft-Deleted"
printf "  %-25s %20s\n" "-------------------------" "--------------------"

TOTAL=0
declare -A COUNTS

for table in "${TABLES[@]}"; do
    # Cek apakah tabel ada
    EXISTS=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='$table'")
    
    if [ "$EXISTS" = "1" ]; then
        COUNT=$(run_query "SELECT COUNT(*) FROM \`$table\` WHERE deleted_at IS NOT NULL")
        COUNTS[$table]=$COUNT
        TOTAL=$((TOTAL + COUNT))
        
        if [ "$COUNT" -gt 0 ]; then
            printf "  %-25s ${YELLOW}%'20d${NC} ← ada data\n" "$table" "$COUNT"
        else
            printf "  %-25s %'20d\n" "$table" "$COUNT"
        fi
    else
        printf "  %-25s ${RED}%20s${NC}\n" "$table" "TABEL TIDAK ADA"
    fi
done

printf "  %-25s %20s\n" "-------------------------" "--------------------"
printf "  ${BOLD}%-25s %'20d${NC}\n" "TOTAL" "$TOTAL"
echo ""

# Tidak ada data
if [ "$TOTAL" -eq 0 ]; then
    echo -e "${GREEN}✅ Tidak ada record soft-deleted. Database sudah bersih!${NC}"
    exit 0
fi

# Dry-run
if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}🔍 Mode DRY-RUN: tidak ada data yang dihapus.${NC}"
    exit 0
fi

# Konfirmasi
if [ "$SKIP_CONFIRM" = false ]; then
    echo -ne "Ketik ${BOLD}HAPUS${NC} untuk menghapus permanen: "
    read -r CONFIRM
    if [ "$CONFIRM" != "HAPUS" ]; then
        echo "Dibatalkan."
        exit 0
    fi
    echo ""
fi

# Hapus!
echo -e "🗑️  ${BOLD}Menghapus record soft-deleted...${NC}"
echo ""

run_query "SET FOREIGN_KEY_CHECKS = 0;"

DELETED_TOTAL=0
for table in "${TABLES[@]}"; do
    COUNT=${COUNTS[$table]:-0}
    if [ "$COUNT" -gt 0 ]; then
        run_query "DELETE FROM \`$table\` WHERE deleted_at IS NOT NULL;"
        DELETED_TOTAL=$((DELETED_TOTAL + COUNT))
        echo -e "  ${GREEN}✓${NC} $table: ${BOLD}$COUNT${NC} record dihapus"
    fi
done

run_query "SET FOREIGN_KEY_CHECKS = 1;"

echo ""
echo -e "${GREEN}✅ Selesai! Total ${BOLD}${DELETED_TOTAL}${NC}${GREEN} record dihapus permanen.${NC}"
