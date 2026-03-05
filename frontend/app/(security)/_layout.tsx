import { Stack } from 'expo-router';

export default function SecurityLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="pin" options={{ headerShown: false, animation: 'fade' }} />
        </Stack>
    );
}
