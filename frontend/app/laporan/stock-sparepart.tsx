import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Package, AlertTriangle, Coins, BarChart3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency } from '../../utils/format';
import { printReportHTML } from '../../utils/printReport';
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

export default function StockSparepartReportScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
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

    const stats = useMemo(() => [
        {
            label: 'Total Produk',
            value: String(stockStats?.total_products || 0),
            icon: Package,
            color: '#3B82F6',
            bg: 'bg-blue-50',
            sub: 'Item',
        },
        {
            label: 'Total Stok',
            value: String(stockStats?.total_items || 0),
            icon: BarChart3,
            color: '#10B981',
            bg: 'bg-emerald-50',
            sub: 'Unit',
        },
        {
            label: 'Nilai Aset',
            value: formatCurrency(stockStats?.total_value || 0),
            icon: Coins,
            color: '#F59E0B',
            bg: 'bg-amber-50',
        },
    ], [stockStats]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/laporan');
        }
    };

    const buildExportHtml = useCallback(() => {
        if (!stockStats) return '';
        return `
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
                                <b>${escapeHtml(part.nama)}</b><br/>
                                <span style="font-size: 8px; color: #94a3b8;">${escapeHtml(part.kode)}</span>
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
    }, [stockStats, parts]);

    const handleExportPreview = useCallback(async () => {
        setShowExportMenu(false);
        if (!stockStats) return;
        try {
            await printReportHTML(buildExportHtml(), {
                title: 'Laporan Stok Sparepart',
                dateRange: getFormattedDate(),
            });
        } catch {
            Alert.alert('Error', 'Gagal mencetak laporan');
        }
    }, [stockStats, buildExportHtml, getFormattedDate]);

    const handleExportDownload = useCallback(async () => {
        setShowExportMenu(false);
        if (!stockStats) return;
        try {
            await printReportHTML(buildExportHtml(), {
                title: 'Laporan Stok Sparepart',
                dateRange: getFormattedDate(),
            });
        } catch {
            Alert.alert('Error', 'Gagal membuat PDF');
        }
    }, [stockStats, buildExportHtml, getFormattedDate]);

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <ReportPageHeader
                title="Laporan Stok"
                subtitle="Stok Sparepart"
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
                    <ReportStatsBento stats={stats} className="mb-4" />
                    <ReportDateControls
                        filterType={filterType}
                        onFilterTypeChange={setFilterType}
                        formattedDate={getFormattedDate()}
                        onPrev={handlePrev}
                        onNext={handleNext}
                        search={search}
                        onSearchChange={setSearch}
                        searchPlaceholder="Cari sparepart..."
                        showFilterTabs
                    />
                    <ReportSectionHeader
                        title="Daftar Inventaris Kolektif"
                        count={parts.length}
                        countLabel="Ditampilkan"
                    />
                </View>

                <View className="px-6">
                    {isLoading ? (
                        <View className="py-20 items-center">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MEMUAT DATA...</Typography>
                        </View>
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

                    <View className="mt-6 bg-blue-50 p-4 rounded-2xl flex-row border border-blue-100">
                        <AlertTriangle size={20} color="#3B82F6" className="mr-3" />
                        <View className="flex-1">
                            <Typography variant="caption" className="text-blue-800 leading-5">
                                Data stok ini adalah posisi inventaris per hari ini. Nilai aset dihitung berdasarkan (Stok × Harga Beli Terakhir).
                            </Typography>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <ReportExportSheet
                visible={showExportMenu}
                onClose={() => setShowExportMenu(false)}
                title="Ekspor Laporan Stok"
                subtitle="Pilih metode ekspor dokumen PDF"
                onPreview={handleExportPreview}
                onDownload={handleExportDownload}
            />
        </SafeAreaView>
    );
}