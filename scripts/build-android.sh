#!/usr/bin/env bash
set -euo pipefail

# ─── Konfigurasi ───────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
GIT_BRANCH="${GIT_BRANCH:-main}"
GRADLE_LOG="/tmp/gradle-build.log"
NPM_LOG="/tmp/npm-install.log"
PREBUILD_LOG="/tmp/expo-prebuild.log"
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
        die "Format versi tidak valid: '$ver'. Perbaiki di repo lalu merge ke $GIT_BRANCH."
}

show_build_progress() {
    local pct="$1"
    local width=36
    local filled=$((pct * width / 100))
    local empty=$((width - filled))
    local bar
    bar="$(printf '%*s' "$filled" '' | tr ' ' '#')$(printf '%*s' "$empty" '' | tr ' ' '-')"
    printf "\r\033[1;34m[*]\033[0m Build [%s] %3d%%" "$bar" "$pct"
}

gradle_progress_pct() {
    local log_file="$1"
    local tasks pct

    if grep -qE 'BUILD SUCCESSFUL' "$log_file" 2>/dev/null; then
        echo 100
        return
    fi

    if grep -qE '> Task :app:assembleRelease' "$log_file" 2>/dev/null; then
        echo 99
        return
    fi
    if grep -qE '> Task :app:packageRelease' "$log_file" 2>/dev/null; then
        echo 92
        return
    fi
    if grep -qE '> Task :app:(minifyReleaseWithR8|optimizeReleaseResources|lintVitalAnalyzeRelease)' "$log_file" 2>/dev/null; then
        echo 85
        return
    fi
    if grep -qE '> Task :app:compileRelease' "$log_file" 2>/dev/null; then
        echo 60
        return
    fi
    if grep -qE '> Task :app:mergeReleaseResources' "$log_file" 2>/dev/null; then
        echo 45
        return
    fi
    if grep -qE '> Task :app:preReleaseBuild' "$log_file" 2>/dev/null; then
        echo 20
        return
    fi

    tasks=$(grep -cE '^> Task ' "$log_file" 2>/dev/null || echo 0)
    pct=$((10 + tasks / 4))
    [ "$pct" -gt 94 ] && pct=94
    [ "$pct" -lt 5 ] && pct=5
    echo "$pct"
}

run_gradle_build() {
    local log_file="$1"
    local gradle_pid last_pct=0 pct

    : > "$log_file"
    ./gradlew assembleRelease --console=plain >"$log_file" 2>&1 &
    gradle_pid=$!

    while kill -0 "$gradle_pid" 2>/dev/null; do
        pct=$(gradle_progress_pct "$log_file")
        if [ "$pct" -ne "$last_pct" ]; then
            show_build_progress "$pct"
            last_pct=$pct
        fi
        sleep 1
    done

    wait "$gradle_pid" || return $?

    pct=$(gradle_progress_pct "$log_file")
    show_build_progress "$pct"
    echo ""
    return 0
}

sync_from_git() {
    info "Sinkron dari origin/$GIT_BRANCH..."
    cd "$PROJECT_DIR"

    git fetch origin "$GIT_BRANCH"

    if git show-ref --verify --quiet "refs/heads/$GIT_BRANCH"; then
        git checkout "$GIT_BRANCH"
    else
        git checkout -B "$GIT_BRANCH" "origin/$GIT_BRANCH"
    fi

    git reset --hard "origin/$GIT_BRANCH"
    git clean -fd

    ok "Repo sinkron: $(git rev-parse --short HEAD) ($GIT_BRANCH)"
}

read_version_from_git() {
    local pkg_ver app_ver

    [ -f "$FRONTEND_DIR/package.json" ] || die "frontend/package.json tidak ditemukan."
    [ -f "$FRONTEND_DIR/app.json" ] || die "frontend/app.json tidak ditemukan."

    pkg_ver=$(jq -r '.version' < "$FRONTEND_DIR/package.json")
    app_ver=$(jq -r '.expo.version' < "$FRONTEND_DIR/app.json")

    validate_version "$pkg_ver"
    [ "$pkg_ver" = "$app_ver" ] || \
        die "Versi tidak sinkron: package.json=$pkg_ver, app.json=$app_ver. Perbaiki di lokal lalu merge ke $GIT_BRANCH."

    VERSION="$pkg_ver"
    ok "Versi dari git ($GIT_BRANCH): $VERSION"
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

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
    ANDROID_HOME="/usr/lib/android-sdk"
fi
[ -d "$ANDROID_HOME" ] || die "Android SDK tidak ditemukan. Set ANDROID_HOME atau install: sudo apt install android-sdk"
export ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

JAVA_VER=$(java -version 2>&1 | head -1 | grep -oP '"(?:1\.)?\K\d+' || echo "0")
[ "$JAVA_VER" -ge 17 ] || die "JDK minimal 17, saat ini: $(java -version 2>&1 | head -1)"

require_cmd gradle || true

gh auth status &>/dev/null || die "gh CLI belum login. Jalankan: gh auth login"

ok "Semua prasyarat terpenuhi (SDK: $ANDROID_HOME, JDK: $JAVA_VER)"

# ─── Sinkron git & versi ───────────────────────────────────────
sync_from_git
read_version_from_git

APP_NAME=$(jq -r '.expo.name' < "$FRONTEND_DIR/app.json")
RELEASE_TITLE="v$VERSION"
TAG="v$VERSION"
APK_ASSET_NAME="${APP_NAME// /-}-v${VERSION}.apk"

read -rp "Catatan release (opsional, Enter untuk skip): " RELEASE_NOTES_INPUT || true
if [ -n "${RELEASE_NOTES_INPUT:-}" ]; then
    RELEASE_NOTES="$RELEASE_NOTES_INPUT"
fi

# ─── Install dependencies ──────────────────────────────────────
info "Menginstall dependencies..."
cd "$FRONTEND_DIR"
if npm install >"$NPM_LOG" 2>&1; then
    ok "Dependencies terinstall"
else
    err "npm install gagal. Log: $NPM_LOG"
    tail -30 "$NPM_LOG" >&2 || true
    exit 1
fi

# ─── Prebuild (generate android/ folder) ───────────────────────
info "Menjalankan expo prebuild..."
cd "$FRONTEND_DIR"
rm -rf android
if npx expo prebuild --platform android --clean >"$PREBUILD_LOG" 2>&1; then
    ok "Prebuild selesai"
else
    err "Prebuild gagal. Log: $PREBUILD_LOG"
    tail -40 "$PREBUILD_LOG" >&2 || true
    exit 1
fi

# ─── Build APK lokal ───────────────────────────────────────────
info "Memulai build Android APK..."
cd "$FRONTEND_DIR/android"

if run_gradle_build "$GRADLE_LOG"; then
    ok "Build berhasil!"
else
    err "Build gagal. Log lengkap: $GRADLE_LOG"
    grep -E 'FAILURE:|error:|Error:|BUILD FAILED' "$GRADLE_LOG" | tail -20 >&2 || tail -30 "$GRADLE_LOG" >&2
    exit 1
fi

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
echo "   Branch   : $GIT_BRANCH @ $(git rev-parse --short HEAD)"
echo "   Release  : $RELEASE_TITLE"
echo "   APK      : $DIST_APK"
REPO_URL=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "<repo>")
echo "   URL      : https://github.com/$REPO_URL/releases/tag/$TAG"
echo "  ═══════════════════════════════════════"