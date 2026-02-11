import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Typography } from '../components/ui/Typography';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View className="flex-1 items-center justify-center p-5 bg-surface">
                <Typography variant="h1" weight="bold">Halaman Tidak Ditemukan</Typography>
                <Link href="/" className="mt-4 py-4">
                    <Typography className="text-primary font-bold">Kembali ke Beranda</Typography>
                </Link>
            </View>
        </>
    );
}
