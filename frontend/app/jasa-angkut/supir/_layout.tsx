import { Stack } from 'expo-router';

export default function SupirLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="form" options={{ headerShown: true, title: 'Form Supir' }} />
        </Stack>
    );
}
