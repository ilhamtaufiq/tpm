import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, ScrollView, Pressable, StatusBar,
    RefreshControl as RNRefreshControl, ActivityIndicator,
    TextInput, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft, ChevronRight, Calendar, Car,
    Wallet, TrendingUp, Search, X, User,
    Wrench, Package, Printer, Download, Eye, Share2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { mobilService } from '../../services/mobil';
import { formatCurrency } from '../../utils/format';
import { printReportHTML } from '../../utils/printReport';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function PembelianMobilReportScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
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

    const STATS = [
        {
            label: "Total Belanja",
            value: formatCurrency(summary?.total_modal_pembelian || 0),
            icon: Wallet,
            color: "#10B981",
            isCurrency: true
        },
        {
            label: "Unit Dibeli",
            value: summary?.total_mobil || 0,
            icon: Car,
            color: "#3B82F6",
            unit: "Unit"
        },
        {
            label: "Tersedia",
            value: summary?.per_status?.Tersedia || 0,
            icon: TrendingUp,
            color: "#F59E0B",
            unit: "Unit"
        }
    ];

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

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <Typography variant="h2" weight="bold">Laporan Pembelian Mobil</Typography>
                </View>
                <View className="flex-row items-center">
                    <Badge variant="info" label="Inventory" className="px-3 py-1 mr-2" />
                    <Pressable
                        onPress={() => setShowExportMenu(true)}
                        disabled={isExporting}
                        className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100"
                    >
                        <Download size={20} color="#023C69" />
                    </Pressable>
                </View>
            </View>

            {/* Date Filter Section */}
            <View className="px-6 py-4 bg-white border-b border-gray-100">
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
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
                        </Pressable>
                    ))}
                </View>

                <View className="flex-row justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <Pressable
                        onPress={handlePrev}
                        className="p-1 bg-white rounded-full shadow-sm border border-gray-100"
                        activeOpacity={0.7}
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
                        className="p-1 bg-white rounded-full shadow-sm border border-gray-100"
                        activeOpacity={0.7}
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
                        placeholder="Cari merek, model, atau plat..."
                        className="flex-1 ml-2 text-text font-outfit"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {/* Car List */}
                <View className="flex-row justify-between items-center mb-4">
                    <Typography variant="h3" weight="bold">Unit Masuk</Typography>
                    <Typography variant="caption" className="text-gray-500">{mobils.length} Kendaraan</Typography>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#3B82F6" className="mt-10" />
                ) : (
                    <View className="space-y-4">
                        {mobils.length === 0 ? (
                            <View className="items-center justify-center p-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                <Car size={48} color="#D1D5DB" />
                                <Typography className="text-gray-400 mt-4">Tidak ada unit masuk periode ini</Typography>
                            </View>
                        ) : (
                            mobils.map((item) => (
                                <Pressable
                                    key={item.id}
                                    activeOpacity={0.7}
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
                )}

                <View className="h-20" />
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

            {/* Export Action Menu */}
            <Modal
                visible={showExportMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExportMenu(false)}
            >
                <Pressable
                    className="flex-1 bg-black/50 justify-end"
                    activeOpacity={1}
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
                                                                <span style="font-weight: bold;">${item.merek} ${item.model}</span><br/>
                                                                <span style="color: #64748b; font-size: 8px;">${item.nomor_plat} • ${item.tahun}</span><br/>
                                                                <span style="color: #64748b; font-size: 8px;">${item.tipe_kepemilikan === 'TPM' ? 'Unit TPM' : `Investor: ${item.nama_investor}`}</span>
                                                            </td>
                                                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.harga_beli || 0)}</td>
                                                            <td style="padding: 8px;">
                                                                <span style="color: ${item.status === 'Tersedia' ? '#10b981' : item.status === 'Terjual' ? '#3b82f6' : '#f59e0b'}; font-weight: bold; font-size: 8px;">
                                                                    ${item.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Pembelian Mobil',
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
                                                                <span style="font-weight: bold;">${item.merek} ${item.model}</span><br/>
                                                                <span style="color: #64748b; font-size: 8px;">${item.nomor_plat} • ${item.tahun}</span><br/>
                                                                <span style="color: #64748b; font-size: 8px;">${item.tipe_kepemilikan === 'TPM' ? 'Unit TPM' : `Investor: ${item.nama_investor}`}</span>
                                                            </td>
                                                            <td style="padding: 8px; font-weight: bold;">${formatCurrency(item.harga_beli || 0)}</td>
                                                            <td style="padding: 8px;">
                                                                <span style="color: ${item.status === 'Tersedia' ? '#10b981' : item.status === 'Terjual' ? '#3b82f6' : '#f59e0b'}; font-weight: bold; font-size: 8px;">
                                                                    ${item.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Pembelian Mobil',
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
