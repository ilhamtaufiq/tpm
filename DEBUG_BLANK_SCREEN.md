# Blank White Screen After Splash - Advanced Debug

## 🔍 Current Status
Setelah splash screen, app menampilkan blank white screen.

## ✅ Fixes Applied

### 1. Extended Timeouts
```tsx
// app/_layout.tsx
setTimeout(() => setIsReady(true), 500); // Was 100ms

// app/index.tsx  
setTimeout(() => setIsHydrated(true), 2000); // Was 800ms
```

### 2. Force Navigation Fallback
```tsx
// After 5 seconds, force navigate anyway
setTimeout(() => {
    setForceNav(true);
    setIsHydrated(true);
}, 5000);
```

### 3. Comprehensive Logging
Added console.log di setiap step untuk tracking:
- Font loading
- Splash screen hiding
- Store hydration
- Navigation decisions

### 4. Debug Escape Hatch
Button "Tap if stuck" muncul jika app stuck di loading screen

---

## 🐛 How to Debug

### Step 1: Check Logs via ADB
```bash
# Connect phone via USB
# Enable USB Debugging on phone

# View logs
adb logcat -s ReactNativeJS

# Look for these logs:
# - "LAYOUT: Fonts loaded"
# - "LAYOUT: Hiding splash screen"
# - "INDEX: Component mounted"
# - "INDEX: Hydration timeout complete"
# - "INDEX: Redirecting..."
```

### Step 2: Look for Errors
```bash
# Filter for errors only
adb logcat -s ReactNativeJS | grep -i error

# Common errors:
# - "Cannot read property"
# - "undefined is not an object"  
# - "null is not an object"
```

### Step 3: Check Navigation
```bash
# Look for navigation logs
adb logcat -s ReactNativeJS | grep -i "redirect\|navigate"
```

---

## 🎯 Possible Root Causes

### 1. Fonts Not Loading
**Symptom**: Stuck after splash, no UI appears

**Check**:
```typescript
// In _layout.tsx
const [loaded, error] = useFonts({...});
console.log('Fonts:', loaded, error);
```

**Fix**: Add font loading timeout
```typescript
useEffect(() => {
    // Force continue after 10s even if fonts fail
    const timeout = setTimeout(() => {
        if (!loaded && !error) {
            console.warn('Font timeout, continuing anyway');
            setIsReady(true);
        }
    }, 10000);
    return () => clearTimeout(timeout);
}, [loaded, error]);
```

### 2. AsyncStorage Not Working
**Symptom**: Store never hydrates, stuck in loading

**Check**:
```bash
# Look for hydration logs
adb logcat | grep "Auth Store.*Hydration"
```

**Fix**: Add AsyncStorage check
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

useEffect(() => {
    const testStorage = async () => {
        try {
            await AsyncStorage.setItem('test', 'value');
            const value = await AsyncStorage.getItem('test');
            console.log('AsyncStorage works:', value);
        } catch (e) {
            console.error('AsyncStorage broken:', e);
        }
    };
    testStorage();
}, []);
```

### 3. Navigation Stack Issue
**Symptom**: Redirect doesn't work

**Check logs for**:
- "INDEX: Redirecting to..."
- Check if redirect actually happens

**Fix**: Use router.replace instead of Redirect
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

useEffect(() => {
    if (isHydrated) {
        console.log('Navigating via router');
        router.replace(isAuthenticated ? '/(tabs)/home' : '/(auth)/login');
    }
}, [isAuthenticated, isHydrated]);

// Don't return <Redirect />, return null
return null;
```

### 4. JavaScript Error
**Symptom**: Silent crash to white screen

**Check**: ErrorBoundary should catch this

**Fix**: Verify ErrorBoundary is wrapping app
```tsx
// app/_layout.tsx
return (
    <ErrorBoundary> {/* Make sure this exists */}
        <QueryClientProvider>
            <Stack>...</Stack>
        </QueryClientProvider>  
    </ErrorBoundary>
);
```

### 5. Global CSS Not Loading
**Symptom**: Elements render but invisible/unstyled

**Check**: Verify NativeWind setup
```typescript
// app/_layout.tsx - Should be at top
import '../global.css';
```

**Fix**: Force inline styles temporarily
```tsx
// Test with pure inline styles (no Tailwind)
<View style={{ flex: 1, backgroundColor: 'red' }}>
    <Text style={{ color: 'white', fontSize: 24 }}>
        If you see this, CSS is the problem
    </Text>
</View>
```

---

## 🚀 Quick Tests

### Test 1: Minimal App
Replace `app/index.tsx` temporarily:
```tsx
import { View, Text } from 'react-native';

export default function Index() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'green' }}>
            <Text style={{ color: 'white', fontSize: 32 }}>TEST WORKS</Text>
        </View>
    );
}
```

If this shows → Problem is in navigation/auth logic
If still blank → Problem is in _layout or build config

### Test 2: Skip Hydration
```tsx
// Force skip hydration check
const [isHydrated, setIsHydrated] = useState(true); // Start as true

// Comment out timeout
// useEffect(() => {...}, []);
```

If this works → AsyncStorage hydration is too slow/broken
If still blank → Different issue

### Test 3: Direct Navigation
```tsx
// Skip all logic, go directly to login
export default function Index() {
    return <Redirect href="/(auth)/login" />;
}
```

If this works → Auth store/hydration issue
If still blank → Login page has problem

---

## 📱 Device-Specific Issues

### Old/Slow Android Devices
```tsx
// Increase all timeouts
setTimeout(() => setIsReady(true), 1000);     // _layout
setTimeout(() => setIsHydrated(true), 3000);  // index
```

### Hermes Engine Issues
Try disabling Hermes in `app.json`:
```json
{
  "expo": {
    "android": {
      "jsEngine": "jsc"
    }
  }
}
```

### Android API Level Issues
Some features not available on older Android:
```json
{
  "expo": {
    "android": {
      "minSdkVersion": 23  // Minimum Android 6.0
    }
  }
}
```

---

## 🔧 Nuclear Options

### Option 1: Remove All Optimizations
```tsx
// app/_layout.tsx
// Remove font loading check
if (!loaded) {
    // Just show placeholder, don't wait
    return <View><Text>Loading...</Text></View>;
}
```

### Option 2: Disable Zustand Persist
```typescript
// store/useAuthStore.ts
// Disable persistence temporarily
export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    // ... rest without persist middleware
}));
```

### Option 3: Use expo-router push instead of Redirect
```tsx
import { useRouter } from 'expo-router';

export default function Index() {
    const router = useRouter();
    
    useEffect(() => {
        // Direct navigation
        router.push('/(auth)/login');
    }, []);
    
    return <View><Text>Redirecting...</Text></View>;
}
```

---

## ✅ Verification Checklist

After rebuild, check:
- [ ] See splash screen ✅
- [ ] See "Memuat TPM Super App" loading screen
- [ ] See console logs in adb logcat
- [ ] App navigates to login/home after 2 seconds
- [ ] No white screen

---

## 📊 Expected Log Flow

```
1. LAYOUT: Fonts loaded: true
2. LAYOUT: Hiding splash screen
3. LAYOUT: Setting isReady to true
4. INDEX: Component mounted
5. INDEX: isAuthenticated (initial): false
6. INDEX: Hydration timeout complete
7. INDEX: isAuthenticated (after hydration): false
8. INDEX: Redirecting to Login
9. (Login screen appears)
```

If logs stop at step 5-6 → Hydration stuck
If logs complete but no navigation → Redirect broken
If no logs at all → JavaScript crash before index

---

## 🆘 If Still Blank

Share these logs:
```bash
# Get last 500 lines
adb logcat -d | tail -500

# Or save to file
adb logcat -d > logcat.txt
```

Look for:
- Last console.log before it goes blank
- Any Error or Fatal messages
- React Native errors
- Native crashes

---

## 💡 Current Build Has
✅ Extended timeout (2s + 5s fallback)
✅ Debug button to force navigate
✅ Comprehensive logging
✅ ErrorBoundary
✅ Multiple fallbacks

**Next**: Rebuild and test with `adb logcat` running to see logs.
