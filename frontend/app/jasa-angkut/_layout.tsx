import { Stack } from 'expo-router';

export default function JasaAngkutLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: '#F9FAFB' },
                headerShadowVisible: false,
                headerTintColor: '#111827',
                headerTitleStyle: { fontWeight: 'bold' },
                contentStyle: { backgroundColor: '#F9FAFB' },
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="armada" options={{ headerShown: false }} />
            <Stack.Screen name="armada/detail/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="armada/form" options={{ title: 'Form Armada' }} />
            <Stack.Screen name="supir" options={{ headerShown: false }} />
            <Stack.Screen name="supir/form" options={{ title: 'Form Supir' }} />
            <Stack.Screen name="muatan/form" options={{ title: 'Input Muatan' }} />
        </Stack>
    );
}
