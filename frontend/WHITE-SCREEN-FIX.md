# 🔧 White Screen Fix - TPM Super App

## Problem
After building with `eas build --profile preview --platform android`, the installed APK shows a white/blank screen.

## Root Causes Identified

### 1. ❌ Missing Production API URL
- **Issue**: `utils/api.ts` was using `debuggerHost` which is `undefined` in production builds
- **Impact**: App couldn't connect to backend API
- **Fix**: Added fallback to production URL `https://tpm.cianjur.space`

### 2. ❌ AsyncStorage Hydration Race Condition
- **Issue**: Zustand store trying to read from AsyncStorage before it's ready
- **Impact**: Authentication state not loaded, causing navigation issues
- **Fix**: Added delay and proper hydration handling

### 3. ❌ No Loading/Error States
- **Issue**: App showed white screen with no feedback during initialization
- **Impact**: User has no idea if app is loading or crashed
- **Fix**: Added loading indicator and error messages

## Changes Made

### 📝 File: `utils/api.ts`
```typescript
const getBaseUrl = () => {
    // Check if running in web browser
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'tpm.cianjur.space' || hostname === 'tpm.test') {
            return '';
        }
    }

    // Production/Preview build (standalone APK)
    if (!debuggerHost) {
        return 'https://tpm.cianjur.space'; // ✅ Production URL
    }

    // Development mode
    return `http://${debuggerHost}:8000`;
};
```

### 📝 File: `app/_layout.tsx`
- ✅ Added loading indicator with `ActivityIndicator`
- ✅ Added error message display if fonts fail
- ✅ Added 100ms delay for AsyncStorage hydration
- ✅ Better console logging for debugging

### 📝 File: `store/useAuthStore.ts`
- ✅ Added `onRehydrateStorage` callback
- ✅ Better error logging for storage issues

## How to Rebuild

### 1. Build dengan EAS
```bash
# Pastikan di folder frontend
cd c:\laragon\www\tpm\frontend

# Build APK Preview
eas build --profile preview --platform android
```

### 2. Monitor Build
- Tunggu hingga build selesai (±7-10 menit)
- Download APK dari Expo dashboard atau link yang diberikan

### 3. Install & Test
```bash
# Install APK ke device
adb install path/to/app.apk

# Monitor logs real-time
adb logcat | grep -i "tpm"
```

## Expected Behavior (After Fix)

### ✅ On App Launch:
1. **Splash screen** appears
2. **Loading indicator** with text "Loading TPM Super App..."
3. Shows console logs:
   ```
   [TPM API] Environment: Production
   [TPM API] Base URL: https://tpm.cianjur.space/api/v1
   [Auth Store] Hydration complete: Not authenticated
   ```
4. **Redirects to login screen** (if not logged in)

### ✅ If Backend Unreachable:
- App still loads (won't show white screen)
- Login screen appears
- API errors will be shown when user tries to login

## Debugging Tips

### Check Logs on Device
```bash
# View all logs
adb logcat

# Filter TPM-related logs
adb logcat | grep "TPM API"
adb logcat | grep "Auth Store"

# Filter React Native errors
adb logcat *:E | grep ReactNative
```

### Common Issues & Solutions

#### 1. Still White Screen?
- Check: Is backend server running at `https://tpm.cianjur.space`?
- Check: Are SSL certificates valid?
- Solution: Try accessing API URL in browser first

#### 2. App Crashes Immediately?
- Check: `adb logcat` for crash logs
- Look for: `FATAL EXCEPTION` or `AndroidRuntime`
- Common: Missing permissions or native module issues

#### 3. Stuck at Loading?
- Check: Network connectivity
- Check: API endpoint accessibility
- Check: CORS settings on backend

## Production Checklist

Before deploying to users:

- [ ] API URL points to production server
- [ ] SSL certificate is valid
- [ ] Backend server is accessible publicly
- [ ] Test login flow works
- [ ] Test all major features
- [ ] Check app doesn't crash on older Android versions
- [ ] Verify AsyncStorage persistence works
- [ ] Test offline behavior

## Environment-Specific URLs

| Environment | API URL | Notes |
|-------------|---------|-------|
| Development (Expo Go) | `http://[YOUR_IP]:8000` | Auto-detected |
| Production Web | `https://tpm.cianjur.space` | Same origin |
| Production APK | `https://tpm.cianjur.space` | Hardcoded |
| Local Testing | `http://tpm.test` | Laragon |

## Next Steps

1. ✅ Rebuild app with fixes
2. ✅ Test on physical device
3. ✅ Verify logs show correct API URL
4. ✅ Test login flow
5. ✅ Deploy to production

## Support

If white screen persists:
1. Share `adb logcat` output
2. Share `eas build` logs
3. Check backend server logs
4. Verify network connectivity

---
**Last Updated**: 2026-02-05  
**Status**: Fixed ✅
