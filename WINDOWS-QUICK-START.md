# 🚀 Quick Start - Build Windows Desktop App

## Super Simple - 3 Steps!

### ✅ Prerequisites
- ✅ Node.js v16+ installed
- ✅ Expo project already working
- ✅ Icon files ready (PNG/ICO)

---

## 🎯 Option A: Automated (RECOMMENDED)

### 1. Add Icons
```
Buat atau convert icon Anda:
- 512x512 PNG → icon.png
- Convert ke ICO → icon.ico

Simpan di: c:\laragon\www\tpm\desktop-template\assets\
```

### 2. Run Build Script
```batch
# Double-click file ini:
c:\laragon\www\tpm\build-windows.bat

# Atau dari terminal:
cd c:\laragon\www\tpm
build-windows.bat
```

### 3. Done! ✓
```
Installer: desktop\dist\TPM-Super-App-Setup-1.0.0.exe
Portable: desktop\dist\TPM-Super-App-Portable-1.0.0.exe
```

---

## 🔧 Option B: Manual Setup

### Step 1: Setup Desktop Project
```bash
cd c:\laragon\www\tpm

# Copy template
xcopy /E /I desktop-template desktop

# Add your icons
# desktop/assets/icon.png
# desktop/assets/icon.ico
```

### Step 2: Build Web Version
```bash
cd frontend
npx expo export:web
```

### Step 3: Copy to Desktop
```bash
xcopy /E /I /Y web-build ..\desktop\build
```

### Step 4: Build Executable
```bash
cd ..\desktop
npm install
npm run build
```

---

## 📦 What You Get

| File | Size | Description |
|------|------|-------------|
| `TPM-Super-App-Setup-*.exe` | ~150MB | Installer with uninstaller |
| `TPM-Super-App-Portable-*.exe` | ~200MB | No installation needed |

---

## 🎨 Icon Requirements

### Create Icons

**Option 1: Use Existing App Icon**
```bash
# Your app already has icon at:
frontend/assets/icon.png

# Just copy it:
copy frontend\assets\icon.png desktop-template\assets\icon.png
```

**Option 2: Generate ICO**

Online tools:
- https://convertio.co/png-ico/
- https://icoconvert.com/

Upload your `icon.png`, download as `icon.ico`

---

## 🧪 Testing

### Development Mode (Live Reload)
```bash
# Terminal 1
cd frontend
npx expo start --web

# Terminal 2
cd desktop
npm start
```

### Test Production Build
```bash
# Start built installer
dist\TPM-Super-App-Setup-1.0.0.exe

# Or portable
dist\TPM-Super-App-Portable-1.0.0.exe
```

---

## ⚡ Quick Commands

### Development
```bash
cd c:\laragon\www\tpm\desktop
npm start                 # Run app
npm run dev              # Run with debugger
```

### Building
```bash
npm run build            # Build everything
npm run build:installer  # Installer only
npm run build:portable   # Portable only
npm run build:dir        # Unpacked (fast test)
```

---

## 🐛 Common Issues

### ❌ "Command not found: npx"
**Fix:** Install Node.js from https://nodejs.org/

### ❌ "expo: command not found"
**Fix:**
```bash
cd frontend
npm install
```

### ❌ Build fails with "icon not found"
**Fix:** Add icons to `desktop/assets/`
```
desktop/assets/icon.png
desktop/assets/icon.ico
```

### ❌ White screen when running
**Fix:** Check if build folder exists
```bash
# Should exist:
desktop/build/index.html
desktop/build/static/...
```

---

## 📋 Full Build Checklist

- [ ] Icons added to `desktop-template/assets/`
- [ ] Frontend builds successfully (`npx expo export:web`)
- [ ] Desktop dependencies installed (`npm install`)
- [ ] Build completes without errors
- [ ] Can run installer
- [ ] App opens and shows UI
- [ ] Can login and use features
- [ ] Ready to distribute! 🎉

---

## 🎯 Pro Tips

### 1. Faster Rebuilds
```bash
# Only rebuild if code changed:
cd frontend
npx expo export:web

# Quick copy
xcopy /E /I /Y web-build ..\desktop\build

# Fast build (no compression)
cd ..\desktop
npm run build:dir
```

### 2. Reduce File Size
Already optimized! File size is normal for Electron apps.

Comparison:
- VS Code: ~150MB
- Slack: ~180MB
- Discord: ~140MB
- TPM App: ~150MB ✓

### 3. Auto-Update (Future)
Add `electron-updater` for automatic updates from server.

### 4. Code Signing (Optional)
For production, sign with certificate to avoid "Unknown Publisher" warning.

---

## 📞 Need Help?

### Check Logs
```bash
# Open DevTools in app
Press F12

# Or start with console
cd desktop
npm start
# DevTools auto-opens in development
```

### Still Stuck?
1. Check `WINDOWS-BUILD-GUIDE.md` for details
2. Review error messages
3. Check Node.js version: `node --version` (need 16+)

---

## 🚀 Next Steps After Build

### Distribution
1. **Installer** → Best for end users
   - Professional installation
   - Start menu shortcuts
   - Uninstaller included

2. **Portable** → Best for testing
   - No installation
   - Run from USB
   - Good for demos

### Deployment
- Upload to file server
- Share download link
- Or distribute via USB/network

---

**Ready to build? Run the script!**

```batch
c:\laragon\www\tpm\build-windows.bat
```

🎉 **That's it!** Your Windows app will be ready in ~5-10 minutes.
