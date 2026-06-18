import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function AuthLayout() {
    const { isAuthenticated, hasHydrated } = useAuthStore();

    if (hasHydrated && isAuthenticated) {
        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="otp" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="reset-password" />
        </Stack>
    );
}
