import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function FinanceLayout() {
    const { user } = useAuthStore();
    const segments = useSegments();

    const role = user?.role;
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';
    const currentScreen = segments[segments.length - 1];
    const isUnitFinanceScreen = ['BENGKEL', 'MOBIL', 'JASA_ANGKUT'].includes(role || '') && (currentScreen === 'hutang' || currentScreen === 'piutang');

    if (!isAdmin && !isUnitFinanceScreen) {
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
            <Stack.Screen name="akun" options={{ title: 'Daftar Akun & Saldo' }} />
            <Stack.Screen name="mutasi" options={{ title: 'Mutasi Kas & Bank' }} />
            <Stack.Screen name="piutang" options={{ title: 'Kelola Piutang' }} />
            <Stack.Screen name="hutang" options={{ title: 'Kelola Hutang' }} />
        </Stack>
    );
}
