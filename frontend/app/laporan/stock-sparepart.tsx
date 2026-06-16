import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
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
    Search,
    Printer,
    Download,
    Eye,
    Share2,
    X
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency } from '../../utils/format';
import { printReportHTML } from '../../utils/printReport';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function StockSparepartReportScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <Typography variant="h2" weight="bold">Laporan Stok</Typography>
                </View>
                <View className="flex-row items-center">
                    <Badge variant="info" label={format(new Date(), 'dd/MM/yyyy')} className="px-3 py-1 mr-2" />
                    <Pressable
                        onPress={() => setShowExportMenu(true)}
                        disabled={isExporting}
                        className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100"
                    >
                        <Download size={20} color="#023C69" />
                    </Pressable>
                </View>
            </View>

            {/* Date Filter Section (Standard Pattern) */}
            <View className="px-6 py-4 bg-white border-b border-gray-100">
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
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
                        </Pressable>
                    ))}
                </View>

                <View className="flex-row justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Pressable
                        onPress={handlePrev}
                        style={({ pressed }) => ({
                            padding: 4,
                            backgroundColor: 'white',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: '#F3F4F6',
                            opacity: pressed ? 0.7 : 1
                        })}
                    >
                        <ChevronLeft size={20} color="#374151" />
                    </Pressable>

                    <View className="flex-row items-center">
                        <Calendar size={18} color="#4B5563" className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-gray-800 capitalize">
                            {getFormattedDate()}
                        </Typography>
                    </View>

                    <Pressable
                        onPress={handleNext}
                        style={({ pressed }) => ({
                            padding: 4,
                            backgroundColor: 'white',
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: '#F3F4F6',
                            opacity: pressed ? 0.7 : 1
                        })}
                    >
                        <ChevronRight size={20} color="#374151" />
                    </Pressable>
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
                                        <Typography variant="body2" weight="bold" className={part.stok === 999 ? 'text-emerald-600' : (part.stok <= part.stok_minimum ? 'text-error' : 'text-gray-800')}>
                                            {part.stok === 999 ? 'Ready' : part.stok}
                                        </Typography>
                                        <Typography variant="caption" className="text-gray-400 ml-1">{part.satuan || 'Unit'}</Typography>
                                    </View>
                                    <Typography variant="caption" className="text-gray-500">
                                        Value: {part.stok === 999 ? formatCurrency(0) : formatCurrency(part.stok * part.harga_beli)}
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

            {/* Export Action Menu */}
            <Modal
                visible={showExportMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExportMenu(false)}
            >
                <Pressable
                    className="flex-1 bg-black/50 justify-end"
                    onPress={() => setShowExportMenu(false)}
                >
                    <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-8">
                            <View>
                                <Typography variant="h3" weight="bold">Ekspor Laporan Stok</Typography>
                                <Typography variant="caption" className="text-gray-500">Pilih metode ekspor dokumen PDF</Typography>
                            </View>
                            <Pressable onPress={() => setShowExportMenu(false)} className="bg-background p-2 rounded-full">
                                <X size={20} color="#64748B" />
                            </Pressable>
                        </View>

                        <View className="flex-row gap-4">
                            <Pressable
                                onPress={async () => {
                                    setShowExportMenu(false);
                                    if (!stockStats) return;
                                    try {
                                        const html = `
                                            <div class="section-header">RINGKASAN STOK SPAREPART</div>
                                            <div class="row-item">
                                                <span>Total Produk</span>
                                                <span class="font-bold">${stockStats.total_products || 0} Item</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Total Stok (Unit)</span>
                                                <span class="font-bold">${stockStats.total_items || 0} Unit</span>
                                            </div>
                                            <div class="row-item row-total">
                                                <span>Total Nilai Aset</span>
                                                <span class="font-bold text-success">${formatCurrency(stockStats.total_value || 0)}</span>
                                            </div>

                                            <div class="section-header" style="margin-top:30px;">DAFTAR INVENTARIS</div>
                                            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                                                <thead>
                                                    <tr style="text-align: left; font-size: 10px; color: #64748b; border-bottom: 2px solid #e2e8f0;">
                                                        <th style="padding: 8px;">Product / Kode</th>
                                                        <th style="padding: 8px; text-align: center;">Stok</th>
                                                        <th style="padding: 8px; text-align: right;">Total Nilai</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${parts.map(part => `
                                                        <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                                                            <td style="padding: 8px;">
                                                                <b>${part.nama}</b><br/>
                                                                <span style="font-size: 8px; color: #94a3b8;">${part.kode}</span>
                                                            </td>
                                                            <td style="padding: 8px; text-align: center;">
                                                                <span style="font-weight: bold; color: ${part.stok === 999 ? '#10b981' : (part.stok <= (part.stok_minimum || 0) ? '#ef4444' : '#1e293b')};">
                                                                    ${part.stok === 999 ? 'Ready' : part.stok}
                                                                </span>
                                                                <span style="font-size: 8px; color: #94a3b8;">${part.satuan || 'Unit'}</span>
                                                            </td>
                                                            <td style="padding: 8px; text-align: right; font-weight: bold;">
                                                                ${part.stok === 999 ? formatCurrency(0) : formatCurrency(part.stok * part.harga_beli)}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Stok Sparepart',
                                            dateRange: getFormattedDate()
                                        });
                                    } catch (e) {
                                        Alert.alert('Error', 'Gagal mencetak laporan');
                                    }
                                }}
                                className="flex-1 bg-blue-50 p-6 rounded-[32px] border border-blue-100 items-center"
                            >
                                <View className="w-14 h-14 bg-blue-500 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-blue-200">
                                    <Eye size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-blue-900">Tampilkan</Typography>
                                <Typography variant="caption" className="text-blue-600/70 text-center mt-1">Lihat dokumen PDF</Typography>
                            </Pressable>

                            <Pressable
                                onPress={async () => {
                                    setShowExportMenu(false);
                                    if (!stockStats) return;
                                    try {
                                        const html = `
                                            <div class="section-header">RINGKASAN STOK SPAREPART</div>
                                            <div class="row-item">
                                                <span>Total Produk</span>
                                                <span class="font-bold">${stockStats.total_products || 0} Item</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Total Stok (Unit)</span>
                                                <span class="font-bold">${stockStats.total_items || 0} Unit</span>
                                            </div>
                                            <div class="row-item row-total">
                                                <span>Total Nilai Aset</span>
                                                <span class="font-bold text-success">${formatCurrency(stockStats.total_value || 0)}</span>
                                            </div>

                                            <div class="section-header" style="margin-top:30px;">DAFTAR INVENTARIS</div>
                                            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                                                <thead>
                                                    <tr style="text-align: left; font-size: 10px; color: #64748b; border-bottom: 2px solid #e2e8f0;">
                                                        <th style="padding: 8px;">Product / Kode</th>
                                                        <th style="padding: 8px; text-align: center;">Stok</th>
                                                        <th style="padding: 8px; text-align: right;">Total Nilai</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${parts.map(part => `
                                                        <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                                                            <td style="padding: 8px;">
                                                                <b>${part.nama}</b><br/>
                                                                <span style="font-size: 8px; color: #94a3b8;">${part.kode}</span>
                                                            </td>
                                                            <td style="padding: 8px; text-align: center;">
                                                                <span style="font-weight: bold; color: ${part.stok === 999 ? '#10b981' : (part.stok <= (part.stok_minimum || 0) ? '#ef4444' : '#1e293b')};">
                                                                    ${part.stok === 999 ? 'Ready' : part.stok}
                                                                </span>
                                                                <span style="font-size: 8px; color: #94a3b8;">${part.satuan || 'Unit'}</span>
                                                            </td>
                                                            <td style="padding: 8px; text-align: right; font-weight: bold;">
                                                                ${part.stok === 999 ? formatCurrency(0) : formatCurrency(part.stok * part.harga_beli)}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Stok Sparepart',
                                            dateRange: getFormattedDate()
                                        });
                                    } catch (e) {
                                        Alert.alert('Error', 'Gagal membuat PDF');
                                    }
                                }}
                                className="flex-1 bg-primary/5 p-6 rounded-[32px] border border-primary/10 items-center"
                            >
                                <View className="w-14 h-14 bg-primary rounded-2xl items-center justify-center mb-4 shadow-lg shadow-green-200">
                                    <Share2 size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-primary-dark">Download</Typography>
                                <Typography variant="caption" className="text-primary/70 text-center mt-1">Unduh & Bagikan</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
