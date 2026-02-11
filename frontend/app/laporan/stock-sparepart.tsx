import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Package,
    AlertTriangle,
    Coins,
    BarChart3,
    Search
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency } from '../../utils/format';
import { TextInput } from 'react-native';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function StockSparepartReportScreen() {
    const router = useRouter();    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [stockStats, setStockStats] = useState<any>(null);
    const [parts, setParts] = useState<any[]>([]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [stats, partsData] = await Promise.all([
                bengkelService.getStockValue(),
                bengkelService.getSpareParts({ search, limit: 100 })
            ]);
            setStockStats(stats);
            setParts(Array.isArray(partsData) ? partsData : partsData?.data || []);
        } catch (error) {
            console.error('Error fetching stock report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Date Manipulation
    const handlePrev = () => {
        if (filterType === 'daily') setDate(curr => subDays(curr, 1));
        else if (filterType === 'monthly') setDate(curr => subMonths(curr, 1));
        else setDate(curr => subYears(curr, 1));
    };

    const handleNext = () => {
        if (filterType === 'daily') setDate(curr => addDays(curr, 1));
        else if (filterType === 'monthly') setDate(curr => addMonths(curr, 1));
        else setDate(curr => addYears(curr, 1));
    };

    useEffect(() => {
        fetchData();
    }, [search, date, filterType]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const getFormattedDate = () => {
        if (filterType === 'daily') return format(date, 'dd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const STATS = [
        {
            label: "Total Produk",
            value: stockStats?.total_products || 0,
            icon: Package,
            color: "#3B82F6", // Blue
            unit: "Item"
        },
        {
            label: "Total Stok",
            value: stockStats?.total_items || 0,
            icon: BarChart3,
            color: "#10B981", // Emerald
            unit: "Unit"
        },
        {
            label: "Nilai Aset",
            value: formatCurrency(stockStats?.total_value || 0),
            icon: Coins,
            color: "#F59E0B", // Amber
            isCurrency: true
        }
    ];

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/laporan');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </TouchableOpacity>
                    <Typography variant="h2" weight="bold">Laporan Stok</Typography>
                </View>
                <Badge variant="info" label={format(new Date(), 'dd/MM/yyyy')} className="px-3 py-1" />
            </View>

            {/* Date Filter Section (Standard Pattern) */}
            <View className="px-6 py-4 bg-white border-b border-gray-100">
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setFilterType(type)}
                            className={`flex-1 py-2 items-center rounded-lg ${filterType === type ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight="bold"
                                className={filterType === type ? 'text-primary' : 'text-gray-500'}
                            >
                                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="flex-row justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <TouchableOpacity
                        onPress={handlePrev}
                        className="p-1 bg-white rounded-full shadow-sm border border-gray-100"
                        activeOpacity={0.7}
                    >
                        <ChevronLeft size={20} color="#374151" />
                    </TouchableOpacity>

                    <View className="flex-row items-center">
                        <Calendar size={18} color="#4B5563" className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-gray-800 capitalize">
                            {getFormattedDate()}
                        </Typography>
                    </View>

                    <TouchableOpacity
                        onPress={handleNext}
                        className="p-1 bg-white rounded-full shadow-sm border border-gray-100"
                        activeOpacity={0.7}
                    >
                        <ChevronRight size={20} color="#374151" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                className="flex-1 p-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Stats Row Pattern */}
                <View className="flex-row justify-between mb-8">
                    {STATS.map((stat) => (
                        <Card key={stat.label} variant="outlined" className="w-[31%] p-3 items-center border-gray-100">
                            <View className="p-2 rounded-full mb-2" style={{ backgroundColor: `${stat.color}15` }}>
                                <stat.icon size={18} color={stat.color} />
                            </View>
                            <Typography
                                variant={stat.isCurrency ? "caption" : "h3"}
                                weight="bold"
                                style={{ color: stat.color }}
                                numberOfLines={1}
                            >
                                {stat.value}
                            </Typography>
                            <Typography variant="caption" className="text-center" numberOfLines={1}>{stat.label}</Typography>
                        </Card>
                    ))}
                </View>

                {/* Search */}
                <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 h-12 mb-6 border border-gray-100">
                    <Search size={20} color="#767676" />
                    <TextInput
                        placeholder="Cari sparepart..."
                        className="flex-1 ml-2 text-text font-outfit"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {/* Inventory Snapshot Table Header */}
                <View className="flex-row justify-between items-center mb-4">
                    <Typography variant="h3" weight="bold">Daftar Inventaris Kolektif</Typography>
                    <Typography variant="caption" className="text-gray-500">{parts.length} Item Ditampilkan</Typography>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#3B82F6" className="mt-10" />
                ) : (
                    <View className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                        {parts.map((part, index) => (
                            <View
                                key={part.id}
                                className={`p-4 flex-row items-center ${index !== parts.length - 1 ? 'border-b border-gray-50' : ''}`}
                            >
                                <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-4">
                                    <Typography weight="bold" className="text-gray-400 text-xs">{index + 1}</Typography>
                                </View>

                                <View className="flex-1">
                                    <Typography variant="body2" weight="bold">{part.nama}</Typography>
                                    <Typography variant="caption" className="text-gray-500">{part.kode} • {part.kategori || 'Suku Cadang'}</Typography>
                                </View>

                                <View className="items-end">
                                    <View className="flex-row items-center">
                                        <Typography variant="body2" weight="bold" className={part.stok <= part.stok_minimum ? 'text-error' : 'text-gray-800'}>
                                            {part.stok}
                                        </Typography>
                                        <Typography variant="caption" className="text-gray-400 ml-1">{part.satuan || 'Unit'}</Typography>
                                    </View>
                                    <Typography variant="caption" className="text-gray-500">
                                        Value: {formatCurrency(part.stok * part.harga_beli)}
                                    </Typography>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Info Note */}
                <View className="mt-6 bg-blue-50 p-4 rounded-2xl flex-row border border-blue-100 mb-20">
                    <AlertTriangle size={20} color="#3B82F6" className="mr-3" />
                    <View className="flex-1">
                        <Typography variant="caption" className="text-blue-800 leading-5">
                            Data stok ini adalah posisi inventaris per hari ini. Nilai aset dihitung berdasarkan (Stok × Harga Beli Terakhir).
                        </Typography>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
