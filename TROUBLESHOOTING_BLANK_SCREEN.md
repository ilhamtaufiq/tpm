# 🔧 BLANK SCREEN FIX - FINAL SOLUTION (2026-02-06 22:22 WIB)

## ✅ ROOT CAUSE FOUND & FIXED

**Error:** `TypeError: Cannot read property 'hostname' of undefined`

**Location:** `frontend/utils/api.ts` line 11

**Problem:** 
In React Native production builds, `window` object may exist, but `window.location` is `undefined`. The code was checking `typeof window !== 'undefined'` but NOT checking if `window.location` exists before accessing `.hostname`.

**Fix Applied:**
```typescript
// OLD CODE (BUGGY):
if (typeof window !== 'undefined') {
    const hostname = window.location.hostname; // ❌ CRASH HERE
    ...
}

// NEW CODE (FIXED):
if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname; // ✅ SAFE NOW
    ...
}
```

**Why This Happened:**
- React Native doesn't have a real `window.location` object
- In production builds (APK), the polyfill may create a partial `window` but not `location`
- This caused the app to crash immediately on launch before any UI could render

**Expected Result:**
- App will now properly skip the web-specific code path
- Fall through to the correct production URL: `https://tpm.cianjur.space`
- App should load normally and show login screen

---

## 🚀 NEXT STEPS

### Option 1: Test Locally (RECOMMENDED FIRST)
```bash
# Clear everything
npx expo start --clear

# Test in production mode
npx expo start --no-dev --minify

# Build and install on device
npx expo run:android --variant release
```

### Option 2: Build New APK
```bash
# Build preview APK with the fix
eas build --platform android --profile preview

# Monitor build
eas build:list
```

### Option 3: Debug Current Build (if you want to verify the error is gone)
```bash
# View logs
adb logcat -s ReactNativeJS

# Should now see:
# [TPM API] Base URL: https://tpm.cianjur.space
# [Auth Store] Hydration complete: ...
# ✅ No more "hostname of undefined" errors
```

---

# 🔧 ENHANCED BLANK SCREEN FIXES APPLIED (Previous Session)

✅ What Changed:
1. Increased Timeouts ⏱️
_layout.tsx: 100ms → 500ms
index.tsx:   800ms → 2000ms (2 seconds)
Fallback:    Added 5-second force navigation
2. Added Debug Features 🐛
Console Logs: Track setiap step (fonts, splash, hydration, navigation)
Debug Button: "Tap if stuck" untuk force navigation
Force Fallback: Auto-navigate after 5 seconds jika stuck
3. Better Error Handling 🛡️
ErrorBoundary sudah wrap app
Multiple fallback timers
Graceful degradation
📱 Testing Dengan ADB Logcat:
Connect phone dan run:

bash
# Enable USB Debugging di phone
# Connect via USB
# View React Native logs
adb logcat -s ReactNativeJS
# Atau save ke file
adb logcat -s ReactNativeJS > app-logs.txt
Expected Log Flow:

LAYOUT: Fonts loaded: true
LAYOUT: Hiding splash screen
LAYOUT: Setting isReady to true
INDEX: Component mounted
INDEX: isAuthenticated (initial): false
INDEX: Hydration timeout complete
INDEX: isAuthenticated (after hydration): false
INDEX: Redirecting to Login
🎯 What Happens Now:
1. Splash Screen shows
   ↓
2. Splash hides (500ms after fonts load)
   ↓
3. "Memuat TPM Super App" loading screen shows
   - Green TPM logo
   - Loading spinner
   - "Debug" button (jika stuck lebih dari 3s)
   ↓
4. Wait 2 seconds for store hydration
   ↓
5. Navigate to Login or Home
   ↓
6. IF STUCK: After 5 seconds, force navigate anyway
🚀 Next Steps:
Option 1: Rebuild Now

bash
eas build --platform android --profile preview
Option 2: Test Locally First

bash
# Test production mode locally
npx expo start --no-dev --minify
# Install on device
npx expo run:android
Option 3: Debug Current Build

bash
# Install current APK
# Run adb logcat while opening app
adb logcat -s ReactNativeJS
# Look for where it stops
📋 Files Modified:
✅ 
app/index.tsx
Timeout: 800ms → 2000ms
Added force navigation (5s)
Added debug button
Added comprehensive logging
✅ 
app/_layout.tsx
Timeout: 100ms → 500ms
Added logging untuk fonts, splash, navigation
✅ 
DEBUG_BLANK_SCREEN.md
 (NEW)
Complete debugging guide
Test cases
Log analysis instructions
💡 Quick Diagnosis:
When you install the new build:

IF You see loading screen with TPM logo: → ✅ App is working, just slow → Wait 2 seconds OR tap debug button

IF Still blank after splash: → Run adb logcat -s ReactNativeJS → Share last logs before it goes blank → Indicates JS error or navigation issue

IF Can tap "Debug" button: → App is running but stuck in loading → AsyncStorage/hydration issue → Button will force navigate as workaround

🎯 Most Likely Result:
With 2-second wait + 5-second force fallback, app WILL navigate eventually.

Best case: Navigate after 2 seconds ✅ Worst case: Force navigate after 5 seconds ✅ No case: Stuck forever ❌ (shouldn't happen now)

Rebuild sekarang dan test! Jika masih blank, jalankan adb logcat dan share logs. 🚀

Apakah mau:

🔨 Rebuild sekarang dengan fixes ini
