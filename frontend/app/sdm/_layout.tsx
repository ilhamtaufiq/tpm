import { Stack } from 'expo-router';

export default function SDMLayout() {
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
