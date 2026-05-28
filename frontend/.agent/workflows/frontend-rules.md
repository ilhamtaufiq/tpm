---
description: Frontend development guidelines for TPM Super App
---

# TPM Frontend Development Rules

## MANDATORY PATTERNS

### 1. Screen Wrapper
Always use `SafeAreaView` from `react-native-safe-area-context`:
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyScreen() {
    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />
            {/* content */}
        </SafeAreaView>
    );
}
```

### 2. Custom Header (NOT Stack.Screen header)
Use custom header with back button and Typography:
```tsx
<View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
    <View className="flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color="#1C1C1C" />
        </TouchableOpacity>
        <Typography variant="h2" weight="bold">Screen Title</Typography>
    </View>
    <View className="flex-row">
        {/* Action buttons */}
    </View>
</View>
```

In `_layout.tsx`, set `headerShown: false` for screens using custom headers.

### 3. Typography Component (NOT raw Text)
Always use `Typography` component instead of `Text`:
```tsx
// ❌ WRONG
<Text className="text-lg font-bold">Hello</Text>

// ✅ CORRECT
<Typography variant="h3" weight="bold">Hello</Typography>
```

### 4. Form Entry (Hybrid UI: Bottom Sheet & Modal)
Standardize form displays across platforms. Use native `@gorhom/bottom-sheet` for Mobile and a custom `Modal` for Web to ensure reliability and prevent layout issues.

```tsx
// 1. Create a content renderer for the form
const renderSheetContent = () => (
    <View style={{ flex: 1 }}>
        <BengkelForm onSuccess={handleClosePress} />
    </View>
);

// 2. Implement Hybrid UI in the return statement
{Platform.OS === 'web' ? (
    <Modal visible={sheetIndex !== -1} transparent={true} animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
            <TouchableOpacity className="absolute inset-0" onPress={handleClosePress} />
            <View className="bg-white rounded-t-[32px] w-full max-w-[640px] h-[90%] self-center p-4">
                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                {renderSheetContent()}
            </View>
        </View>
    </Modal>
) : (
    <BottomSheet ref={bottomSheetRef} index={sheetIndex} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ borderRadius: 32 }}>
        {renderSheetContent()}
    </BottomSheet>
)}
```
**CRITICAL RULES:**
- **Web Ghosting**: Do NOT use just `index={-1}` with `expand()` on Web; always hide/unmount using `Modal` or `display: none` to prevent the form from "peeking" at the bottom.
- **Scroll Conflict**: Inside `BottomSheet`, use `BottomSheetScrollView`. Avoid wrapping content with `BottomSheetView` if it prevents internal scrolling.
- **Mobile Keyboard**: Wrap Mobile content with `KeyboardAvoidingView` inside the form component.

### 5. Stats Row Pattern
For dashboard screens, use stats cards:
```tsx
<View className="flex-row justify-between mb-8">
    {STATS.map((stat) => (
        <Card key={stat.label} variant="outlined" className="w-[31%] p-3 items-center border-gray-100">
            <View className="p-2 rounded-full mb-2" style={{ backgroundColor: `${stat.color}15` }}>
                <stat.icon size={18} color={stat.color} />
            </View>
            <Typography variant="h3" weight="bold" style={{ color: stat.color }}>{value}</Typography>
            <Typography variant="caption">{stat.label}</Typography>
        </Card>
    ))}
</View>
```

### 6. Badge Variants
Only use valid variants: `'success' | 'warning' | 'error' | 'info' | 'neutral'`
```tsx
// ❌ WRONG
<Badge variant="secondary" />
<Badge variant="danger" />

// ✅ CORRECT
<Badge variant="error" />
<Badge variant="neutral" />
```

### 7. Button & Interactive Elements
- **Title Property**: Always use `title` prop, not `label`.
- **Loading State**: Always pass `loading` prop from the mutation's `isPending` state.
- **Form Padding**: Always add `paddingBottom: 24` (or more) to the container wrapping the submit button to ensure it doesn't touch the bottom or get cut off.

```tsx
// ✅ CORRECT
<Button 
    title="Submit Data" 
    onPress={handleSubmit} 
    loading={mutation.isPending} 
    className="rounded-2xl" 
/>
```

### 8. List Empty Component
Return `null` not `false`:
```tsx
// ❌ WRONG
ListEmptyComponent={!loading && <EmptyView />}

// ✅ CORRECT
ListEmptyComponent={loading ? null : <EmptyView />}
```

### 9. Date Filter Pattern (Report Pages)
For report pages, use the standard Daily/Monthly/Yearly tab filter with date navigation:
```tsx
// Imports
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// State
type FilterType = 'daily' | 'monthly' | 'yearly';
const [filterType, setFilterType] = useState<FilterType>('monthly');
const [date, setDate] = useState(new Date());

// Filter UI
<View className="px-6 py-4 bg-white border-b border-gray-100">
    {/* Tabs */}
    <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
        {/* Map through 'daily', 'monthly', 'yearly' */}
    </View>

    {/* Navigator */}
    <View className="flex-row justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
        <TouchableOpacity onPress={handlePrev}>{/* ChevronLeft */}</TouchableOpacity>
        <Typography>{getFormattedDate()}</Typography>
        <TouchableOpacity onPress={handleNext}>{/* ChevronRight */}</TouchableOpacity>
    </View>
</View>
```

## REFERENCE FILES
- **Bengkel Module**: `app/bengkel/index.tsx` - Reference implementation
- **Design Guide**: `TPM_Frontend_Guide_Gemini.md` - Full design system
- **Components**: `components/ui/` - Reusable UI components

## ERROR PREVENTION & BEST PRACTICES

### 1. Avoid Duplicate Declarations
When refactoring, ensure that common handlers like `handleFormSuccess`, `handleCloseSheet`, or state variables aren't already declared elsewhere in the file. TypeScript/RN will crash on duplicates.

### 2. Standardized Hook Naming
Always use the agreed-upon hook names:
- **Finance**: `useKeuangan` (NOT `useFinance`)
- **SDM**: `useSDM`
- **Master Data**: `useMasterData`
- **Bengkel**: `useBengkel`

### 3. Navigation Imports
Always import `useNavigation` from `@react-navigation/native`, NOT `@react-navigation/core` or other sub-packages.

### 4. Dependency Awareness
Before importing a library like `date-fns` or `expo-constants`, check `package.json`. If missing, install it with `--legacy-peer-deps` to avoid React 19/React Native 0.83 peer dependency conflicts.

### 5. Component Flexiblity (EmptyState)
The `EmptyState` component supports both string keys (`'empty'`, `'search'`) and custom Lucide icon components. Use custom icons for specific module context.

### 6. Clean Imports
- Do not import `keuanganService` if only using hooks from `useKeuangan`.
- Remove unused Lucide icons from import blocks to keep the code clean.
- Ensure `BottomSheet` related components are imported from `@gorhom/bottom-sheet`.

### 7. Scroll Refresh Logic
- **Import**: `RefreshControl` for pull-to-refresh MUST be imported from `react-native`, not `lucide-react-native`.
- **Naming**: Use `import { RefreshControl as RNRefreshControl } from 'react-native'` to avoid confusion if `RefreshControl` icon existed.
- **Implementation**: Always use the `refreshControl` prop on `ScrollView` or `FlatList`.
