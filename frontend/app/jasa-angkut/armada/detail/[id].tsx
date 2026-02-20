import React from 'react';
import { View, TouchableOpacity, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Edit } from 'lucide-react-native';
import { Typography } from '../../../../components/ui/Typography';
import { ArmadaDetail } from '../../../../components/jasa-angkut/ArmadaDetail';

export default function ArmadaDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/jasa-angkut');
        }
    };

    const handleEdit = () => {
        router.push(`/jasa-angkut/armada/form?id=${id}`);
    };

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <SafeAreaView edges={['top']} className="bg-white border-b border-gray-100">
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleBack}
                            className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-4 border border-gray-100"
                        >
                            <ChevronLeft size={24} color="#1C1C1C" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h3" weight="bold">Detail Armada</Typography>
                            <Typography variant="caption" className="text-textGray">Statistik & Riwayat</Typography>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleEdit}
                        className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center border border-primary/10"
                    >
                        <Edit size={20} color="#023C69" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Content */}
            {id ? (
                <ArmadaDetail id={parseInt(id)} />
            ) : (
                <View className="flex-1 items-center justify-center p-10">
                    <Typography className="text-textGray italic">ID Armada tidak ditemukan</Typography>
                </View>
            )}
        </View>
    );
}
