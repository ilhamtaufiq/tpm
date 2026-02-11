# TPM Super App - Desktop Template

Electron wrapper untuk membuat aplikasi Windows desktop dari Expo web build.

## File Structure

```
desktop-template/
├── main.js              # Electron main process
├── preload.js           # Preload script untuk security
├── package.json         # NPM configuration & build settings
└── assets/             # Icons (you need to add these)
    ├── icon.ico        # Windows icon (256x256)
    └── icon.png        # PNG icon (512x512)
```

## Required Assets

Anda perlu menambahkan icon files:

1. **icon.png** - 512x512px PNG
2. **icon.ico** - Windows ICO file (multiple sizes: 16, 32, 48, 64, 128, 256)

### Convert PNG to ICO

**Online:**
- https://convertio.co/png-ico/
- https://icoconvert.com/

**Offline (ImageMagick):**
```bash
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## Usage

This template is automatically used by `build-windows.bat` script.

### Manual Setup

If you want to set up manually:

```bash
# 1. Copy template to desktop folder
xcopy /E /I desktop-template c:\laragon\www\tpm\desktop

# 2. Add your icons to desktop/assets/

# 3. Copy web build
xcopy /E /I /Y frontend\web-build desktop\build

# 4. Install dependencies
cd desktop
npm install

# 5. Build
npm run build
```

## Build Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run in development mode |
| `npm run build` | Build both installer & portable |
| `npm run build:installer` | Build installer only |
| `npm run build:portable` | Build portable exe only |
| `npm run build:dir` | Build unpacked (for testing) |

## Output

After build, you'll find in `dist/`:

- `TPM-Super-App-Setup-1.0.0.exe` - Installer (~150MB)
- `TPM-Super-App-Portable-1.0.0.exe` - Portable version (~200MB)

## Configuration

Edit `package.json` to change:

- App name, version, author
- Build settings
- Icon paths
- Output file names

## Development

To test in development mode:

```bash
# Terminal 1: Start Expo web
cd c:\laragon\www\tpm\frontend
npx expo start --web

# Terminal 2: Start Electron
cd c:\laragon\www\tpm\desktop
npm start
```

Electron will load from `http://localhost:8081` (Expo dev server).

## Production Build

For production, Electron loads from `build/index.html` (static files).

Make sure to build web version first:

```bash
cd c:\laragon\www\tpm\frontend
npx expo export:web
```

## Troubleshooting

### White screen in production?
- Check if `build/` folder exists
- Check if `build/index.html` exists
- Open DevTools (F12) to see errors

### Build fails?
- Update Node.js to v16 or higher
- Clear node_modules: `rmdir /s /q node_modules`
- Reinstall: `npm install`

### Large file size?
- Normal for Electron (~150MB)
- Includes full Chromium browser
- Use compression in `package.json` (already enabled)

## License

Same as main TPM Super App project.
