import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View, ScrollView, Pressable, StatusBar,
    RefreshControl as RNRefreshControl, ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    Car, Wallet, TrendingUp, X, Package
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

export default function PembelianMobilReportScreen() {
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
    const [mobils, setMobils] = useState<any[]>([]);

    // Detail Modal State
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%', '92%'], []);
    const [selectedMobil, setSelectedMobil] = useState<any>(null);
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
                mobilService.getInventorySummary({
                    tanggal_dari: dari,
                    tanggal_sampai: sampai
                }),
                mobilService.getMobils({
                    search,
                    tanggal_dari: dari,
                    tanggal_sampai: sampai,
                    limit: 100,
                    sort_by: "tanggal_masuk",
                    sort_order: "desc"
                })
            ]);

            setSummary(summaryData);
            setMobils(Array.isArray(listData) ? listData : listData?.data || []);
        } catch (error) {
            console.error('Error fetching car purchase report:', error);
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

    const stats = useMemo(() => [
        {
            label: 'Total Belanja',
            value: formatCurrency(summary?.total_modal_pembelian || 0),
            icon: Wallet,
            color: '#10B981',
            bg: 'bg-emerald-50',
        },
        {
            label: 'Unit Dibeli',
            value: String(summary?.total_mobil || 0),
            icon: Car,
            color: '#3B82F6',
            bg: 'bg-blue-50',
            sub: 'Unit',
        },
        {
            label: 'Tersedia',
            value: String(summary?.per_status?.Tersedia || 0),
            icon: TrendingUp,
            color: '#F59E0B',
            bg: 'bg-amber-50',
            sub: 'Unit',
        },
    ], [summary]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/laporan');
        }
    };

    const handlePressMobil = async (item: any) => {
        setSelectedMobil(item);
        bottomSheetModalRef.current?.present();
        setDetailLoading(true);
        try {
            const detail = await mobilService.getMobil(item.id);
            setSelectedMobil(detail);
        } catch (error) {
            console.error('Failed to fetch mobil detail:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCloseModal = () => {
        bottomSheetModalRef.current?.dismiss();
    };

    const buildExportHtml = useCallback(() => {
        if (!summary) return '';
        return `
            <div class="section-header">RINGKASAN PEMBELIAN</div>
            <div class="row-item">
                <span>Total Belanja</span>
                <span>${formatCurrency(summary.total_modal_pembelian || 0)}</span>
            </div>
            <div class="row-item">
                <span>Unit Dibeli</span>
                <span>${summary.total_mobil || 0} Unit</span>
            </div>
            <div class="row-item">
                <span>Unit Tersedia</span>
                <span>${summary.per_status?.Tersedia || 0} Unit</span>
            </div>
            <div class="row-item">
                <span>Unit Terjual</span>
                <span>${summary.per_status?.Terjual || 0} Unit</span>
            </div>

            <div class="section-header" style="margin-top:30px;">DAFTAR UNIT MASUK</div>
            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                <thead>
                    <tr style="background-color: #f8fafc; text-align: left; font-size: 10px;">
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Tgl Masuk</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Unit</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Harga Beli</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${mobils.map(item => `
                        <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px;">
                                ${format(new Date(item.tanggal_masuk), 'dd/MM/yy', { locale: localeID })}
                            </td>
                            <td style="padding: 8px;">
                                <span style="font-weight: bold;">${escapeHtml(item.merek)} ${escapeHtml(item.model)}</span><br/>
                                <span style="color: #64748b; font-size: 8px;">${escapeHtml(item.nomor_plat)} • ${escapeHtml(item.tahun)}</span><br/>
                                <span style="color: #64748b; font-size: 8px;">${item.tipe_kepemilikan === 'TPM' ? 'Unit TPM' : `Investor: ${escapeHtml(item.nama_investor)}`}</span>
                            </td>
                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.harga_beli || 0)}</td>
                            <td style="padding: 8px;">
                                <span style="color: ${item.status === 'Tersedia' ? '#10b981' : item.status === 'Terjual' ? '#3b82f6' : '#f59e0b'}; font-weight: bold; font-size: 8px;">
                                    ${escapeHtml(item.status)}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }, [summary, mobils]);

    const handleExportPreview = useCallback(async () => {
        setShowExportMenu(false);
        if (!summary) return;
        try {
            await printReportHTML(buildExportHtml(), {
                title: 'Laporan Pembelian Mobil',
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
                title: 'Laporan Pembelian Mobil',
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
                title="Pembelian Mobil"
                subtitle="Laporan Inventory"
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
                        searchPlaceholder="Cari merek, model, atau plat..."
                    />
                    <ReportSectionHeader title="Unit Masuk" count={mobils.length} countLabel="Kendaraan" />
                </View>

                <View className="px-6">
                    {isLoading ? (
                        <View className="py-20 items-center">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MEMUAT DATA...</Typography>
                        </View>
                    ) : mobils.length === 0 ? (
                        <View className="items-center justify-center py-20 bg-white rounded-[40px] border border-dashed border-gray-100">
                            <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6 opacity-30">
                                <Car size={40} color="#9CA3AF" />
                            </View>
                            <Typography className="text-textGray font-bold uppercase tracking-[6px]">Belum Ada Data</Typography>
                            <Typography variant="caption" className="text-textGray/40 mt-2">Tidak ada unit masuk periode ini</Typography>
                        </View>
                    ) : (
                        mobils.map((item) => (
                            <Pressable
                                key={item.id}
                                onPress={() => handlePressMobil(item)}
                            >
                                <Card className="p-4 border-gray-100 mb-4">
                                    <View className="flex-row justify-between mb-2">
                                        <View className="flex-1">
                                            <Typography variant="body2" weight="bold">{item.merek} {item.model} ({item.tahun})</Typography>
                                            <Typography variant="caption" className="text-gray-400 font-bold">{item.nomor_plat}</Typography>
                                        </View>
                                        <Badge
                                            variant={item.status === 'Tersedia' ? 'success' : item.status === 'Terjual' ? 'info' : 'warning'}
                                            label={item.status}
                                        />
                                    </View>

                                    <View className="flex-row justify-between items-end mt-2 pt-2 border-t border-gray-50">
                                        <View>
                                            <Typography variant="caption" className="text-gray-500">
                                                Tgl Masuk: {format(new Date(item.tanggal_masuk), 'dd MMM yyyy', { locale: localeID })}
                                            </Typography>
                                            <Typography variant="caption" className="text-gray-400">
                                                By: {item.tipe_kepemilikan === 'TPM' ? 'Unit TPM' : `Investor: ${item.nama_investor}`}
                                            </Typography>
                                        </View>
                                        <View className="items-end">
                                            <Typography variant="caption" className="text-gray-400">Harga Beli</Typography>
                                            <Typography variant="body2" weight="bold" className="text-primary">
                                                {formatCurrency(item.harga_beli || 0)}
                                            </Typography>
                                        </View>
                                    </View>
                                </Card>
                            </Pressable>
                        ))
                    )}
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
                            <Typography variant="h2" weight="bold">Detail Unit</Typography>
                            <Typography className="text-gray-400 text-xs mt-1">Informasi lengkap kendaraan</Typography>
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
                    ) : selectedMobil ? (
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            {/* Summary Card */}
                            <View className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Kendaraan</Typography>
                                        <Typography weight="bold" className="text-lg">{selectedMobil.merek} {selectedMobil.model}</Typography>
                                        <Typography className="text-gray-500 text-xs font-semibold">{selectedMobil.nomor_plat} • Tahun {selectedMobil.tahun}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Status</Typography>
                                        <Badge
                                            variant={selectedMobil.status === 'Tersedia' ? 'success' : selectedMobil.status === 'Terjual' ? 'info' : 'warning'}
                                            label={selectedMobil.status}
                                        />
                                    </View>
                                </View>

                                <View className="flex-row justify-between mb-2">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Tanggal Masuk</Typography>
                                        <Typography weight="bold">{format(new Date(selectedMobil.tanggal_masuk), 'dd MMM yyyy', { locale: localeID })}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Kepemilikan</Typography>
                                        <Typography weight="medium" className="text-gray-700">
                                            {selectedMobil.tipe_kepemilikan === 'TPM' ? 'Unit TPM' : `Investor: ${selectedMobil.nama_investor}`}
                                        </Typography>
                                    </View>
                                </View>
                            </View>

                            {/* Biaya Operasional Section */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-amber-100 rounded-md items-center justify-center mr-2">
                                        <Wallet size={14} color="#F59E0B" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Biaya Operasional</Typography>
                                </View>
                                {selectedMobil.biaya_operasional && selectedMobil.biaya_operasional.length > 0 ? (
                                    selectedMobil.biaya_operasional.map((item: any, index: number) => (
                                        <View key={`biaya-${index}`} className="flex-row justify-between items-start py-3 border-b border-gray-100 last:border-0">
                                            <View className="flex-1 pr-4">
                                                <Typography weight="bold" className="text-gray-800 text-sm">
                                                    {item.keterangan}
                                                </Typography>
                                                <Typography variant="caption" className="text-gray-500">
                                                    {format(new Date(item.tanggal), 'dd MMM yyyy', { locale: localeID })}
                                                </Typography>
                                            </View>
                                            <Typography weight="bold" className="text-gray-900 text-sm">
                                                {formatCurrency(item.jumlah)}
                                            </Typography>
                                        </View>
                                    ))
                                ) : (
                                    <Typography className="text-gray-400 italic text-sm ml-8">Tidak ada biaya operasional</Typography>
                                )}
                            </View>

                            {/* Bengkel Parts Section */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-blue-100 rounded-md items-center justify-center mr-2">
                                        <Package size={14} color="#3B82F6" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Perawatan Bengkel</Typography>
                                </View>
                                {selectedMobil.part_services && selectedMobil.part_services.length > 0 ? (
                                    selectedMobil.part_services.map((item: any, index: number) => (
                                        <View key={`part-${index}`} className="flex-row justify-between items-start py-3 border-b border-gray-100 last:border-0">
                                            <View className="flex-1 pr-4">
                                                <Typography weight="bold" className="text-gray-800 text-sm">
                                                    {item.spare_part?.nama || item.nama_jasa || 'Item'}
                                                </Typography>
                                                <Typography variant="caption" className="text-gray-500">
                                                    {item.qty || 1} x {formatCurrency(item.harga || item.harga_satuan || 0)}
                                                </Typography>
                                            </View>
                                            <Typography weight="bold" className="text-gray-900 text-sm">
                                                {formatCurrency(item.subtotal || (item.qty * (item.harga || item.harga_satuan)) || 0)}
                                            </Typography>
                                        </View>
                                    ))
                                ) : (
                                    <Typography className="text-gray-400 italic text-sm ml-8">Tidak ada perawatan bengkel</Typography>
                                )}
                            </View>

                            {/* Financial Summary */}
                            <View className="bg-primary/5 p-5 rounded-2xl border border-primary/10 mb-8">
                                <View className="space-y-2 mb-4">
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Harga Beli</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedMobil.harga_beli || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Biaya Operasional</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedMobil.total_biaya_operasional || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Biaya Bengkel</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedMobil.total_biaya_bengkel || 0)}</Typography>
                                    </View>
                                    {selectedMobil.nominal_investor > 0 && (
                                        <View className="flex-row justify-between">
                                            <Typography className="text-amber-500 text-xs">Modal Investor</Typography>
                                            <Typography weight="bold" className="text-amber-600 text-sm">{formatCurrency(selectedMobil.nominal_investor)}</Typography>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-row justify-between items-center pt-3 border-t border-primary/10">
                                    <Typography weight="bold" className="text-lg text-primary">Total Modal</Typography>
                                    <Typography variant="h2" weight="bold" className="text-primary text-2xl">
                                        {formatCurrency(selectedMobil.total_modal || 0)}
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