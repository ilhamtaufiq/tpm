---
name: fix-apk-crash
description: >-
  Diagnose and fix TPM Android APK force close after EAS build and install.
  Use when APK crashes on launch, force closes immediately, or crashes after splash.
  Triggers: "fix apk", "force close", "apk crash", "apk force close", "/fix-apk-crash".
---

# Fix APK Crash — TPM Super App

## Quick Start

1. Run `npx expo-doctor` in `frontend/`
2. Capture crash evidence (skip if user says no adb)
3. Follow checklist below
4. Rebuild: `eas build --profile preview --platform android`

## Diagnosis Checklist

- [ ] `npx expo-doctor` — fix dependency issues first
- [ ] `frontend/app.json` — `newArchEnabled` vs native modules
- [ ] `frontend/store/useAuthStore.ts` — SecureStore 2048-byte limit, hydration
- [ ] `frontend/utils/api.ts` — production URL fallback
- [ ] `frontend/app/_layout.tsx` — splash, fonts, OTA updates
- [ ] `frontend/utils/blePrinter.ts` — lazy BLE printer (no top-level import)
- [ ] `frontend/app/settings/bluetooth.tsx` — must use lazy BLE helper

## If adb Available

```bash
adb logcat -c
adb shell am start -n com.olobor.tpmsuperapp/.MainActivity
adb logcat *:E
```

Look for `FATAL EXCEPTION`, `AndroidRuntime`, `ReactNativeJS`.

## Rebuild

```bash
cd frontend
eas build --profile preview --platform android
```

## Acceptance

APK opens without force close for 60 seconds; reaches login or home screen.

## References

- `frontend/WHITE-SCREEN-FIX.md` — white screen (related, different symptom)
- `.claude/agents/expo-android-crash-resolver.md` — full agent workflow

## Do Not

- Fix without understanding symptom (white screen ≠ force close)
- Refactor unrelated modules
- Disable New Architecture without evidence