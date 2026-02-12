import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Wrench,
    TrendingUp,
    Search,
    User,
    ClipboardList,
    ArrowUpRight,
    BarChart3,
    ArrowDownRight,
    Package,
    HandHelping,
    MoreHorizontal,
    X
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency } from '../../utils/format';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function PenjualanBengkelReportScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [summary, setSummary] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);

    // Detail Modal State
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['85%', '92%'], []);
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
                bengkelService.getTransaksiSummary({
                    tanggal_dari: dari,
                    tanggal_sampai: sampai
                }),
                bengkelService.getTransaksi({
                    search,
                    tanggal_dari: dari,
                    tanggal_sampai: sampai,
                    limit: 100,
                    sort_by: "tanggal",
                    sort_order: "desc"
                })
            ]);

            setSummary(summaryData);
            setTransactions(listData?.data || []);
        } catch (error) {
            console.error('Error fetching workshop sales report:', error);
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

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/laporan');
        }
    };

    const handlePressTransaction = async (item: any) => {
        setSelectedTransaction(item);
        bottomSheetModalRef.current?.present();
        setDetailLoading(true);
        try {
            const detail = await bengkelService.getDetailTransaksi(item.id);
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

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Adaptive Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <View className="flex-row items-center mb-0.5">
                                <View className="w-1.5 h-1.5 rounded-full bg-secondary mr-2" />
                                <Typography className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Laporan Jasa</Typography>
                            </View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Penjualan Bengkel</Typography>
                        </View>
                    </View>
                    <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                        <Typography className="text-white uppercase text-[8px] font-bold tracking-widest">LIVE DATA</Typography>
                    </View>
                </View>

                {/* Main Bento Stats Row */}
                <View className="flex-row justify-between mb-4">
                    <View className="flex-[1.5] bg-white/10 p-5 rounded-[28px] border border-white/5 mr-3">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Total Pendapatan</Typography>
                        <View className="flex-row items-end">
                            <Typography className="text-white/60 text-xs font-bold mb-1 mr-1">Rp</Typography>
                            <Typography weight="bold" className="text-white text-2xl tracking-tighter">
                                {formatCurrency(summary?.total_penjualan || 0).replace('Rp', '').trim()}
                            </Typography>
                        </View>
                        <View className="flex-row items-center mt-2">
                            <View className="bg-emerald-500/20 flex-row items-center px-2 py-0.5 rounded-lg mr-2">
                                <ArrowUpRight size={10} color="#10B981" />
                                <Typography className="text-emerald-400 text-[10px] font-bold ml-1">Optimized</Typography>
                            </View>
                        </View>
                    </View>
                    <View className="flex-1 bg-white/10 p-5 rounded-[28px] border border-white/5">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Total Nota</Typography>
                        <Typography weight="bold" className="text-white text-3xl tracking-tighter">{summary?.total_transaksi || 0}</Typography>
                        <Typography className="text-white/30 text-[10px] mt-1">Transaksi</Typography>
                    </View>
                </View>

                {/* Detail Stats Bento Cards */}
                <View className="flex-row justify-between">
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5 mr-2">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-blue-500/20 rounded-md items-center justify-center mr-2">
                                <TrendingUp size={12} color="#3B82F6" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Laba Kotor</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-sm">
                            {formatCurrency(summary?.total_laba_kotor || 0)}
                        </Typography>
                    </View>
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5 mr-2">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-amber-500/20 rounded-md items-center justify-center mr-2">
                                <Package size={12} color="#F59E0B" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Spare Part</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-sm">
                            {formatCurrency(summary?.total_parts || 0)}
                        </Typography>
                    </View>
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-purple-500/20 rounded-md items-center justify-center mr-2">
                                <HandHelping size={12} color="#A855F7" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Jasa</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-sm">
                            {formatCurrency(summary?.total_jasa || 0)}
                        </Typography>
                    </View>
                </View>
            </View>

            {/* Date Filter & Search Section (Floating Pattern) */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-4 rounded-[32px] shadow-xl border border-gray-50">
                    <View className="flex-row bg-gray-50 p-1 rounded-2xl mb-4">
                        {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => {
                                    setFilterType(type);
                                    setDate(new Date());
                                }}
                                className={`flex-1 py-2.5 items-center rounded-xl ${filterType === type ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={filterType === type ? 'text-primary' : 'text-gray-400'}
                                >
                                    {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View className="flex-row justify-between items-center px-2">
                        <TouchableOpacity
                            onPress={handlePrev}
                            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                        >
                            <ChevronLeft size={20} color="#1C1C1C" />
                        </TouchableOpacity>

                        <View className="flex-row items-center">
                            <Calendar size={18} color="#023C69" className="mr-2" />
                            <Typography variant="body1" weight="bold" className="text-textMain">
                                {getFormattedDate()}
                            </Typography>
                        </View>

                        <TouchableOpacity
                            onPress={handleNext}
                            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                        >
                            <ChevronRight size={20} color="#1C1C1C" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Field */}
                    <View className="mt-4 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            placeholder="Cari nopol, item, atau customer..."
                            className="flex-1 ml-3 text-sm font-medium"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {/* Section Header */}
                <View className="flex-row items-center justify-between mb-6 px-1">
                    <View className="flex-row items-center">
                        <View className="w-1.5 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Daftar Transaksi</Typography>
                    </View>
                    <View className="bg-gray-100 px-3 py-1 rounded-full">
                        <Typography variant="caption" className="text-textGray font-bold">{transactions.length} Nota</Typography>
                    </View>
                </View>

                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color="#023C69" />
                        <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MEMUAT DATA...</Typography>
                    </View>
                ) : transactions.length === 0 ? (
                    <View className="items-center justify-center py-20 bg-white rounded-[40px] border border-dashed border-gray-100">
                        <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6 opacity-30">
                            <ClipboardList size={40} color="#9CA3AF" />
                        </View>
                        <Typography className="text-textGray font-bold uppercase tracking-[6px]">Belum Ada Data</Typography>
                        <Typography variant="caption" className="text-textGray/40 mt-2">Tidak ditemukan transaksi pada periode ini</Typography>
                    </View>
                ) : (
                    transactions.map((item, index) => (
                        <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.7}
                            onPress={() => handlePressTransaction(item)}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm"
                        >
                            <View className="flex-row items-center mb-4">
                                <View className={`w-14 h-14 bg-emerald-50 rounded-2xl items-center justify-center mr-4`}>
                                    <Wrench size={24} color="#10B981" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center justify-between">
                                        <Typography variant="body1" weight="bold" className="text-textMain">
                                            {item.nomor_plat}
                                        </Typography>
                                        <View className={`px-2.5 py-1 rounded-full ${item.status_bayar === 'Lunas' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                            <Typography className={`text-[8px] font-bold uppercase ${item.status_bayar === 'Lunas' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {item.status_bayar}
                                            </Typography>
                                        </View>
                                    </View>
                                    <Typography variant="caption" className="text-textGray/60 mt-0.5" numberOfLines={1}>
                                        {format(new Date(item.tanggal), 'dd MMMM yyyy', { locale: localeID })} • {item.nomor_transaksi}
                                    </Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between items-end pt-4 border-t border-gray-50/50">
                                <View>
                                    <View className="flex-row items-center mb-1">
                                        <User size={12} color="#9CA3AF" className="mr-1.5" />
                                        <Typography variant="caption" className="text-textGray font-medium">Customer: {item.customer_nama || 'Umum'}</Typography>
                                    </View>
                                    <Typography variant="caption" className="text-emerald-600 font-bold">
                                        Margin: {formatCurrency(item.laba_kotor || 0)}
                                    </Typography>
                                </View>
                                <View className="items-end">
                                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold mb-0.5">Grand Total</Typography>
                                    <Typography variant="h3" weight="bold" className="text-primary tracking-tighter">
                                        {formatCurrency(item.grand_total || 0)}
                                    </Typography>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )
                }

                <View className="h-24" />
            </ScrollView>

            {/* Detail Modal */}
            <BottomSheetModal
                ref={bottomSheetModalRef}
                index={0}
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
                            <Typography variant="h2" weight="bold">Detail Transaksi</Typography>
                            <Typography className="text-gray-400 text-xs mt-1">Informasi lengkap penjualan</Typography>
                        </View>
                        <TouchableOpacity onPress={handleCloseModal} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                            <X size={16} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    {detailLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="mt-4 text-gray-400">Memuat detail...</Typography>
                        </View>
                    ) : selectedTransaction ? (
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            {/* Summary Card */}
                            <View className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Customer</Typography>
                                        <Typography weight="bold" className="text-lg">{selectedTransaction.customer_nama || selectedTransaction.nama_customer || 'Umum'}</Typography>
                                        <Typography className="text-gray-500 text-xs font-semibold">{selectedTransaction.nomor_plat || selectedTransaction.plat_nomor}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Tanggal</Typography>
                                        <Typography weight="bold">{format(new Date(selectedTransaction.tanggal), 'dd MMM yyyy', { locale: localeID })}</Typography>
                                    </View>
                                </View>

                                <View className="flex-row justify-between mb-2">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Status</Typography>
                                        <Badge
                                            variant={selectedTransaction.status_bayar === 'Lunas' ? 'success' : 'error'}
                                            label={selectedTransaction.status_bayar}
                                        />
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">No. Nota</Typography>
                                        <Typography weight="medium" className="text-gray-700">{selectedTransaction.nomor_transaksi}</Typography>
                                    </View>
                                </View>
                            </View>

                            {/* Parts Section */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-amber-100 rounded-md items-center justify-center mr-2">
                                        <Package size={14} color="#F59E0B" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Spare Parts</Typography>
                                </View>
                                {selectedTransaction.detail_parts && selectedTransaction.detail_parts.length > 0 ? (
                                    selectedTransaction.detail_parts.map((item: any, index: number) => (
                                        <View key={`part-${index}`} className="flex-row justify-between items-start py-3 border-b border-gray-100 last:border-0">
                                            <View className="flex-1 pr-4">
                                                <Typography weight="bold" className="text-gray-800 text-sm">
                                                    {item.spare_part_nama || item.spare_part?.nama}
                                                </Typography>
                                                <Typography variant="caption" className="text-gray-500">
                                                    {item.qty} x {formatCurrency(item.harga_jual)}
                                                </Typography>
                                            </View>
                                            <Typography weight="bold" className="text-gray-900 text-sm">
                                                {formatCurrency(item.subtotal)}
                                            </Typography>
                                        </View>
                                    ))
                                ) : (
                                    <Typography className="text-gray-400 italic text-sm ml-8">Tidak ada spare part</Typography>
                                )}
                            </View>

                            {/* Services Section */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-purple-100 rounded-md items-center justify-center mr-2">
                                        <HandHelping size={14} color="#A855F7" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Jasa Servis</Typography>
                                </View>
                                {selectedTransaction.detail_services && selectedTransaction.detail_services.length > 0 ? (
                                    selectedTransaction.detail_services.map((item: any, index: number) => (
                                        <View key={`service-${index}`} className="flex-row justify-between items-start py-3 border-b border-gray-100 last:border-0">
                                            <View className="flex-1 pr-4">
                                                <Typography weight="bold" className="text-gray-800 text-sm">
                                                    {item.nama_jasa}
                                                </Typography>
                                                <Typography variant="caption" className="text-gray-500">
                                                    {item.qty || 1} x {formatCurrency(item.harga)}
                                                </Typography>
                                            </View>
                                            <Typography weight="bold" className="text-gray-900 text-sm">
                                                {formatCurrency(item.subtotal)}
                                            </Typography>
                                        </View>
                                    ))
                                ) : (
                                    <Typography className="text-gray-400 italic text-sm ml-8">Tidak ada jasa</Typography>
                                )}
                            </View>

                            {/* Financial Summary */}
                            <View className="bg-primary/5 p-5 rounded-2xl border border-primary/10 mb-8">
                                <View className="space-y-2 mb-4">
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Total Parts</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTransaction.total_parts || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Total Jasa</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTransaction.total_jasa || 0)}</Typography>
                                    </View>
                                    {Number(selectedTransaction.diskon) > 0 && (
                                        <View className="flex-row justify-between">
                                            <Typography className="text-red-500 text-xs">Diskon</Typography>
                                            <Typography weight="bold" className="text-red-500 text-sm">-{formatCurrency(selectedTransaction.diskon)}</Typography>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-row justify-between items-center pt-3 border-t border-primary/10">
                                    <Typography weight="bold" className="text-lg text-primary">Grand Total</Typography>
                                    <View className='flex-col items-end'>
                                        <Typography variant="h2" weight="bold" className="text-primary text-2xl">
                                            {formatCurrency(selectedTransaction.grand_total || selectedTransaction.total_bayar || 0)}
                                        </Typography>

                                        {Number(selectedTransaction.laba_kotor) > 0 && (
                                            <View className="mt-1 bg-white/50 p-1 rounded-lg">
                                                <Typography className="text-emerald-600 text-[9px] font-bold uppercase">
                                                    Margin: {formatCurrency(selectedTransaction.laba_kotor)}
                                                </Typography>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                            <View className="h-10" />
                        </BottomSheetScrollView>
                    ) : null}
                </BottomSheetView>
            </BottomSheetModal>
        </View>
    );
}
