import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import {
    ChevronLeft,
    Search,
    Plus,
    AlertTriangle,
    Package,
    ArrowUpDown,
    Filter,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSparePartsList, useLowStockParts } from '../../../hooks/useBengkel';
import { SkeletonCard, SkeletonListItem } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RefreshControl as RNRefreshControl } from 'react-native';
import { formatCurrency } from '../../../utils/format';

const PARTS = [
    { id: '1', nama: 'Oli MPX 2 0.8L', kode: 'OL-001', stok: 2, stok_minimum: 5, price: 'Rp 65.000', category: 'Pelumas' },
    { id: '2', nama: 'Busi Honda Genio', kode: 'BS-042', stok: 15, stok_minimum: 5, price: 'Rp 25.000', category: 'Elektrik' },
    { id: '3', nama: 'Kampas Rem Depan Vario', kode: 'KR-012', stok: 4, stok_minimum: 10, price: 'Rp 45.000', category: 'Rem' },
    { id: '4', nama: 'Van Belt Beat ESP', kode: 'VB-005', stok: 8, stok_minimum: 3, price: 'Rp 145.000', category: 'Transmisi' },
];

export default function InventoryScreen() {
    const router = useRouter(); const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // API Hooks
    const { data: partsData, isLoading, refetch } = useSparePartsList({ search });
    const { data: lowStockData } = useLowStockParts();

    const parts = Array.isArray(partsData) ? partsData : partsData?.data || partsData?.items || [];
    const lowStockCount = lowStockData?.length || 0;

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </TouchableOpacity>
                    <Typography variant="h2" weight="bold">Stok Sparepart</Typography>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/bengkel/purchase')}
                    className="bg-primary/10 px-3 py-1.5 rounded-full flex-row items-center"
                >
                    <Plus size={16} color="#00AA13" />
                    <Typography className="text-primary text-xs font-bold ml-1">Restock</Typography>
                </TouchableOpacity>
            </View>

            <View className="p-6 pb-0">
                {/* Search & Filter */}
                <View className="flex-row items-center space-x-3 mb-6">
                    <View className="flex-1 flex-row items-center bg-gray-100 rounded-2xl px-4 h-12">
                        <Search size={20} color="#767676" />
                        <TextInput
                            placeholder="Cari nama atau kode part..."
                            className="flex-1 ml-2 text-text font-outfit"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity className="w-12 h-12 bg-gray-100 rounded-2xl items-center justify-center">
                        <Filter size={20} color="#1C1C1C" />
                    </TouchableOpacity>
                </View>

                {/* Low Stock Banner */}
                {lowStockCount > 0 && (
                    <Card className="bg-secondary/10 border border-secondary/20 p-4 mb-6 flex-row items-center">
                        <View className="bg-secondary p-2 rounded-full mr-4">
                            <AlertTriangle size={20} color="white" />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body2" weight="bold" className="text-secondary">Peringatan Stok Menipis</Typography>
                            <Typography variant="caption" className="text-secondary/80">Ada {lowStockCount} item yang berada di bawah stok minimum.</Typography>
                        </View>
                    </Card>
                )}
            </View>

            <ScrollView
                className="flex-1 px-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : parts.length === 0 ? (
                    <EmptyState
                        title="Sparepart tidak ditemukan"
                        description={search ? `Tidak ada hasil untuk "${search}"` : "Belum ada item sparepart di database."}
                        icon={Package}
                    />
                ) : (
                    parts.map((part: any) => (
                        <Card key={part.id} className="mb-4 p-4 flex-row items-center">
                            <View className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center mr-4">
                                <Package size={24} color={part.stok < part.stok_minimum ? '#EE2737' : '#00AA13'} />
                            </View>

                            <View className="flex-1">
                                <Typography variant="body2" weight="bold">{part.nama}</Typography>
                                <Typography variant="caption">{part.kode} • {part.kategori || 'Suku Cadang'}</Typography>

                                <View className="flex-row items-center mt-2">
                                    <Typography variant="caption" weight="bold">Stok: </Typography>
                                    <Typography
                                        variant="caption"
                                        weight="bold"
                                        className={part.stok < part.stok_minimum ? 'text-secondary' : 'text-primary'}
                                    >
                                        {part.stok} {part.satuan || 'Unit'}
                                    </Typography>
                                    <Typography variant="caption" className="text-gray-400 ml-1">(Min: {part.stok_minimum})</Typography>
                                </View>
                            </View>

                            <View className="items-end">
                                <Typography variant="body2" weight="bold">{formatCurrency(part.harga_jual)}</Typography>
                                <TouchableOpacity
                                    className="mt-2 bg-gray-50 px-2 py-1 rounded-md"
                                    onPress={() => {/* Detail modal/page */ }}
                                >
                                    <Typography className="text-primary text-[10px] font-bold">Detail</Typography>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
