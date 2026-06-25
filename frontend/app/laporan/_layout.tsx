import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function LaporanLayout() {
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
                headerStyle: { backgroundColor: '#F9FAFB' },
                headerShadowVisible: false,
                headerTintColor: '#023C69',
                headerTitleStyle: { fontWeight: 'bold' },
                contentStyle: { backgroundColor: '#F9FAFB' },
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="jasa-angkut" options={{ headerShown: false }} />
            <Stack.Screen name="laba-rugi" options={{ headerShown: false }} />
            <Stack.Screen name="neraca" options={{ headerShown: false }} />
            <Stack.Screen name="pembelian-mobil" options={{ headerShown: false }} />
            <Stack.Screen name="pembelian-sparepart" options={{ headerShown: false }} />
            <Stack.Screen name="penjualan-bengkel" options={{ headerShown: false }} />
            <Stack.Screen name="penjualan-mobil" options={{ headerShown: false }} />
            <Stack.Screen name="perubahan-modal" options={{ headerShown: false }} />
            <Stack.Screen name="stock-sparepart" options={{ headerShown: false }} />
        </Stack>
    );
}
