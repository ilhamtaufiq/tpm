import { Stack } from 'expo-router';

export default function BengkelLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="inventory" />
            <Stack.Screen name="purchase" />
        </Stack>
    );
}
