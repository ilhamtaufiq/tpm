import os

file_path = "frontend/app/bengkel/purchase/index.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
old_import = "import { SafeAreaView } from 'react-native-safe-area-context';"
new_import = "import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { getCustomTabBarBottomPadding } from '../../../components/ui/CustomTabBar';"
if old_import in content:
    content = content.replace(old_import, new_import)
else:
    print("WARNING: old_import not found")

# 2. Add insets call
old_hook = 'export default function PurchaseScreen() {\n    const router = useRouter(); const queryClient = useQueryClient();\n    const params = useLocalSearchParams<{ id?: string }>();'
new_hook = 'export default function PurchaseScreen() {\n    const router = useRouter(); const queryClient = useQueryClient();\n    const params = useLocalSearchParams<{ id?: string }>();\n    const insets = useSafeAreaInsets();'
if old_hook in content:
    content = content.replace(old_hook, new_hook)
else:
    # Try with different line endings/spaces just in case
    old_hook_alt = 'export default function PurchaseScreen() {\r\n    const router = useRouter(); const queryClient = useQueryClient();\r\n    const params = useLocalSearchParams<{ id?: string }>();'
    new_hook_alt = 'export default function PurchaseScreen() {\r\n    const router = useRouter(); const queryClient = useQueryClient();\r\n    const params = useLocalSearchParams<{ id?: string }>();\r\n    const insets = useSafeAreaInsets();'
    if old_hook_alt in content:
        content = content.replace(old_hook_alt, new_hook_alt)
    else:
        print("WARNING: old_hook not found")

# 3. Update ScrollView style
old_scroll = '<ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>'
new_scroll = '<ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) }} showsVerticalScrollIndicator={false}>'
if old_scroll in content:
    content = content.replace(old_scroll, new_scroll)
else:
    print("WARNING: old_scroll not found")

with open(file_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Replacement complete")
