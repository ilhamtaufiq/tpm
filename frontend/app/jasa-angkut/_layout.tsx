import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function JasaAngkutLayout() {
    const { user } = useAuthStore();
    
    // Role-based access control (RBAC) at layout level
    const role = user?.role;
    const canAccess = role === 'ADMIN' || role === 'MANAGER' || role === 'JASA_ANGKUT';

    if (!canAccess) {
        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: '#F9FAFB' },
                headerShadowVisible: false,
                headerTintColor: '#111827',
                headerTitleStyle: { fontWeight: 'bold' },
                contentStyle: { backgroundColor: '#F9FAFB' },
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

