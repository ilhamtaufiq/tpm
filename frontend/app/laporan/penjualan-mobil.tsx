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
    TrendingUp, User, BarChart3, X, CreditCard,
    Percent, Car
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { mobilService } from '../../services/mobil';
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

export default function PenjualanMobilReportScreen() {
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

    const stats = useMemo(() => [
        { label: 'Total Omset', value: formatCurrency(summary?.total_penjualan || 0), icon: TrendingUp, color: '#10B981', bg: 'bg-emerald-50' },
        { label: 'Unit Terjual', value: String(summary?.total_transaksi || 0), icon: Car, color: '#3B82F6', bg: 'bg-blue-50', sub: 'Kendaraan' },
        { label: 'Laba TPM', value: formatCurrency(summary?.laba_tpm || 0), icon: TrendingUp, color: '#023C69', bg: 'bg-primary/5' },
    ], [summary]);

    const secondaryStats = useMemo(() => [
        { label: 'Investor', value: formatCurrency(summary?.laba_investor || 0), icon: User, color: '#F59E0B', bg: 'bg-amber-50' },
    ], [summary]);

    const buildExportHtml = useCallback(() => {
        if (!summary) return '';
        return `
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
                                <span style="color: #64748b; font-size: 8px;">${escapeHtml(item.nomor_transaksi)}</span>
                            </td>
                            <td style="padding: 8px;">
                                <span style="font-weight: bold;">${escapeHtml(item.mobil?.merek)} ${escapeHtml(item.mobil?.model)}</span><br/>
                                <span style="color: #64748b; font-size: 9px;">${escapeHtml(item.nama_pembeli)}</span>
                            </td>
                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.harga_jual || 0)}</td>
                            <td style="padding: 8px;">
                                <span style="color: ${item.status_bayar === 'LUNAS' ? '#10b981' : '#ef4444'}; font-weight: bold; font-size: 8px;">
                                    ${escapeHtml(item.status_bayar)}
                                </span>
                                ${item.sisa_bayar > 0 ? `<br/><span style="color: #ef4444; font-size: 8px;">Sisa: ${formatCurrency(item.sisa_bayar)}</span>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }, [summary, transaksis]);

    const handleExportPreview = useCallback(async () => {
        setShowExportMenu(false);
        if (!summary) return;
        try {
            await printReportHTML(buildExportHtml(), {
                title: 'Laporan Penjualan Mobil',
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
                title: 'Laporan Penjualan Mobil',
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
                title="Penjualan Mobil"
                subtitle="Laporan Unit"
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
                        searchPlaceholder="Cari nopol, merek, atau pembeli..."
                    />
                    <ReportSectionHeader title="Riwayat Penjualan" count={transaksis.length} countLabel="Data" />
                </View>

                <View className="px-6">

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