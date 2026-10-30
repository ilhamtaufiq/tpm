import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';

export default function FinanceLayout() {
    const themeColors = useUIStore((s) => s.themeColors);
    const user = useAuthStore((s) => s.user);
    const segments = useSegments();

    const role = user?.role;
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';
    const currentScreen = segments[segments.length - 1];
    const isUnitFinanceScreen = ['BENGKEL', 'MOBIL', 'JASA_ANGKUT'].includes(role || '') && (currentScreen === 'hutang' || currentScreen === 'piutang' || currentScreen === 'mutasi');

    if (!isAdmin && !isUnitFinanceScreen) {
        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: themeColors.background },
                headerShadowVisible: false,
                headerTintColor: themeColors.primary,
                headerTitleStyle: { fontWeight: 'bold' },
                contentStyle: { backgroundColor: themeColors.background },
            }}
        >
            <Stack.Screen name="expenses" options={{ headerShown: false }} />
            <Stack.Screen name="akun" options={{ headerShown: false }} />
            <Stack.Screen name="mutasi" options={{ headerShown: false }} />
            <Stack.Screen name="piutang" options={{ headerShown: false }} />
            <Stack.Screen name="hutang" options={{ headerShown: false }} />
            <Stack.Screen name="hutang-investor" options={{ headerShown: false }} />
        </Stack>
    );
}
