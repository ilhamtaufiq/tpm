import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BengkelForm } from '../../components/BengkelForm';
import { useTransaksiBengkelDetail } from '../../hooks/useBengkel';
import { Header } from '../../components/ui/Header';

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
