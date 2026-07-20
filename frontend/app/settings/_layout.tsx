import { Stack } from 'expo-router';

export default function SettingsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="navigation" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="password" />
            <Stack.Screen name="theme" />
            <Stack.Screen name="bluetooth" />
            <Stack.Screen name="print" />
            <Stack.Screen name="smtp" />
            <Stack.Screen name="security-features" />
            <Stack.Screen name="users" />
            <Stack.Screen name="backup" />
            <Stack.Screen name="data-import" />
        </Stack>
    );
}
