import { Stack } from 'expo-router';

export default function LaporanLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="jasa-angkut" />
            <Stack.Screen name="laba-rugi" />
            <Stack.Screen name="neraca" />
            <Stack.Screen name="pembelian-mobil" />
            <Stack.Screen name="pembelian-sparepart" />
            <Stack.Screen name="penjualan-bengkel" />
            <Stack.Screen name="penjualan-mobil" />
            <Stack.Screen name="perubahan-modal" />
            <Stack.Screen name="stock-sparepart" />
        </Stack>
    );
}
