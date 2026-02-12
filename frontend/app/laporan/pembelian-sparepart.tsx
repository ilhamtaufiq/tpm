import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    ShoppingCart,
    Wallet,
    Clock,
    Search,
    Filter,
    X,
    Package,
    FileText
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency } from '../../utils/format';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function PembelianSparepartReportScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [summary, setSummary] = useState<any>(null);
    const [purchases, setPurchases] = useState<any[]>([]);

    // Detail Modal State
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let dari, sampai;
            if (filterType === 'daily') {
                dari = format(date, 'yyyy-MM-dd');
                sampai = dari;
            } else if (filterType === 'monthly') {
                dari = format(startOfMonth(date), 'yyyy-MM-dd');
                sampai = format(endOfMonth(date), 'yyyy-MM-dd');
            } else {
                dari = format(startOfYear(date), 'yyyy-MM-dd');
                sampai = format(endOfYear(date), 'yyyy-MM-dd');
            }

            const [summaryData, listData] = await Promise.all([
                bengkelService.getPembelianSummary({
                    tanggal_dari: dari,
                    tanggal_sampai: sampai
                }),
                bengkelService.getPembelianParts({
                    search,
                    tanggal_dari: dari,
                    tanggal_sampai: sampai,
                    limit: 100
                })
            ]);

            setSummary(summaryData);
            setPurchases(Array.isArray(listData) ? listData : listData?.data || []);
        } catch (error) {
            console.error('Error fetching purchase report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [search, date, filterType]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

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

    const getFormattedDate = () => {
        if (filterType === 'daily') return format(date, 'dd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const handlePressTransaction = async (item: any) => {
        setSelectedTransaction(item);
        bottomSheetModalRef.current?.present();
        setDetailLoading(true);
        try {
            const detail = await bengkelService.getDetailPembelianPart(item.id);
            setSelectedTransaction(detail);
        } catch (error) {
            console.error('Failed to fetch transaction detail:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCloseModal = () => {
        bottomSheetModalRef.current?.dismiss();
    };

    const STATS = [
        {
            label: "Total Pembelian",
            value: formatCurrency(summary?.total_nilai || 0),
            icon: ShoppingCart,
            color: "#10B981", // Emerald
            isCurrency: true
        },
        {
            label: "Belum Lunas",
            value: formatCurrency(summary?.belum_lunas_nilai || 0),
            icon: Clock,
            color: "#EF4444", // Red
            isCurrency: true
        },
        {
            label: "Transaksi",
            value: summary?.total_transaksi || 0,
            icon: Wallet,
            color: "#3B82F6", // Blue
            unit: "Nota"
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
                    <Typography variant="h2" weight="bold">Laporan Pembelian</Typography>
                </View>
                <Badge variant="success" label="Sparepart" className="px-3 py-1" />
            </View>

            {/* Date Filter Section */}
            <View className="px-6 py-4 bg-white border-b border-gray-100">
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => {
                                setFilterType(type);
                                setDate(new Date());
                            }}
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
                        placeholder="Cari supplier atau nota"
                        className="flex-1 ml-2 text-text font-outfit"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {/* Purchase List */}
                <View className="flex-row justify-between items-center mb-4">
                    <Typography variant="h3" weight="bold">Riwayat Pembelian</Typography>
                    <Typography variant="caption" className="text-gray-500">{purchases.length} Transaksi</Typography>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#3B82F6" className="mt-10" />
                ) : (
                    <View className="space-y-4">
                        {purchases.length === 0 ? (
                            <View className="items-center justify-center p-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                <ShoppingCart size={48} color="#D1D5DB" />
                                <Typography className="text-gray-400 mt-4">Tidak ada data pembelian</Typography>
                            </View>
                        ) : (
                            purchases.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => handlePressTransaction(item)}
                                    activeOpacity={0.7}
                                >
                                    <Card className="p-4 border-gray-100">
                                        <View className="flex-row justify-between mb-2">
                                            <View className="flex-1">
                                                <Typography variant="body2" weight="bold">{item.supplier_nama || 'Supplier Umum'}</Typography>
                                                <Typography variant="caption" className="text-gray-400">{item.nomor_transaksi}</Typography>
                                            </View>
                                            <Badge
                                                variant={item.status_bayar === 'Lunas' ? 'success' : 'error'}
                                                label={item.status_bayar}
                                            />
                                        </View>

                                        <View className="flex-row justify-between items-end mt-2 pt-2 border-t border-gray-50">
                                            <View>
                                                <Typography variant="caption" className="text-gray-500">
                                                    {format(new Date(item.tanggal), 'dd MMM yyyy', { locale: localeID })}
                                                </Typography>
                                            </View>
                                            <Typography variant="body2" weight="bold" className="text-primary">
                                                {formatCurrency(item.total_biaya || item.grand_total || 0)}
                                            </Typography>
                                        </View>
                                    </Card>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                <View className="h-20" />
            </ScrollView>

            {/* Detail Modal */}
            <BottomSheetModal
                ref={bottomSheetModalRef}
                index={1}
                snapPoints={snapPoints}
                enablePanDownToClose={true}
                backdropComponent={({ style }) => (
                    <View style={[style, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                )}
                backgroundStyle={{ borderRadius: 32 }}
            >
                <BottomSheetView className="flex-1 px-6 pb-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Typography variant="h2" weight="bold">Detail Pembelian</Typography>
                            <Typography className="text-gray-400 text-xs mt-1">Informasi lengkap transaksi</Typography>
                        </View>
                        <TouchableOpacity onPress={handleCloseModal} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                            <X size={16} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    {detailLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="mt-4 text-gray-400">Memuat detail</Typography>
                        </View>
                    ) : selectedTransaction ? (
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            {/* Summary Card */}
                            <View className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Supplier</Typography>
                                        <Typography weight="bold" className="text-lg">{selectedTransaction.supplier?.nama || selectedTransaction.supplier_nama || 'Supplier Umum'}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Tanggal</Typography>
                                        <Typography weight="bold">{format(new Date(selectedTransaction.tanggal), 'dd MMM yyyy', { locale: localeID })}</Typography>
                                    </View>
                                </View>

                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Nomor Transaksi</Typography>
                                        <View className="flex-row items-center">
                                            <FileText size={14} color="#6B7280" className="mr-2" />
                                            <Typography weight="medium" className="text-gray-700">{selectedTransaction.nomor_transaksi}</Typography>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Status</Typography>
                                        <Badge
                                            variant={selectedTransaction.status_bayar === 'Lunas' ? 'success' : 'error'}
                                            label={selectedTransaction.status_bayar}
                                        />
                                    </View>
                                </View>

                                {selectedTransaction.catatan && (
                                    <View className="pt-3 border-t border-gray-200/50 mt-1">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Catatan</Typography>
                                        <Typography className="text-gray-600 italic text-sm">"{selectedTransaction.catatan}"</Typography>
                                    </View>
                                )}
                            </View>

                            {/* Items List */}
                            <Typography variant="h3" weight="bold" className="mb-4">Daftar Barang</Typography>
                            {selectedTransaction.detail && selectedTransaction.detail.length > 0 ? (
                                selectedTransaction.detail.map((item: any, index: number) => (
                                    <View key={index} className="flex-row justify-between items-center py-3 border-b border-gray-100">
                                        <View className="flex-1 pr-4">
                                            <View className="flex-row items-center mb-1">
                                                <View className="w-8 h-8 bg-blue-50 rounded-lg items-center justify-center mr-3">
                                                    <Package size={16} color="#3B82F6" />
                                                </View>
                                                <View className="flex-1">
                                                    <Typography weight="bold" className="text-gray-800">{item.spare_part?.nama || item.spare_part_nama || 'Barang #' + (index + 1)}</Typography>
                                                    <Typography variant="caption" className="text-gray-500">
                                                        {`${item.qty} ${item.spare_part?.satuan || 'pcs'} x ${formatCurrency(item.harga_satuan)}`}
                                                    </Typography>
                                                </View>
                                            </View>
                                        </View>
                                        <Typography weight="bold" className="text-primary">
                                            {formatCurrency(item.subtotal || (item.qty * item.harga_satuan))}
                                        </Typography>
                                    </View>
                                ))
                            ) : (
                                <View className="p-8 items-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <Typography className="text-gray-400">Detail barang tidak tersedia</Typography>
                                </View>
                            )}

                            {/* Total Section */}
                            <View className="mt-8 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                <View className="flex-row justify-between items-center">
                                    <Typography weight="bold" className="text-lg text-primary">Total Pembelian</Typography>
                                    <Typography variant="h2" weight="bold" className="text-primary text-2xl">
                                        {formatCurrency(selectedTransaction.total_biaya || selectedTransaction.grand_total || 0)}
                                    </Typography>
                                </View>
                            </View>
                            <View className="h-10" />
                        </BottomSheetScrollView>
                    ) : null}
                </BottomSheetView>
            </BottomSheetModal>
        </SafeAreaView>
    );
}
