import { Stack } from 'expo-router';

export default function MasterDataLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="customer" />
            <Stack.Screen name="supplier" />
            <Stack.Screen name="asset" />
            <Stack.Screen name="jasa-servis" />
            <Stack.Screen name="sparepart" />
        </Stack>
    );
}
