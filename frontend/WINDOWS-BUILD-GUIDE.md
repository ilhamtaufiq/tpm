# 🖥️ Windows Desktop Build Guide - TPM Super App

## Overview

Expo/React Native tidak secara native support Windows desktop. Namun ada beberapa opsi untuk membuat aplikasi Windows:

## 📊 Comparison Table

| Solution | Pros | Cons | Recommended |
|----------|------|------|-------------|
| **Electron** | ✅ Easy, popular, auto-update | ❌ Large size (~150MB) | ⭐⭐⭐ Best |
| **Tauri** | ✅ Small size (~10MB), fast | ❌ Complex setup | ⭐⭐ Good |
| **React Native Windows** | ✅ Native performance | ❌ Need separate codebase | ⭐ Complex |
| **PWA** | ✅ Zero install | ❌ Limited features | ⭐⭐⭐ Simplest |

---

## 🎯 **RECOMMENDED: Electron (Web Wrapper)**

### Why Electron?
- ✅ Reuse existing web version
- ✅ Auto-update support
- ✅ Native menus, notifications
- ✅ Code signing support
- ✅ Used by VS Code, Slack, Discord

### Architecture
```
┌─────────────────────────────────┐
│   Electron (Native Windows)     │
│  ┌───────────────────────────┐  │
│  │   Chromium Browser        │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  Your Web App       │  │  │
│  │  │  (expo-web build)   │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## 🚀 **Option 1: Electron (RECOMMENDED)**

### Step 1: Create Electron Wrapper

Create new folder structure:
```
tpm/
├── frontend/          # Existing Expo app
└── desktop/          # New Electron app
    ├── main.js
    ├── preload.js
    ├── package.json
    └── build/        # Web build output
```

### Step 2: Initialize Electron Project

```bash
# Create desktop folder
cd c:\laragon\www\tpm
mkdir desktop
cd desktop

# Initialize npm project
npm init -y

# Install Electron
npm install --save-dev electron electron-builder

# Install required packages
npm install electron-is-dev electron-store
```

### Step 3: Create Main Process (`main.js`)

```javascript
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: false,
        title: 'TPM Super App'
    });

    // Load app
    const startUrl = isDev 
        ? 'http://localhost:8081' // Expo web dev server
        : `file://${path.join(__dirname, 'build/index.html')}`; // Production build

    mainWindow.loadURL(startUrl);

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Create application menu
    createMenu();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About TPM Super App',
                    click: () => {
                        // Show about dialog
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
```

### Step 4: Create Preload Script (`preload.js`)

```javascript
const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    version: process.versions.electron
});
```

### Step 5: Update `package.json`

```json
{
  "name": "tpm-super-app-desktop",
  "version": "1.0.0",
  "description": "TPM Super App - Windows Desktop",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder build --win --publish never",
    "build:dir": "electron-builder build --win --dir",
    "deploy": "electron-builder build --win --publish always"
  },
  "build": {
    "appId": "com.olobor.tpmsuperapp",
    "productName": "TPM Super App",
    "copyright": "Copyright © 2026 Olobor",
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "assets/icon.ico",
      "publisherName": "Olobor",
      "verifyUpdateCodeSignature": false
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "TPM Super App"
    },
    "portable": {
      "artifactName": "TPM-SuperApp-Portable.exe"
    },
    "files": [
      "main.js",
      "preload.js",
      "build/**/*",
      "assets/**/*"
    ],
    "directories": {
      "buildResources": "assets",
      "output": "dist"
    }
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  },
  "dependencies": {
    "electron-is-dev": "^3.0.1",
    "electron-store": "^8.1.0"
  }
}
```

---

## 📦 **Build Process**

### 1. Build Web Version (Frontend)

```bash
# Go to frontend folder
cd c:\laragon\www\tpm\frontend

# Build for web
npx expo export:web

# This creates: web-build/ folder
```

### 2. Copy Web Build to Desktop

```bash
# Copy web build to desktop project
xcopy /E /I /Y web-build ..\desktop\build
```

### 3. Build Windows Executable

```bash
# Go to desktop folder
cd c:\laragon\www\tpm\desktop

# Build installer (NSIS) and portable exe
npm run build

# Output files will be in: dist/
# - TPM Super App Setup 1.0.0.exe (Installer)
# - TPM-SuperApp-Portable.exe (Portable)
```

---

## 🔄 **Development Workflow**

### For Development (Live Reload)

```bash
# Terminal 1: Start Expo web server
cd c:\laragon\www\tpm\frontend
npx expo start --web

# Terminal 2: Start Electron
cd c:\laragon\www\tpm\desktop
npm start
```

### For Production Build

```bash
# 1. Build web version
cd c:\laragon\www\tpm\frontend
npx expo export:web

# 2. Copy to desktop
xcopy /E /I /Y web-build ..\desktop\build

# 3. Build Windows app
cd ..\desktop
npm run build
```

---

## 🎨 **Assets Required**

Create these files in `desktop/assets/`:

1. **icon.ico** - 256x256px Windows icon
2. **icon.png** - 512x512px PNG icon

### Convert PNG to ICO

```bash
# Using ImageMagick
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Or use online tool: https://convertio.co/png-ico/
```

---

## 📁 **Final Folder Structure**

```
tpm/
├── frontend/                 # React Native/Expo app
│   ├── app/
│   ├── components/
│   ├── web-build/           # Generated by expo export:web
│   └── package.json
│
└── desktop/                  # Electron wrapper
    ├── assets/
    │   ├── icon.ico
    │   └── icon.png
    ├── build/               # Copied from frontend/web-build
    │   ├── index.html
    │   ├── static/
    │   └── ...
    ├── dist/                # Build output
    │   ├── TPM Super App Setup 1.0.0.exe
    │   └── TPM-SuperApp-Portable.exe
    ├── main.js
    ├── preload.js
    └── package.json
```

---

## 🚀 **Alternative: Progressive Web App (PWA)**

### Simplest Option - No Build Required!

#### 1. Enable PWA in Expo

```json
// frontend/app.json
{
  "expo": {
    "web": {
      "favicon": "./assets/favicon.png",
      "name": "TPM Super App",
      "shortName": "TPM",
      "description": "Transport & Project Management",
      "themeColor": "#3b82f6",
      "backgroundColor": "#ffffff",
      "startUrl": "/",
      "display": "standalone",
      "orientation": "any"
    }
  }
}
```

#### 2. Deploy Web Version

```bash
cd c:\laragon\www\tpm\frontend
npx expo export:web
```

#### 3. Users Install from Browser

1. Open `https://tpm.cianjur.space` in Chrome/Edge
2. Click **Install** button in address bar
3. App installs like native Windows app!

**Benefits:**
- ✅ Zero maintenance
- ✅ Auto-updates
- ✅ Small size
- ✅ Cross-platform (Mac, Linux too)

**Limitations:**
- ❌ No offline mode (unless configured)
- ❌ Limited native features
- ❌ Requires internet

---

## 📊 **Size Comparison**

| Build Type | Size | Notes |
|------------|------|-------|
| Electron Installer | ~150MB | Includes Chromium |
| Electron Portable | ~200MB | Unpacked |
| Tauri | ~10MB | Uses system WebView |
| PWA | ~5MB | Cached in browser |

---

## ✅ **Recommendation for TPM Super App**

### 🥇 **Best Choice: Electron**
**Why?**
- ✅ Works with existing Expo web build
- ✅ Professional installer
- ✅ Auto-update support
- ✅ Offline capable
- ✅ Native Windows integration

### 🥈 **Alternative: PWA**
**Why?**
- ✅ Zero build complexity
- ✅ Zero maintenance
- ✅ Cross-platform
- ✅ Always latest version

**When to use:**
- Internal company use
- Always-online requirement
- Don't need offline features

---

## 🔧 **Quick Start Script**

Save this as `build-windows.bat`:

```batch
@echo off
echo ========================================
echo TPM Super App - Windows Build Script
echo ========================================

echo.
echo [1/4] Building web version...
cd c:\laragon\www\tpm\frontend
call npx expo export:web

echo.
echo [2/4] Copying files to desktop project...
xcopy /E /I /Y web-build ..\desktop\build

echo.
echo [3/4] Installing dependencies...
cd ..\desktop
call npm install

echo.
echo [4/4] Building Windows executable...
call npm run build

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo Output files:
dir dist\*.exe /b
echo.
pause
```

---

## 📞 **Support**

| Issue | Solution |
|-------|----------|
| Build fails | Check Node.js version (16+) |
| Large file size | Normal for Electron (~150MB) |
| Slow startup | Use `electron-builder` compression |
| Update app | Implement `electron-updater` |

---

**Next Steps:**
1. Choose your approach (Electron or PWA)
2. Follow setup guide above
3. Test on Windows
4. Distribute to users

**Need help?** Let me know which approach you prefer!
