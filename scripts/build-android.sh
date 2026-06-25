#!/usr/bin/env bash
set -euo pipefail

# ─── Konfigurasi ───────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
APP_NAME=$(jq -r '.expo.name' < "$FRONTEND_DIR/app.json")
RELEASE_NOTES=""

# ─── Fungsi bantuan ────────────────────────────────────────────
info()  { echo -e "\033[1;34m[*]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[✓]\033[0m $*"; }
err()   { echo -e "\033[1;31m[✗]\033[0m $*" >&2; }

die()   { err "$*"; exit 1; }
require_cmd() { command -v "$1" &>/dev/null || die "Perintah '$1' tidak ditemukan. Install dulu."; }

validate_version() {
    local ver="$1"
    [[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]] || \
        die "Format versi tidak valid: '$ver'. Gunakan semver, contoh: 1.2.3"
}

sync_app_version() {
    local ver="$1"
    local pkg_tmp app_tmp

    pkg_tmp="$(mktemp)"
    app_tmp="$(mktemp)"
    jq --arg v "$ver" '.version = $v' "$FRONTEND_DIR/package.json" > "$pkg_tmp"
    jq --arg v "$ver" '.expo.version = $v' "$FRONTEND_DIR/app.json" > "$app_tmp"
    mv "$pkg_tmp" "$FRONTEND_DIR/package.json"
    mv "$app_tmp" "$FRONTEND_DIR/app.json"
    ok "Versi diset ke $ver (package.json & app.json)"
}

prompt_version() {
    local current="$1"
    local input=""

    echo ""
    info "Versi saat ini: $current"
    read -rp "Masukkan versi release (contoh 1.2.3): " input
    [ -n "$input" ] || die "Versi wajib diisi."
    validate_version "$input"
    VERSION="$input"
}

# ─── Cek prasyarat ─────────────────────────────────────────────
info "Memeriksa prasyarat..."
require_cmd node
require_cmd npm
require_cmd git
require_cmd gh
require_cmd jq

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 18 ] || die "Node.js minimal 18, saat ini: $(node -v)"

# Android SDK
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
    ANDROID_HOME="/usr/lib/android-sdk"
fi
if [ ! -d "$ANDROID_HOME" ]; then
    die "Android SDK tidak ditemukan. Set ANDROID_HOME atau install: sudo apt install android-sdk"
fi
export ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# JDK 17+
JAVA_VER=$(java -version 2>&1 | head -1 | grep -oP '"(?:1\.)?\K\d+' || echo "0")
[ "$JAVA_VER" -ge 17 ] || die "JDK minimal 17, saat ini: $(java -version 2>&1 | head -1)"

require_cmd gradle || true

gh auth status &>/dev/null || die "gh CLI belum login. Jalankan: gh auth login"

ok "Semua prasyarat terpenuhi (SDK: $ANDROID_HOME, JDK: $JAVA_VER)"

# ─── Versi (input manual) ──────────────────────────────────────
CURRENT_VERSION=$(jq -r '.version' < "$FRONTEND_DIR/package.json")

if [ -n "${1:-}" ]; then
    validate_version "$1"
    VERSION="$1"
    info "Menggunakan versi dari argumen: $VERSION"
else
    prompt_version "$CURRENT_VERSION"
fi

RELEASE_TITLE="v$VERSION"
TAG="v$VERSION"
APK_ASSET_NAME="${APP_NAME// /-}-v${VERSION}.apk"

read -rp "Catatan release (opsional, Enter untuk skip): " RELEASE_NOTES_INPUT || true
if [ -n "${RELEASE_NOTES_INPUT:-}" ]; then
    RELEASE_NOTES="$RELEASE_NOTES_INPUT"
fi

sync_app_version "$VERSION"

# ─── Install dependencies ──────────────────────────────────────
info "Menginstall dependencies..."
cd "$FRONTEND_DIR"
npm install

# ─── Prebuild (generate android/ folder) ────────────────────────
info "Menjalankan expo prebuild (hapus lama + generate ulang)..."
cd "$FRONTEND_DIR"
rm -rf android
npx expo prebuild --platform android --clean

# ─── Build APK lokal ───────────────────────────────────────────
info "Memulai build Android APK lokal..."
cd "$FRONTEND_DIR/android"
info "Menjalankan ./gradlew assembleRelease..."

./gradlew assembleRelease 2>&1 | tee /tmp/gradle-build.log
BUILD_STATUS="${PIPESTATUS[0]}"

if [ "$BUILD_STATUS" -ne 0 ]; then
    err "Build gagal. Cek /tmp/gradle-build.log"
    exit 1
fi

ok "Build berhasil!"

# ─── Cari APK hasil build ──────────────────────────────────────
APK_FILE=$(find "$FRONTEND_DIR/android/app/build/outputs/apk" -name "*-release.apk" -type f | head -1)

if [ -z "$APK_FILE" ]; then
    APK_FILE=$(find "$FRONTEND_DIR/android/app/build/outputs" -name "*.apk" -type f | head -1)
fi

[ -z "$APK_FILE" ] && die "APK tidak ditemukan di output!"
ok "APK: $APK_FILE"
ls -lh "$APK_FILE"

# ─── Salin ke dist/ ────────────────────────────────────────────
APK_DIR="$PROJECT_DIR/dist"
mkdir -p "$APK_DIR"
DIST_APK="$APK_DIR/$APK_ASSET_NAME"
cp "$APK_FILE" "$DIST_APK"
ok "APK disalin ke: $DIST_APK"

# ─── Git Tag ───────────────────────────────────────────────────
info "Membuat git tag $TAG..."
cd "$PROJECT_DIR"

if git rev-parse "$TAG" &>/dev/null; then
    info "Tag $TAG sudah ada lokal, menghapus..."
    git tag -d "$TAG"
fi
git push origin ":refs/tags/$TAG" 2>/dev/null || true

git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"
ok "Tag $TAG terpush"

# ─── GitHub Release ─────────────────────────────────────────────
info "Mempublish GitHub Release..."

if [ -z "$RELEASE_NOTES" ]; then
    PREV_TAG=$(git describe --tags --abbrev=0 "${TAG}^" 2>/dev/null || echo "")
    if [ -n "$PREV_TAG" ]; then
        RELEASE_NOTES=$(git log --oneline --no-decorate "$PREV_TAG..HEAD" 2>/dev/null | head -50)
    fi
    if [ -z "$RELEASE_NOTES" ]; then
        RELEASE_NOTES="Android APK build $TAG"
    fi
fi

if gh release view "$TAG" &>/dev/null; then
    info "Release $TAG sudah ada, mengunggah ulang APK..."
    gh release upload "$TAG" "$DIST_APK#$APK_ASSET_NAME" --clobber
else
    gh release create "$TAG" \
        --title "$RELEASE_TITLE" \
        --notes "$RELEASE_NOTES" \
        "$DIST_APK#$APK_ASSET_NAME"
fi

ok "Release $TAG berhasil dipublish!"
echo ""
echo "  ═══════════════════════════════════════"
echo "   Release  : $RELEASE_TITLE"
echo "   APK      : $DIST_APK"
REPO_URL=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "<repo>")
echo "   URL      : https://github.com/$REPO_URL/releases/tag/$TAG"
echo "  ═══════════════════════════════════════"