import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function BengkelLayout() {
    const { user } = useAuthStore();
    
    // Role-based access control (RBAC) at layout level
    const role = user?.role;
    const canAccess = role === 'ADMIN' || role === 'MANAGER' || role === 'BENGKEL';

    if (!canAccess) {
        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false, freezeOnBlur: true }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="inventory" />
            <Stack.Screen name="purchase" />
            <Stack.Screen name="order" />
            <Stack.Screen name="queue" />
        </Stack>
    );
}
