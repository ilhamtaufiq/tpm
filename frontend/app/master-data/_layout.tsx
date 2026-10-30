import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';

export default function MasterDataLayout() {
    const themeColors = useUIStore((s) => s.themeColors);
    const user = useAuthStore((s) => s.user);
    
    // Role-based access control (RBAC) at layout level
    const role = user?.role;
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';
    const isAllowed = isAdmin || ['BENGKEL', 'JASA_ANGKUT', 'MOBIL'].includes(role || '');

    if (!isAllowed) {
        return <Redirect href="/(tabs)/home" />;
    }


    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: themeColors.background },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Data Master' }} />
            <Stack.Screen name="customer" options={{ title: 'Master Pelanggan' }} />
            <Stack.Screen name="supplier" options={{ title: 'Master Supplier' }} />
            <Stack.Screen name="sparepart" options={{ title: 'Master Sparepart' }} />
        </Stack>
    );
}
