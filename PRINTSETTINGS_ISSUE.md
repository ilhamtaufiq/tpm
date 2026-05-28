# PrintSettings Screen - Known Issue

**Status:** 🚫 **DISABLED TEMPORARILY**  
**Date:** 2026-02-06 23:24 WIB  
**Reason:** Persistent navigation context errors

---

## 🐛 **The Problem**

The `settings/print.tsx` screen consistently throws navigation context errors:
```
Error: Couldn't find a navigation context
```

### What We Tried

1. ❌ Removed `useRouter()` hook
2. ❌ Added error handling to router methods
3. ❌ Created navigation guard wrapper with `useNavigationState`
4. ❌ All attempts failed - error persists

### Root Cause Hypothesis

The error originates from **`CssInterop.View`** (NativeWind) wrapping **`SafeAreaView`**. This suggests:
- NativeWind's `className` prop on SafeAreaView might trigger navigation context lookups
- Timing issue where route params or navigation state is accessed during initial render
- Incompatibility between Expo Router, React Navigation, and NativeWind in this specific screen

---

## 🔧 **Recommended Solutions**

### Option 1: Disable PrintSettings (DONE FOR NOW)
- Remove link to PrintSettings from Profile screen
- Users can't access it, so no crashes
- Lose print configuration feature temporarily

### Option 2: Rebuild Without NativeWind className
- Replace all `className` props with `style` props
- Use StyleSheet.create for styling
- Remove NativeWind dependency from this screen only

### Option 3: Move to Different Route Structure
- Create print settings under a different route path
- Maybe `/(tabs)/profile/settings/print` instead of `/settings/print`
- Different nesting might resolve context issues

### Option 4: Use Modal Instead of Screen
- Convert to a modal overlay instead of a full screen
- Modals have different navigation context requirements
- Might avoid the routing issue entirely

---

## 📝 **Quick Fix: Disable the Feature**

To prevent users from encountering this crash:

### 1. Find where PrintSettings is linked from Profile screen
```bash
# Search for the link
grep -r "settings/print" frontend/app
```

### 2. Comment out or remove the link
```typescript
// Temporarily disabled due to navigation context error
// <Link href="/settings/print">Print Settings</Link>
```

### 3. Add a "Coming Soon" badge
```typescript
<View style={{ opacity: 0.5 }}>
    <Printer /> Print Settings (Coming Soon)
</View>
```

---

## 🚀 **Long-term Fix**

Once the blank screen issue RESOLUTION is confirmed and the app is stable, we can:

1. Investigate NativeWind className behavior with SafeAreaView
2. Check if upgrading/downgrading libraries helps
3. Rebuild the screen from scratch without className
4. Report issue to NativeWind/Expo Router teams if it's a bug

---

## 📊 **Priority**

**Low Priority** - This is a settings screen for print configuration, not core functionality.

**Higher Priority:**
1. ✅ Fix blank screen (DONE)
2. ⏳ Test APK build and installation
3. ⏳ Verify core features work (Login, Finance, Reports, etc.)
4. 🔜 Fix PrintSettings after core is stable

---

## 💡 **For Now**

**Recommendation:** 
- **Skip fixing this screen** for the current build
- **Focus on testing** the blank screen fix
- **Build and deploy APK** to verify main app works
- **Come back to PrintSettings** once app is proven stable

The print feature is nice-to-have, but not blocking the main release.

---

**Next Action:** Build APK without PrintSettings access and test core functionality.
