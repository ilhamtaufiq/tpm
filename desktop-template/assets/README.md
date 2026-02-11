# ⚠️ IMPORTANT - Icon Files

## Current Status

✅ **icon.png** - Already copied from frontend/assets/
❌ **icon.ico** - Need to generate this!

## Why ICO is Needed?

Windows executable requires `.ico` format for:
- Application icon
- Installer icon  
- Taskbar icon
- Start menu shortcut

## How to Create icon.ico

### Option 1: Online Converter (EASIEST)

1. Go to: https://convertio.co/png-ico/
2. Upload: `icon.png` from this folder
3. Download the converted `icon.ico`
4. Save it here: `desktop-template/assets/icon.ico`

### Option 2: CloudConvert

1. Go to: https://cloudconvert.com/png-to-ico
2. Upload `icon.png`
3. Settings:
   - ✅ Multiple sizes: 16, 32, 48, 64, 128, 256
   - ✅ Keep transparency
4. Download and save as `icon.ico`

### Option 3: ImageMagick (Advanced)

If you have ImageMagick installed:

```bash
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## After Creating icon.ico

1. Save it to: `c:\laragon\www\tpm\desktop-template\assets\icon.ico`
2. Run the build script: `c:\laragon\www\tpm\build-windows.bat`

## File Checklist

- [x] icon.png (512x512 px) ✓
- [ ] icon.ico (multiple sizes) ← **CREATE THIS!**

---

**Ready to build?** Create `icon.ico` first, then run `build-windows.bat`!
