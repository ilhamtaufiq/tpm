import { Stack } from 'expo-router';

export default function ArmadaLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="form" />
            <Stack.Screen name="detail/[id]" />
        </Stack>
    );
}
