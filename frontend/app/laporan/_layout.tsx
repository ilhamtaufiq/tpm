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
            <Stack.Screen name="index" options={{ title: 'Laporan Bisnis' }} />
            <Stack.Screen name="jasa-angkut" />
            <Stack.Screen name="laba-rugi" />
            <Stack.Screen name="neraca" />
            <Stack.Screen name="pembelian-mobil" />
            <Stack.Screen name="pembelian-sparepart" />
            <Stack.Screen name="penjualan-bengkel" />
            <Stack.Screen name="penjualan-mobil" />
            <Stack.Screen name="perubahan-modal" />
            <Stack.Screen name="stock-sparepart" />
        </Stack>
    );
}
