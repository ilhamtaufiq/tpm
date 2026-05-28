# Fix: LightningCSS Error pada EAS Local Build

**Error**: `Cannot find module '../lightningcss.linux-x64-gnu.node'`

**Penyebab**: 
- LightningCSS memerlukan native binary platform-specific
- Windows tidak memiliki Linux binary yang diperlukan untuk EAS build
- NativeWind/TailwindCSS menggunakan LightningCSS untuk CSS processing

---

## ✅ SOLUSI 1: Reinstall dengan Dependencies Lengkap (RECOMMENDED)

### Step 1: Update package.json
Tambahkan ke `devDependencies`:
```json
{
  "devDependencies": {
    "lightningcss": "^1.27.0",
    "@types/react": "~18.3.12",
    "babel-preset-expo": "~12.0.0",
    "patch-package": "^8.0.1",
    "typescript": "~5.3.3"
  }
}
```

**NOTE**: Package `@nativewind/metro` TIDAK DIPERLUKAN dan tidak tersedia di npm. NativeWind v4 sudah include Metro transformer secara otomatis.

### Step 2: Clean install
```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install

# Atau dengan cache clear
npm cache clean --force
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### Step 3: Verify installation
```bash
npm list lightningcss
npm list @nativewind/metro
```

---

## ✅ SOLUSI 2: Gunakan EAS Cloud Build

Jika local build masih error, gunakan EAS cloud:

```bash
# Install EAS CLI global
npm install -g eas-cli

# Login ke Expo
eas login

# Build di cloud (free tier available)
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

### Keuntungan Cloud Build:
- ✅ Native binaries tersedia untuk semua platform
- ✅ Tidak perlu setup environment lokal yang kompleks
- ✅ Build di server yang sudah dikonfigurasi sempurna
- ✅ Support Linux, macOS, dan Windows builds

---

## ✅ SOLUSI 3: Configure Metro untuk Skip LightningCSS

Jika tidak butuh CSS optimization saat development:

### Update `metro.config.js`:
```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Skip lightningcss for local builds
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

module.exports = withNativeWind(config, { 
  input: './global.css',
  inlineRem: 16,
  // Disable lightningcss untuk development
  unstable_lightningcss: false
});
```

---

## ✅ SOLUSI 4: Use Docker for EAS Local Build

Jika perlu build lokal dengan environment Linux:

### eas.json configuration:
```json
{
  "cli": {
    "version": ">= 13.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Build dengan Docker:
```bash
# Pastikan Docker running
docker --version

# Build dengan EAS local
eas build --platform android --local
```

---

## 🔍 TROUBLESHOOTING

### 1. Masih Error Setelah Reinstall?

**Check platform-specific binaries:**
```bash
# Lihat dependencies yang terinstall
npm list lightningcss

# Check di node_modules
dir node_modules\lightningcss\*.node
```

**Expected output:**
- `lightningcss.win32-x64-msvc.node` (untuk Windows)
- Jika build untuk Android/iOS, binary Linux diperlukan di build server

### 2. Error: "Cannot find module @nativewind/metro"?

```bash
npm install --save-dev @nativewind/metro
```

### 3. Build Timeout atau Gagal?

**Increase Node memory:**
```bash
# Set environment variable
$env:NODE_OPTIONS="--max-old-space-size=4096"

# Atau di package.json scripts:
"build:local": "cross-env NODE_OPTIONS=--max-old-space-size=4096 eas build --local"
```

### 4. Platform Mismatch Error?

**Override platform di eas.json:**
```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_UNSTABLE_LIGHTNINGCSS": "0"
      }
    }
  }
}
```

---

## 📋 CHECKLIST SEBELUM BUILD

- [ ] Node.js version >= 18.x
- [ ] NPM version >= 9.x (atau Yarn >= 1.22)
- [ ] Expo CLI updated (`npm install -g expo-cli`)
- [ ] EAS CLI updated (`npm install -g eas-cli`)
- [ ] `package.json` includes `lightningcss` di devDependencies
- [ ] `node_modules` clean (hapus dan reinstall)
- [ ] Cache cleared (`npm cache clean --force`)
- [ ] Expo account logged in (`eas login`)

---

## 🚀 RECOMMENDED BUILD WORKFLOW

### Development (Local)
```bash
# Start expo dev
npm run start

# atau
npx expo start
```

### Preview Build (Cloud - RECOMMENDED)
```bash
# Android APK
eas build --platform android --profile preview

# iOS TestFlight
eas build --platform ios --profile preview
```

### Production Build
```bash
# Android AAB for Play Store
eas build --platform android --profile production

# iOS for App Store
eas build --platform ios --profile production
```

---

## 💡 BEST PRACTICES

1. **Selalu gunakan EAS Cloud untuk production builds**
   - Lebih reliable
   - Environment consistent
   - Native binaries tersedia

2. **Local builds hanya untuk quick testing**
   - Development builds
   - Fast iteration
   - Debug mode

3. **Keep dependencies updated**
   ```bash
   # Check outdated packages
   npm outdated
   
   # Update safely
   npm update
   ```

4. **Use proper Node version**
   ```bash
   # Check version
   node --version
   
   # Recommended: v20.x LTS
   # Install via nvm (Node Version Manager)
   ```

---

## 📞 JIKA MASALAH MASIH BERLANJUT

### Quick Fix Commands:
```bash
# 1. Full cleanup
Remove-Item -Recurse -Force node_modules, package-lock.json, .expo
npm cache clean --force

# 2. Reinstall
npm install

# 3. Rebuild metro cache
npx expo start --clear

# 4. Try cloud build instead
eas build --platform android --profile preview
```

### Alternative: Skip local build
```bash
# Just use cloud - it's free for open source!
eas login
eas build --platform android --profile preview --non-interactive
```

---

## ✅ VERIFICATION

Setelah fix, verify dengan:
```bash
# 1. Check package installed
npm list lightningcss

# 2. Try start expo
npx expo start

# 3. If building locally
eas build --platform android --local --profile preview
```

---

**Kesimpulan**: 
- ✅ Solusi 1 (Reinstall) untuk fix dependencies
- ✅ Solusi 2 (Cloud Build) untuk production (RECOMMENDED)
- ✅ Solusi 3 (Disable LightningCSS) untuk development
- ✅ Solusi 4 (Docker) untuk full local build environment
