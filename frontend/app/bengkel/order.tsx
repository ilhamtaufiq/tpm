import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BengkelForm } from '../../components/BengkelForm';
import { useTransaksiBengkelDetail } from '../../hooks/useBengkel';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { isBengkelTransactionLocked } from '../../utils/bengkelTransaction';

export default function BengkelOrderScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const orderId = id ? Number(id) : null;

    // Fetch details if we are editing an existing order
    const { data: detailData, isLoading } = useTransaksiBengkelDetail(orderId);

    const handleSuccess = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    if (orderId && isLoading) {
        return (
            <View className="flex-1 bg-surface items-center justify-center">
                <ActivityIndicator size="large" color="#023C69" />
            </View>
        );
    }

    if (orderId && detailData && isBengkelTransactionLocked(detailData)) {
        return (
            <View className="flex-1 bg-white">
                <StatusBar barStyle="dark-content" />
                <Header
                    title="Edit Antrian"
                    showBackButton={true}
                    onBackButtonPress={handleSuccess}
                    showProfile={false}
                />
                <View className="flex-1 items-center justify-center px-8">
                    <Typography weight="bold" className="text-gray-700 text-center mb-2">
                        Transaksi Sudah Lunas & Selesai
                    </Typography>
                    <Typography className="text-gray-500 text-center text-sm">
                        Order ini tidak dapat diedit lagi.
                    </Typography>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <Header 
                title={orderId ? "Edit Antrian" : "Buat Antrian Bengkel"}
                showBackButton={true}
                onBackButtonPress={handleSuccess}
                showProfile={false}
            />
            <View className="flex-1">
                <BengkelForm 
                    initialData={detailData}
                    onSuccess={handleSuccess}
                    isPage={true}
                />
            </View>
        </View>
    );
}
