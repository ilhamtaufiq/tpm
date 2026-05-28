import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function SdmLayout() {
    const { user } = useAuthStore();
    
    // Role-based access control (RBAC) at layout level
    const role = user?.role;
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';

    const isAllowed = isAdmin || ['BENGKEL', 'JASA_ANGKUT', 'MOBIL'].includes(role || '');
    if (!isAllowed) {

        return <Redirect href="/(tabs)/home" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="karyawan" />
            <Stack.Screen name="absensi" />
            <Stack.Screen name="kasbon" />
            <Stack.Screen name="slip-gaji" />
        </Stack>
    );
}
