import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../../../components/ui/Header';
import { Typography } from '../../../../components/ui/Typography';
import SparepartForm, { SparePartFormData } from '../../../../components/forms/SparepartForm';
import { useSparePartDetail } from '../../../../hooks';
import { formatNumber } from '../../../../utils/format';

export default function EditSparepartScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const sparepartId = Number(id);

    const { data: sparepart, isLoading } = useSparePartDetail(sparepartId);

    const [formData, setFormData] = useState<SparePartFormData | null>(null);

    useEffect(() => {
        if (sparepart) {
            setFormData({
                id: sparepart.id,
                kode: sparepart.kode,
                kode_part: sparepart.kode_part || '',
                kode_ean: sparepart.kode_ean || '',
                nama: sparepart.nama,
                harga_beli: formatNumber(sparepart.harga_beli?.toString() || '0'),
                harga_jual: formatNumber(sparepart.harga_jual?.toString() || '0'),
                stok: (sparepart.stok || 0).toString(),
                stok_minimum: (sparepart.stok_minimum || 5).toString(),
                kategori: sparepart.kategori || 'Umum',
                merek: sparepart.merek || '',
                satuan: sparepart.satuan || 'pcs',
                lokasi_rak: sparepart.lokasi_rak || '',
                catatan: sparepart.catatan || '',
                gambar: sparepart.gambar,
            });
        }
    }, [sparepart]);

    if (isLoading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="Edit Sparepart" showBackButton onBackButtonPress={router.back} />
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#16A34A" />
                </View>
            </View>
        );
    }

    if (!sparepart || !formData) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="Edit Sparepart" showBackButton onBackButtonPress={router.back} />
                <View className="flex-1 items-center justify-center px-8">
                    <Typography className="text-textGray text-center">
                        Data sparepart tidak ditemukan
                    </Typography>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header title="Edit Sparepart" showBackButton onBackButtonPress={router.back} />
            <View className="flex-1">
                <SparepartForm initialData={formData} onSuccess={() => router.back()} />
            </View>
        </View>
    );
}
