import { Stack } from 'expo-router';

export default function FinanceLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="akun" />
            <Stack.Screen name="mutasi" />
            <Stack.Screen name="hutang" />
            <Stack.Screen name="piutang" />
            <Stack.Screen name="laporan" />
            <Stack.Screen name="pencairan-investor" />
            <Stack.Screen name="user-cash" />
            <Stack.Screen name="expenses" />
        </Stack>
    );
}
