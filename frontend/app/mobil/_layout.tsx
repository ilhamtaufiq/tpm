import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function MobilLayout() {
    const { user } = useAuthStore();
    
    // Role-based access control (RBAC) at layout level
    const role = user?.role;
    const canAccess = role === 'ADMIN' || role === 'MANAGER' || role === 'MOBIL';

    if (!canAccess) {
        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="details" />
        </Stack>
    );
}
