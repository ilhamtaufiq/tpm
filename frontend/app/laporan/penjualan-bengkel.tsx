import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View, ScrollView, Pressable, StatusBar,
    RefreshControl as RNRefreshControl, ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import {
    Wrench, TrendingUp, User, ClipboardList,
    Package, HandHelping, MoreHorizontal, X
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency } from '../../utils/format';
import { printReportHTML } from '../../utils/printReport';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import {
    ReportPageHeader,
    ReportStatsBento,
    ReportDateControls,
    ReportSectionHeader,
    ReportExportSheet,
    ReportFilterType,
} from '../../components/laporan';

const escapeHtml = (str: any) => String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");

export default function PenjualanBengkelReportScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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

    const stats = useMemo(() => [
        { label: 'Pendapatan', value: formatCurrency(summary?.total_penjualan || 0), icon: TrendingUp, color: '#10B981', bg: 'bg-emerald-50' },
        { label: 'Nota', value: String(summary?.total_transaksi || 0), icon: ClipboardList, color: '#3B82F6', bg: 'bg-blue-50', sub: 'Transaksi' },
        { label: 'Laba Kotor', value: formatCurrency(summary?.total_laba_kotor || 0), icon: TrendingUp, color: '#6366F1', bg: 'bg-indigo-50' },
    ], [summary]);

    const secondaryStats = useMemo(() => [
        { label: 'Spare Part', value: formatCurrency(summary?.total_parts || 0), icon: Package, color: '#F59E0B', bg: 'bg-amber-50' },
        { label: 'Jasa', value: formatCurrency(summary?.total_jasa || 0), icon: HandHelping, color: '#A855F7', bg: 'bg-purple-50' },
    ], [summary]);

    const buildExportHtml = useCallback(() => {
        if (!summary) return '';
        return `
            <div class="section-header">RINGKASAN BENGKEL</div>
            <div class="row-item">
                <span>Total Pendapatan</span>
                <span class="font-bold">${formatCurrency(summary.total_penjualan || 0)}</span>
            </div>
            <div class="row-item">
                <span>Total Margin (Laba)</span>
                <span class="text-success font-bold">${formatCurrency(summary.total_laba_kotor || 0)}</span>
            </div>
            <div class="row-item">
                <span>Pendapatan Jasa</span>
                <span>${formatCurrency(summary.total_jasa || 0)}</span>
            </div>
            <div class="row-item">
                <span>Penjualan Sparepart</span>
                <span>${formatCurrency(summary.total_parts || 0)}</span>
            </div>
            <div class="row-item">
                <span>Total Nota</span>
                <span>${summary.total_transaksi || 0} Transaksi</span>
            </div>
            <div class="section-header" style="margin-top:30px;">DAFTAR TRANSAKSI BENGKEL</div>
            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                <thead>
                    <tr style="background-color: #f8fafc; text-align: left; font-size: 10px;">
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Tanggal/Nota</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Customer / Plat</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Total</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Margin</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(item => `
                        <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px;">
                                ${format(new Date(item.tanggal), 'dd/MM/yy', { locale: localeID })}<br/>
                                <span style="color: #64748b; font-size: 8px;">${escapeHtml(item.nomor_transaksi)}</span>
                            </td>
                            <td style="padding: 8px;">
                                <span style="font-weight: bold;">${escapeHtml(item.customer_nama)}</span><br/>
                                <span style="color: #64748b; font-size: 9px;">${escapeHtml(item.nomor_plat)}</span>
                            </td>
                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.grand_total || 0)}</td>
                            <td style="padding: 8px; color: #10b981; font-weight: bold;">${formatCurrency(item.laba_kotor || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }, [summary, transactions]);

    const handleExportPreview = useCallback(async () => {
        setShowExportMenu(false);
        if (!summary) return;
        try {
            await printReportHTML(buildExportHtml(), {
                title: 'Laporan Penjualan Bengkel',
                dateRange: getFormattedDate(),
            });
        } catch {
            Alert.alert('Error', 'Gagal mencetak laporan');
        }
    }, [summary, buildExportHtml, getFormattedDate]);

    const handleExportDownload = useCallback(async () => {
        setShowExportMenu(false);
        if (!summary) return;
        try {
            await printReportHTML(buildExportHtml(), {
                title: 'Laporan Penjualan Bengkel',
                dateRange: getFormattedDate(),
            });
        } catch {
            Alert.alert('Error', 'Gagal membuat PDF');
        }
    }, [summary, buildExportHtml, getFormattedDate]);

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <ReportPageHeader
                title="Penjualan Bengkel"
                subtitle="Laporan Jasa"
                onBack={handleBack}
                onExport={() => setShowExportMenu(true)}
                isExporting={isExporting}
            />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                <View className="px-6 pt-4">
                    <ReportStatsBento stats={stats} />
                    <ReportStatsBento stats={secondaryStats} className="mb-4" />
                    <ReportDateControls
                        filterType={filterType}
                        onFilterTypeChange={(type) => {
                            setFilterType(type);
                            setDate(new Date());
                        }}
                        formattedDate={getFormattedDate()}
                        onPrev={handlePrev}
                        onNext={handleNext}
                        search={search}
                        onSearchChange={setSearch}
                        searchPlaceholder="Cari nopol, item, atau customer..."
                    />
                    <ReportSectionHeader title="Daftar Transaksi" count={transactions.length} countLabel="Nota" />
                </View>

                <View className="px-6">

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
                        <Pressable
                            key={item.id}
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
                                        <Typography variant="caption" className="text-textGray font-medium">Customer: {item.customer_nama}</Typography>
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
                        </Pressable>
                    ))
                )
                }
                </View>
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
                            <Typography variant="h2" weight="bold">Detail Transaksi</Typography>
                            <Typography className="text-gray-400 text-xs mt-1">Informasi lengkap penjualan</Typography>
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
                            {/* Summary Card */}
                            <View className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Customer</Typography>
                                        <Typography weight="bold" className="text-lg">{selectedTransaction.customer_nama}</Typography>
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

            <ReportExportSheet
                visible={showExportMenu}
                onClose={() => setShowExportMenu(false)}
                subtitle="Pilih metode ekspor dokumen PDF"
                onPreview={handleExportPreview}
                onDownload={handleExportDownload}
            />
        </SafeAreaView>
    );
}
