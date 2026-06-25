#!/usr/bin/env bash
set -euo pipefail

# Create GitHub PR with auto-generated body.
# Usage:
#   ./scripts/create-pr.sh [base] [head] [--draft]
#
# Examples:
#   ./scripts/create-pr.sh main dev
#   ./scripts/create-pr.sh main dev --draft

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_REF="${1:-main}"
HEAD_REF="${2:-$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD)}"
DRAFT=false

if [ "${3:-}" = "--draft" ] || [ "${2:-}" = "--draft" ]; then
    DRAFT=true
    if [ "${2:-}" = "--draft" ]; then
        HEAD_REF="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD)"
    fi
fi

die() { echo "Error: $*" >&2; exit 1; }
require_cmd() { command -v "$1" &>/dev/null || die "Perintah '$1' tidak ditemukan."; }

require_cmd git
require_cmd gh

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

"$PROJECT_DIR/scripts/pr-body.sh" "$BASE_REF" "$HEAD_REF" > "$BODY_FILE"

resolve_head() {
    local ref="$1"
    if git -C "$PROJECT_DIR" rev-parse --verify "$ref" &>/dev/null; then
        git -C "$PROJECT_DIR" rev-parse --abbrev-ref "$ref" 2>/dev/null || echo "$ref"
        return
    fi
    if git -C "$PROJECT_DIR" rev-parse --verify "origin/$ref" &>/dev/null; then
        echo "$ref"
        return
    fi
    echo "$ref"
}

HEAD_NAME="$(resolve_head "$HEAD_REF")"
BASE_NAME="${BASE_REF#origin/}"

# Title from latest commit subject in range
BASE_RESOLVED="$BASE_REF"
if ! git -C "$PROJECT_DIR" rev-parse --verify "$BASE_RESOLVED" &>/dev/null; then
    BASE_RESOLVED="origin/$BASE_REF"
fi
HEAD_RESOLVED="$HEAD_REF"
if ! git -C "$PROJECT_DIR" rev-parse --verify "$HEAD_RESOLVED" &>/dev/null; then
    HEAD_RESOLVED="origin/$HEAD_REF"
fi

TITLE="$(git -C "$PROJECT_DIR" log -1 --format=%s "${BASE_RESOLVED}..${HEAD_RESOLVED}")"
[ -n "$TITLE" ] || die "Gagal membuat title dari commit log."

echo "Creating PR: $HEAD_NAME → $BASE_NAME"
echo "Title: $TITLE"
echo ""

ARGS=(
    pr create
    --base "$BASE_NAME"
    --head "$HEAD_NAME"
    --title "$TITLE"
    --body-file "$BODY_FILE"
)

if [ "$DRAFT" = true ]; then
    ARGS+=(--draft)
fi

gh "${ARGS[@]}"