#!/usr/bin/env bash
set -euo pipefail

# ─── Konfigurasi ───────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VERSION=$(jq -r '.version' < "$FRONTEND_DIR/package.json")
APP_NAME=$(jq -r '.expo.name' < "$FRONTEND_DIR/app.json")
RELEASE_TITLE="v$VERSION"
RELEASE_NOTES=""

# ─── Fungsi bantuan ────────────────────────────────────────────
info()  { echo -e "\033[1;34m[*]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[✓]\033[0m $*"; }
err()   { echo -e "\033[1;31m[✗]\033[0m $*" >&2; }

die()   { err "$*"; exit 1; }
require_cmd() { command -v "$1" &>/dev/null || die "Perintah '$1' tidak ditemukan. Install dulu."; }

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

# Gradle
require_cmd gradle || true  # optional, project pakai wrapper

gh auth status &>/dev/null || die "gh CLI belum login. Jalankan: gh auth login"

ok "Semua prasyarat terpenuhi (SDK: $ANDROID_HOME, JDK: $JAVA_VER)"

# ─── Bump version ──────────────────────────────────────────────
if [ "${1:-}" = "--bump" ]; then
    info "Menaikkan patch version..."
    cd "$FRONTEND_DIR"
    npm version patch --no-git-tag-version
    VERSION=$(jq -r '.version' < package.json)
    RELEASE_TITLE="v$VERSION"
    ok "Version -> $VERSION"
fi

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
    # Fallback: cari semua apk release
    APK_FILE=$(find "$FRONTEND_DIR/android/app/build/outputs" -name "*.apk" -type f | head -1)
fi

[ -z "$APK_FILE" ] && die "APK tidak ditemukan di output!"
ok "APK: $APK_FILE"
ls -lh "$APK_FILE"

# ─── Salin ke dist/ ────────────────────────────────────────────
APK_DIR="$PROJECT_DIR/dist"
mkdir -p "$APK_DIR"
DIST_APK="$APK_DIR/${APP_NAME// /-}-v${VERSION}.apk"
cp "$APK_FILE" "$DIST_APK"
ok "APK disalin ke: $DIST_APK"

# ─── Git Tag ───────────────────────────────────────────────────
info "Membuat git tag v$VERSION..."
cd "$PROJECT_DIR"
if git rev-parse "v$VERSION" &>/dev/null; then
    info "Tag v$VERSION sudah ada, menghapus..."
    git tag -d "v$VERSION"
    git push origin ":refs/tags/v$VERSION" 2>/dev/null || true
fi
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
ok "Tag v$VERSION terpush"

# ─── GitHub Release ─────────────────────────────────────────────
info "Membuat GitHub Release..."

PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ]; then
    RELEASE_NOTES=$(git log --oneline --no-decorate "$PREV_TAG..HEAD" 2>/dev/null | head -50)
fi
if [ -z "$RELEASE_NOTES" ]; then
    RELEASE_NOTES="Android APK build v$VERSION"
fi

gh release create "v$VERSION" \
    --title "$RELEASE_TITLE" \
    --notes "$RELEASE_NOTES" \
    "$DIST_APK#${APP_NAME// /-}-v$VERSION.apk"

ok "Release v$VERSION berhasil dibuat!"
echo ""
echo "  ═══════════════════════════════════════"
echo "   Release  : $RELEASE_TITLE"
echo "   APK      : $DIST_APK"
REPO_URL=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "<repo>")
echo "   URL      : https://github.com/$REPO_URL/releases/tag/v$VERSION"
echo "  ═══════════════════════════════════════"
