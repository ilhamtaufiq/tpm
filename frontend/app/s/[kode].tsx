import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import api from '../../utils/api';
import { Typography } from '../../components/ui/Typography';

// Link pendek struk: /s/{kode} mengambil tipe dan target lalu meneruskan ke halaman struk.
export default function ShortLinkScreen() {
    const { kode } = useLocalSearchParams<{ kode: string }>();
    const [gagal, setGagal] = useState(false);

    useEffect(() => {
        let batal = false;
        (async () => {
            try {
                const { data } = await api.get(`/public/short-link/${encodeURIComponent(String(kode))}`);
                if (!batal) {
                    router.replace(`/receipt/${data.tipe}/${encodeURIComponent(data.target)}` as any);
                }
            } catch {
                if (!batal) setGagal(true);
            }
        })();
        return () => {
            batal = true;
        };
    }, [kode]);

    return (
        <View className="flex-1 bg-background items-center justify-center px-8">
            <Stack.Screen options={{ headerShown: false }} />
            {gagal ? (
                <Typography className="text-textGray text-center">Link struk tidak ditemukan atau sudah tidak berlaku.</Typography>
            ) : (
                <ActivityIndicator />
            )}
        </View>
    );
}
