import { Stack } from 'expo-router';

export default function ArmadaLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="form" options={{ headerShown: true, title: 'Form Armada' }} />
            <Stack.Screen name="detail/[id]" />
        </Stack>
    );
}
