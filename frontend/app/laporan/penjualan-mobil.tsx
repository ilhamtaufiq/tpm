import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, ScrollView, Pressable, StatusBar,
    RefreshControl as RNRefreshControl, ActivityIndicator,
    TextInput, Alert, Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft, ChevronRight, Calendar, TrendingUp,
    Wallet, Search, User, ArrowUpRight, BarChart3,
    ArrowDownRight, PieChart, X, Car, CreditCard,
    Percent, Printer, Download, Eye, Share2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { mobilService } from '../../services/mobil';
import { formatCurrency } from '../../utils/format';
import { printReportHTML } from '../../utils/printReport';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function PenjualanMobilReportScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [summary, setSummary] = useState<any>(null);
    const [transaksis, setTransaksis] = useState<any[]>([]);

    // Detail Modal State
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%', '92%'], []);
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
                mobilService.getPenjualanSummary({
                    tanggal_dari: dari,
                    tanggal_sampai: sampai
                }),
                mobilService.getPenjualanMobils({
                    search,
                    tanggal_dari: dari,
                    tanggal_sampai: sampai,
                    limit: 100,
                    sort_by: "tanggal",
                    sort_order: "desc"
                })
            ]);

            setSummary(summaryData);
            setTransaksis(listData?.data || []);
        } catch (error) {
            console.error('Error fetching car sales report:', error);
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
            // Fetch mobil detail for complete data
            if (item.mobil_id) {
                const mobilDetail = await mobilService.getMobil(item.mobil_id);
                setSelectedTransaction({ ...item, mobilDetail });
            }
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
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <View className="flex-row items-center mb-0.5">
                                <View className="w-1.5 h-1.5 rounded-full bg-secondary mr-2" />
                                <Typography className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Laporan Unit</Typography>
                            </View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Penjualan Mobil</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10 mr-2">
                            <Typography className="text-white uppercase text-[8px] font-bold tracking-widest">REAL-TIME</Typography>
                        </View>
                        <Pressable
                            onPress={() => setShowExportMenu(true)}
                            disabled={isExporting}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <Download size={22} color="white" />
                        </Pressable>
                    </View>
                </View>

                {/* Main Bento Stats Row */}
                <View className="flex-row justify-between mb-4">
                    <View className="flex-[1.5] bg-white/10 p-5 rounded-[28px] border border-white/5 mr-3">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Total Omset</Typography>
                        <View className="flex-row items-end">
                            <Typography className="text-white/60 text-xs font-bold mb-1 mr-1">Rp</Typography>
                            <Typography weight="bold" className="text-white text-2xl tracking-tighter">
                                {formatCurrency(summary?.total_penjualan || 0).replace('Rp', '').trim()}
                            </Typography>
                        </View>
                        <View className="flex-row items-center mt-2">
                            <View className="bg-emerald-500/20 flex-row items-center px-2 py-0.5 rounded-lg mr-2">
                                <ArrowUpRight size={12} color="#10B981" />
                                <Typography className="text-emerald-400 text-[10px] font-bold ml-1">Positive</Typography>
                            </View>
                        </View>
                    </View>
                    <View className="flex-1 bg-white/10 p-5 rounded-[28px] border border-white/5">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Unit Terjual</Typography>
                        <Typography weight="bold" className="text-white text-3xl tracking-tighter">{summary?.total_transaksi || 0}</Typography>
                        <Typography className="text-white/30 text-[10px] mt-1">Kendaraan</Typography>
                    </View>
                </View>

                {/* Profit Split Bento Cards */}
                <View className="flex-row justify-between">
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5 mr-3">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-primary/20 rounded-md items-center justify-center mr-2">
                                <TrendingUp size={12} color="#023C69" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Laba TPM</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-base">
                            {formatCurrency(summary?.laba_tpm || 0)}
                        </Typography>
                    </View>
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-amber-500/20 rounded-md items-center justify-center mr-2">
                                <User size={12} color="#F59E0B" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Investor</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-base">
                            {formatCurrency(summary?.laba_investor || 0)}
                        </Typography>
                    </View>
                </View>
            </View>

            {/* Date Filter & Search Section (Floating Pattern) */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-4 rounded-[32px] shadow-xl border border-gray-50">
                    <View className="flex-row bg-gray-50 p-1 rounded-2xl mb-4">
                        {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                            <Pressable
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
                            </Pressable>
                        ))}
                    </View>

                    <View className="flex-row justify-between items-center px-2">
                        <Pressable
                            onPress={handlePrev}
                            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                        >
                            <ChevronLeft size={20} color="#1C1C1C" />
                        </Pressable>

                        <View className="flex-row items-center">
                            <Calendar size={18} color="#023C69" className="mr-2" />
                            <Typography variant="body1" weight="bold" className="text-textMain">
                                {getFormattedDate()}
                            </Typography>
                        </View>

                        <Pressable
                            onPress={handleNext}
                            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                        >
                            <ChevronRight size={20} color="#1C1C1C" />
                        </Pressable>
                    </View>

                    {/* Search Field */}
                    <View className="mt-4 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            placeholder="Cari nopol, merek, atau pembeli..."
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
                {/* Secondary Info Stats */}
                <View className="flex-row flex-wrap justify-between mb-8">
                    <View className="w-[48%] bg-white p-5 rounded-[28px] border border-gray-50 shadow-sm mb-4">
                        <View className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center mb-3">
                            <ArrowDownRight size={20} color="#EF4444" />
                        </View>
                        <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest mb-1">Sisa Piutang</Typography>
                        <Typography variant="body1" weight="bold" className="text-red-500">
                            {formatCurrency(summary?.piutang_nilai || 0)}
                        </Typography>
                        <Typography variant="caption" className="text-textGray/40 mt-1">{summary?.piutang_count || 0} Transaksi Pending</Typography>
                    </View>
                    <View className="w-[48%] bg-white p-5 rounded-[28px] border border-gray-50 shadow-sm mb-4">
                        <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mb-3">
                            <PieChart size={20} color="#3B82F6" />
                        </View>
                        <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest mb-1">Laba Kotor</Typography>
                        <Typography variant="body1" weight="bold" className="text-blue-500">
                            {formatCurrency(summary?.total_laba_kotor || 0)}
                        </Typography>
                        <Typography variant="caption" className="text-textGray/40 mt-1">Total Margin</Typography>
                    </View>
                </View>

                {/* Transaction List */}
                <View className="flex-row items-center justify-between mb-6 px-1">
                    <View className="flex-row items-center">
                        <View className="w-1.5 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Riwayat Penjualan</Typography>
                    </View>
                    <Typography variant="caption" className="text-textGray">{transaksis.length} Data</Typography>
                </View>

                {isLoading ? (
                    <View className="py-10">
                        <ActivityIndicator size="large" color="#023C69" />
                    </View>
                ) : transaksis.length === 0 ? (
                    <View className="items-center justify-center py-16 bg-white rounded-[40px] border border-dashed border-gray-200">
                        <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-4 opacity-50">
                            <BarChart3 size={32} color="#9CA3AF" />
                        </View>
                        <Typography className="text-textGray font-bold uppercase tracking-[4px]">Data Kosong</Typography>
                        <Typography variant="caption" className="text-textGray/40 mt-2">Tidak ada transaksi penjualan ditemukan</Typography>
                    </View>
                ) : (
                    transaksis.map((item, index) => (
                        <Pressable
                            key={item.id}
                            onPress={() => handlePressTransaction(item)}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm"
                        >
                            <View className="flex-row items-center mb-4">
                                <View className="w-14 h-14 bg-emerald-50 rounded-2xl items-center justify-center mr-4">
                                    <TrendingUp size={24} color="#10B981" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center justify-between">
                                        <Typography variant="body1" weight="bold" className="text-textMain">
                                            {item.mobil?.merek} {item.mobil?.model}
                                        </Typography>
                                        <View className={`px-3 py-1 rounded-full ${item.status_bayar === 'LUNAS' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                            <Typography className={`text-[8px] font-bold uppercase ${item.status_bayar === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {item.status_bayar}
                                            </Typography>
                                        </View>
                                    </View>
                                    <Typography variant="caption" className="text-textGray/60 mt-0.5">
                                        {format(new Date(item.tanggal), 'dd MMMM yyyy', { locale: localeID })} • {item.nomor_transaksi}
                                    </Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between items-end pt-4 border-t border-gray-50/50">
                                <View>
                                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold mb-0.5">Pembeli</Typography>
                                    <Typography variant="body2" weight="bold" className="text-textMain">{item.nama_pembeli}</Typography>
                                </View>
                                <View className="items-end">
                                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold mb-0.5">Nilai Jual</Typography>
                                    <Typography variant="h3" weight="bold" className="text-primary">
                                        {formatCurrency(item.harga_jual || 0)}
                                    </Typography>
                                </View>
                            </View>

                            {item.sisa_bayar > 0 && (
                                <View className="mt-4 bg-red-50/50 p-3 rounded-2xl flex-row items-center justify-between">
                                    <Typography className="text-red-500 text-[10px] font-bold">Piutang Tersisa</Typography>
                                    <Typography className="text-red-600 text-[11px] font-bold">{formatCurrency(item.sisa_bayar)}</Typography>
                                </View>
                            )}
                        </Pressable>
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
    topInset={insets.top}
    backdropComponent={({ style }) => (
        <View style={[style, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
    )}
    backgroundStyle={{ borderRadius: 32 }}
>
                <BottomSheetView className="flex-1 px-6 pb-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Typography variant="h2" weight="bold">Detail Penjualan</Typography>
                            <Typography className="text-gray-400 text-xs mt-1">Informasi lengkap transaksi</Typography>
                        </View>
                        <Pressable onPress={handleCloseModal} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                            <X size={16} color="#4B5563" />
                        </Pressable>
                    </View>

                    {detailLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="mt-4 text-gray-400">Memuat detail...</Typography>
                        </View>
                    ) : selectedTransaction ? (
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            {/* Vehicle Info Card */}
                            <View className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Kendaraan</Typography>
                                        <Typography weight="bold" className="text-lg">{selectedTransaction.mobil?.merek} {selectedTransaction.mobil?.model}</Typography>
                                        <Typography className="text-gray-500 text-xs font-semibold">{selectedTransaction.mobil?.nomor_plat} • Tahun {selectedTransaction.mobil?.tahun}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Status</Typography>
                                        <Badge
                                            variant={selectedTransaction.status_bayar === 'LUNAS' ? 'success' : 'error'}
                                            label={selectedTransaction.status_bayar}
                                        />
                                    </View>
                                </View>

                                <View className="flex-row justify-between">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Tanggal Jual</Typography>
                                        <Typography weight="bold">{format(new Date(selectedTransaction.tanggal), 'dd MMM yyyy', { locale: localeID })}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">No. Transaksi</Typography>
                                        <Typography weight="medium" className="text-gray-700">{selectedTransaction.nomor_transaksi}</Typography>
                                    </View>
                                </View>
                            </View>

                            {/* Buyer Info */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-blue-100 rounded-md items-center justify-center mr-2">
                                        <User size={14} color="#3B82F6" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Informasi Pembeli</Typography>
                                </View>
                                <View className="bg-white p-4 rounded-2xl border border-gray-100">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-500 text-xs">Nama Pembeli</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{selectedTransaction.nama_pembeli}</Typography>
                                    </View>
                                    {selectedTransaction.telepon_pembeli && (
                                        <View className="flex-row justify-between mb-2">
                                            <Typography className="text-gray-500 text-xs">Telepon</Typography>
                                            <Typography weight="medium" className="text-gray-700 text-sm">{selectedTransaction.telepon_pembeli}</Typography>
                                        </View>
                                    )}
                                    {selectedTransaction.alamat_pembeli && (
                                        <View className="flex-row justify-between">
                                            <Typography className="text-gray-500 text-xs">Alamat</Typography>
                                            <Typography weight="medium" className="text-gray-700 text-sm flex-1 text-right ml-4">{selectedTransaction.alamat_pembeli}</Typography>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Payment Details */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-amber-100 rounded-md items-center justify-center mr-2">
                                        <CreditCard size={14} color="#F59E0B" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Rincian Pembayaran</Typography>
                                </View>
                                <View className="bg-white p-4 rounded-2xl border border-gray-100">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-500 text-xs">Harga Jual</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTransaction.harga_jual || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-500 text-xs">Total Dibayar</Typography>
                                        <Typography weight="bold" className="text-emerald-600 text-sm">{formatCurrency(selectedTransaction.total_dibayar || 0)}</Typography>
                                    </View>
                                    {selectedTransaction.sisa_bayar > 0 && (
                                        <View className="flex-row justify-between">
                                            <Typography className="text-red-500 text-xs">Sisa Piutang</Typography>
                                            <Typography weight="bold" className="text-red-500 text-sm">{formatCurrency(selectedTransaction.sisa_bayar)}</Typography>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Profit Split */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-purple-100 rounded-md items-center justify-center mr-2">
                                        <Percent size={14} color="#A855F7" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Pembagian Laba</Typography>
                                </View>
                                <View className="bg-white p-4 rounded-2xl border border-gray-100">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-500 text-xs">Laba Kotor</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTransaction.laba_kotor || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-primary text-xs">Laba TPM</Typography>
                                        <Typography weight="bold" className="text-primary text-sm">{formatCurrency(selectedTransaction.laba_tpm || 0)}</Typography>
                                    </View>
                                    {selectedTransaction.laba_investor > 0 && (
                                        <View className="flex-row justify-between">
                                            <Typography className="text-amber-500 text-xs">Laba Investor</Typography>
                                            <Typography weight="bold" className="text-amber-600 text-sm">{formatCurrency(selectedTransaction.laba_investor)}</Typography>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Financial Summary */}
                            <View className="bg-primary/5 p-5 rounded-2xl border border-primary/10 mb-8">
                                <View className="space-y-2 mb-4">
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Modal Total</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTransaction.mobilDetail?.total_modal || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Harga Jual</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTransaction.harga_jual || 0)}</Typography>
                                    </View>
                                </View>
                                <View className="flex-row justify-between items-center pt-3 border-t border-primary/10">
                                    <Typography weight="bold" className="text-lg text-primary">Laba Kotor</Typography>
                                    <Typography variant="h2" weight="bold" className="text-primary text-2xl">
                                        {formatCurrency(selectedTransaction.laba_kotor || 0)}
                                    </Typography>
                                </View>
                            </View>
                            <View className="h-10" />
                        </BottomSheetScrollView>
                    ) : null}
                </BottomSheetView>
            </BottomSheetModal>

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
                                <Typography variant="h3" weight="bold">Ekspor Laporan</Typography>
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
                                    if (!summary) return;
                                    try {
                                        const html = `
                                            <div class="section-header">RINGKASAN PENJUALAN</div>
                                            <div class="row-item">
                                                <span>Total Omset</span>
                                                <span>${formatCurrency(summary.total_penjualan || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Unit Terjual</span>
                                                <span>${summary.total_transaksi || 0} Kendaraan</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Laba Kotor Total</span>
                                                <span>${formatCurrency(summary.total_laba_kotor || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Laba TPM</span>
                                                <span class="font-bold">${formatCurrency(summary.laba_tpm || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Laba Investor</span>
                                                <span>${formatCurrency(summary.laba_investor || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Sisa Piutang</span>
                                                <span class="text-error">${formatCurrency(summary.piutang_nilai || 0)}</span>
                                            </div>

                                            <div class="section-header" style="margin-top:30px;">DAFTAR TRANSAKSI</div>
                                            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                                                <thead>
                                                    <tr style="background-color: #f8fafc; text-align: left; font-size: 10px;">
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Tanggal/No</th>
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Unit / Pembeli</th>
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Harga Jual</th>
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${transaksis.map(item => `
                                                        <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                                                            <td style="padding: 8px;">
                                                                ${format(new Date(item.tanggal), 'dd/MM/yy', { locale: localeID })}<br/>
                                                                <span style="color: #64748b; font-size: 8px;">${item.nomor_transaksi}</span>
                                                            </td>
                                                            <td style="padding: 8px;">
                                                                <span style="font-weight: bold;">${item.mobil?.merek} ${item.mobil?.model}</span><br/>
                                                                <span style="color: #64748b; font-size: 9px;">${item.nama_pembeli}</span>
                                                            </td>
                                                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.harga_jual || 0)}</td>
                                                            <td style="padding: 8px;">
                                                                <span style="color: ${item.status_bayar === 'LUNAS' ? '#10b981' : '#ef4444'}; font-weight: bold; font-size: 8px;">
                                                                    ${item.status_bayar}
                                                                </span>
                                                                ${item.sisa_bayar > 0 ? `<br/><span style="color: #ef4444; font-size: 8px;">Sisa: ${formatCurrency(item.sisa_bayar)}</span>` : ''}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Penjualan Mobil',
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
                                    if (!summary) return;
                                    try {
                                        // Use same HTML as above
                                        const html = `
                                            <div class="section-header">RINGKASAN PENJUALAN</div>
                                            <div class="row-item">
                                                <span>Total Omset</span>
                                                <span>${formatCurrency(summary.total_penjualan || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Unit Terjual</span>
                                                <span>${summary.total_transaksi || 0} Kendaraan</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Laba Kotor Total</span>
                                                <span>${formatCurrency(summary.total_laba_kotor || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Laba TPM</span>
                                                <span class="font-bold">${formatCurrency(summary.laba_tpm || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Laba Investor</span>
                                                <span>${formatCurrency(summary.laba_investor || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Sisa Piutang</span>
                                                <span class="text-error">${formatCurrency(summary.piutang_nilai || 0)}</span>
                                            </div>

                                            <div class="section-header" style="margin-top:30px;">DAFTAR TRANSAKSI</div>
                                            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                                                <thead>
                                                    <tr style="background-color: #f8fafc; text-align: left; font-size: 10px;">
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Tanggal/No</th>
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Unit / Pembeli</th>
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Harga Jual</th>
                                                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${transaksis.map(item => `
                                                        <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                                                            <td style="padding: 8px;">
                                                                ${format(new Date(item.tanggal), 'dd/MM/yy', { locale: localeID })}<br/>
                                                                <span style="color: #64748b; font-size: 8px;">${item.nomor_transaksi}</span>
                                                            </td>
                                                            <td style="padding: 8px;">
                                                                <span style="font-weight: bold;">${item.mobil?.merek} ${item.mobil?.model}</span><br/>
                                                                <span style="color: #64748b; font-size: 9px;">${item.nama_pembeli}</span>
                                                            </td>
                                                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.harga_jual || 0)}</td>
                                                            <td style="padding: 8px;">
                                                                <span style="color: ${item.status_bayar === 'LUNAS' ? '#10b981' : '#ef4444'}; font-weight: bold; font-size: 8px;">
                                                                    ${item.status_bayar}
                                                                </span>
                                                                ${item.sisa_bayar > 0 ? `<br/><span style="color: #ef4444; font-size: 8px;">Sisa: ${formatCurrency(item.sisa_bayar)}</span>` : ''}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Penjualan Mobil',
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
        </View>
    );
}
