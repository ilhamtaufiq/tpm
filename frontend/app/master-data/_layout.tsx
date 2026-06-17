import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function MasterDataLayout() {
    const { user } = useAuthStore();
    
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
                contentStyle: { backgroundColor: '#F9FAFB' },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Data Master' }} />
            <Stack.Screen name="customer" options={{ title: 'Master Pelanggan' }} />
            <Stack.Screen name="supplier" options={{ title: 'Master Supplier' }} />
            <Stack.Screen name="sparepart" options={{ title: 'Master Sparepart' }} />
        </Stack>
    );
}
