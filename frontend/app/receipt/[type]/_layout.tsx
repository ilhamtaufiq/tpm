import { Stack } from 'expo-router';

export default function ReceiptTypeLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
