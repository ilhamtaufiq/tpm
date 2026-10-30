import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';

export default function JasaAngkutLayout() {
    const themeColors = useUIStore((s) => s.themeColors);
    const user = useAuthStore((s) => s.user);
    
    // Role-based access control (RBAC) at layout level
    const role = user?.role;
    const canAccess = role === 'ADMIN' || role === 'MANAGER' || role === 'JASA_ANGKUT';

    if (!canAccess) {
        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: themeColors.background },
                headerShadowVisible: false,
                headerTintColor: themeColors.text,
                headerTitleStyle: { fontWeight: 'bold' },
                contentStyle: { backgroundColor: themeColors.background },
                freezeOnBlur: true,
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="armada" options={{ headerShown: false }} />
            <Stack.Screen name="supir" options={{ headerShown: false }} />
            <Stack.Screen name="muatan/form" options={{ title: 'Input Muatan' }} />
        </Stack>
    );
}

