import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Modal, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import {
    TrendingUp, BarChart3, ArrowUpRight, ArrowDownLeft, Download, X, Truck,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';
import { useLabaRugiReport } from '../../hooks/useKeuangan';
import { buildLabaRugiExportHtml } from '../../utils/reportTemplates';
import { FinancialRow } from '../../components/ui/FinancialRow';
import { LabaRugiReport } from '../../types/reports';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import {
    ReportPageHeader,
    ReportDateControls,
    ReportExportSheet,
    ReportFilterType,
} from '../../components/laporan';

export default function LabaRugiScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    
    const { themeColors } = useUIStore();

    const handlePrev = useCallback(() => {
        setDate(prev => {
            if (filterType === 'daily') return subDays(prev, 1);
            if (filterType === 'monthly') return subMonths(prev, 1);
            return subYears(prev, 1);
        });
    }, [filterType]);

    const handleNext = useCallback(() => {
        setDate(prev => {
            if (filterType === 'daily') return addDays(prev, 1);
            if (filterType === 'monthly') return addMonths(prev, 1);
            return addYears(prev, 1);
        });
    }, [filterType]);

    const formattedDate = useMemo(() => {
        if (filterType === 'daily') return format(date, 'd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [date, filterType]);

    const reportParams = useMemo(() => {
        const start = filterType === 'daily' ? date : (filterType === 'monthly' ? startOfMonth(date) : startOfYear(date));
        const end = filterType === 'daily' ? date : (filterType === 'monthly' ? endOfMonth(date) : endOfYear(date));
        return {
            tanggal_dari: format(start, 'yyyy-MM-dd'),
            tanggal_sampai: format(end, 'yyyy-MM-dd')
        };
    }, [date, filterType]);

    const { data, isLoading, refetch: fetchData } = useLabaRugiReport(reportParams);
    const reportData = data as LabaRugiReport | undefined;

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/(tabs)/home');
        }
    }, [navigation, router]);

    // Data Mappings
    const bengkelData = useMemo(() => {
        const unit = reportData?.units?.bengkel || {} as any;
        return {
            penjualan: reportData?.bengkel_details?.total_subtotal || (unit.revenue + (reportData?.bengkel_details?.total_diskon || 0)),
            hpp: unit.hpp || 0,
            biayaOps: unit.beban_operasional || 0,
            biayaGaji: unit.beban_gaji || 0,
            biayaLembur: unit.beban_lembur || 0,
            laba_kotor: unit.laba_kotor || 0,
            laba_bersih: unit.laba_bersih || 0
        };
    }, [reportData]);

    const mobilRepairData = useMemo(() => {
        const unit = reportData?.units?.mobil || {} as any;
        const details = reportData?.mobil_details || {} as any;
        const sold = Math.max(0, unit.maintenance ?? details.total_biaya_bengkel ?? details.biaya_bengkel ?? 0);
        const all = details.total_biaya_bengkel_all ?? sold;
        const unsold = details.total_biaya_bengkel_unsold ?? Math.max(0, all - sold);

        return { sold, unsold, all };
    }, [reportData]);

    const mobilPrepData = useMemo(() => {
        const unit = reportData?.units?.mobil || {} as any;
        const details = reportData?.mobil_details || {} as any;
        const sold = unit.beban_operasional || 0;
        const all = details.total_biaya_persiapan ?? sold;
        const unsold = Math.max(0, all - sold);

        return { sold, unsold, all };
    }, [reportData]);

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!reportData) return;
        setIsExporting(true);
        try {
            const html = buildLabaRugiExportHtml(reportData, date, filterType);
            
            if (mode === 'preview') {
                setPreviewHtml(html);
                setShowPdfPreview(true);
                setShowExportMenu(false);
            } else if (mode === 'print') {
                if (Platform.OS === 'web') {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                        printWindow.document.write(html);
                        printWindow.document.close();
                        printWindow.print();
                    }
                } else {
                    await Print.printAsync({ html });
                }
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                if (Platform.OS === 'web') {
                    const link = document.createElement('a');
                    link.href = uri;
                    link.download = `LabaRugi_${formattedDate.replace(/ /g, '_')}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Laporan Laba Rugi',
                        UTI: 'com.adobe.pdf'
                    });
                }
            }
        } catch (e) {
            Alert.alert('Error', 'Gagal memproses laporan');
        } finally {
            setIsExporting(false);
        }
    };

    const renderBengkelSection = () => (
        <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
            <View className="bg-blue-600 px-5 py-4 flex-row items-center justify-between w-full">
                <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center mr-3 border border-white/10">
                        <TrendingUp size={18} color="white" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-white tracking-tight">Unit Bengkel</Typography>
                </View>
                <View className="bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                    <Typography weight="bold" className="text-white text-[10px] uppercase tracking-widest">Revenue Center</Typography>
                </View>
            </View>

            <View className="p-5 w-full">
                <View className="mb-4 w-full">
                    <Typography variant="caption" weight="bold" className="text-blue-600 mb-2 uppercase tracking-widest text-[10px]">I. Pendapatan Operasional</Typography>
                    <FinancialRow label="Penjualan Sparepart & Jasa" value={bengkelData.penjualan} bold large color="text-slate-800" />
                    <FinancialRow label=" - Penjualan Sparepart (Retail)" value={reportData?.bengkel_details?.total_parts || 0} small indent />
                    <FinancialRow label=" - Jasa Servis" value={reportData?.bengkel_details?.total_jasa || 0} small indent />
                    <FinancialRow label=" - Diskon Penjualan" value={reportData?.bengkel_details?.total_diskon || 0} small indent isNegative color="text-rose-500" />
                </View>

                <View className="bg-slate-50/80 p-3 rounded-xl mb-4 border border-slate-100">
                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">II. Beban Pokok Penjualan (HPP)</Typography>
                    <FinancialRow label="HPP Sparepart Terjual" value={bengkelData.hpp} isNegative color="text-rose-600" />
                </View>

                <View className="bg-blue-50/50 w-full p-4 rounded-xl border border-blue-100/60 mb-5">
                    <FinancialRow label="Laba Kotor Bengkel" value={bengkelData.laba_kotor} bold large color="text-blue-800" />
                </View>

                <View className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 w-full mb-4">
                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">III. Beban Operasional Unit</Typography>
                    <FinancialRow label="Beban Gaji Karyawan" value={bengkelData.biayaGaji} isNegative />
                    <FinancialRow label="Beban Lembur Karyawan" value={bengkelData.biayaLembur} isNegative />
                    <FinancialRow label="Beban Operasional Unit" value={bengkelData.biayaOps} isNegative />
                </View>

                <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${bengkelData.laba_bersih >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                    <View>
                        <Typography variant="body2" weight="bold" className="text-white">IV. Laba/Rugi Bersih Unit</Typography>
                        <Typography variant="caption" className="text-white/60 uppercase tracking-tighter text-[10px] mt-0.5">Setelah Beban Operasional</Typography>
                    </View>
                    <Typography variant="h3" weight="bold" className="text-white">
                        {bengkelData.laba_bersih < 0 ? `(${formatCurrency(Math.abs(bengkelData.laba_bersih))})` : formatCurrency(bengkelData.laba_bersih)}
                    </Typography>
                </View>
            </View>
        </Card>
    );

    const renderJasaAngkutSection = () => {
        const unit = reportData?.units?.jasa_angkut || {} as any;
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-emerald-600 px-5 py-4 flex-row items-center justify-between w-full">
                    <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center mr-3 border border-white/10">
                            <Truck size={18} color="white" />
                        </View>
                        <Typography variant="h4" weight="bold" className="text-white tracking-tight">Unit Jasa Angkut</Typography>
                    </View>
                    <View className="bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                        <Typography weight="bold" className="text-white text-[10px] uppercase tracking-widest">Logistic Service</Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <Typography variant="caption" weight="bold" className="text-emerald-600 mb-2 uppercase tracking-widest text-[10px]">I. Pendapatan Operasional</Typography>
                    <FinancialRow label="Pendapatan Jasa (Kotor Unit)" value={unit.revenue} bold large color="text-slate-800" />
                    
                    <View className="bg-slate-50/80 p-3 rounded-xl mb-4 mt-4 border border-slate-100">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">II. Biaya Armada & Maintenance</Typography>
                        <FinancialRow label="Pemeliharaan (Bengkel)" value={unit.maintenance} isNegative color="text-rose-600" />
                        <FinancialRow label="Operasional (BBM, Tol, dll)" value={unit.beban_operasional} isNegative color="text-rose-600" />
                    </View>

                    <View className="p-1 px-3 mb-4">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-1 uppercase tracking-widest text-[10px]">III. Biaya Umum Unit</Typography>
                        <FinancialRow label="Beban Umum Jasa Angkut" value={unit.beban_umum} isNegative />
                    </View>

                    <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${unit.laba_bersih >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                        <View>
                            <Typography variant="body2" weight="bold" className="text-white">IV. Laba Bersih Unit</Typography>
                            <Typography variant="caption" className="text-white/60 uppercase tracking-tighter text-[10px] mt-0.5">Final Profit Share</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className="text-white">
                            {unit.laba_bersih < 0 ? `(${formatCurrency(Math.abs(unit.laba_bersih))})` : formatCurrency(unit.laba_bersih)}
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderMobilSection = () => {
        const unit = reportData?.units?.mobil || {} as any;
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-amber-500 px-5 py-4 flex-row items-center justify-between w-full">
                    <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center mr-3 border border-white/10">
                            <ArrowUpRight size={18} color="white" />
                        </View>
                        <Typography variant="h4" weight="bold" className="text-white tracking-tight">Unit Jual Beli Mobil</Typography>
                    </View>
                    <View className="bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                        <Typography weight="bold" className="text-white text-[10px] uppercase tracking-widest">Car Trading</Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <Typography variant="caption" weight="bold" className="text-amber-600 mb-2 uppercase tracking-widest text-[10px]">I. Pendapatan Penjualan</Typography>
                    <FinancialRow label="Total Penjualan Unit (Gross)" value={unit.revenue} bold large color="text-slate-800" />

                    {(unit.dana_penalti ?? unit.pendapatan_lainnya ?? 0) > 0 && (
                        <View className="bg-amber-50/80 p-3 rounded-xl mb-4 mt-4 border border-amber-100">
                            <Typography variant="caption" weight="bold" className="text-amber-700 mb-2 uppercase tracking-widest text-[10px]">Dana Penalti</Typography>
                            <FinancialRow
                                label="Penalti Pembatalan Booking"
                                value={unit.dana_penalti ?? unit.pendapatan_lainnya ?? 0}
                                bold
                                color="text-amber-800"
                            />
                        </View>
                    )}

                    <View className="bg-slate-50/80 p-3 rounded-xl mb-4 mt-4 border border-slate-100">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">II. Beban Pokok Penjualan (HPP)</Typography>
                        <FinancialRow label="Harga Beli Unit" value={unit.hpp} isNegative color="text-rose-600" />
                        <FinancialRow label="Biaya Persiapan - Mobil Terjual" value={mobilPrepData.sold} isNegative color="text-rose-600" />
                        <FinancialRow label="Biaya Perbaikan Bengkel - Mobil Terjual" value={mobilRepairData.sold} isNegative color="text-rose-600" />
                    </View>

                    <View className="p-1 px-3 mb-4">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">III. Beban Umum Unit</Typography>
                        {(unit.sharing_investor || 0) > 0 && (
                            <FinancialRow label="Bagi Hasil Investor" value={unit.sharing_investor || 0} isNegative color="text-rose-600" />
                        )}
                        <FinancialRow label="Beban Umum & Operasional" value={unit.beban_umum} isNegative />
                    </View>

                    <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${unit.laba_bersih >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                        <View>
                            <Typography variant="body2" weight="bold" className="text-white">IV. Laba Bersih Unit</Typography>
                            <Typography variant="caption" className="text-white/60 uppercase tracking-tighter text-[10px] mt-0.5">Setelah Biaya & Share</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className="text-white">
                            {unit.laba_bersih < 0 ? `(${formatCurrency(Math.abs(unit.laba_bersih))})` : formatCurrency(unit.laba_bersih)}
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderOverheadSection = () => (
        <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
            <View className="bg-slate-700 px-5 py-4 flex-row items-center justify-between w-full">
                <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center mr-3 border border-white/10">
                        <ArrowDownLeft size={18} color="white" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-white tracking-tight">Biaya Operasional Pusat</Typography>
                </View>
                <View className="bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                    <Typography weight="bold" className="text-white text-[10px] uppercase tracking-widest">Tiga Putra Motor</Typography>
                </View>
            </View>

            <View className="p-5 w-full">
                <FinancialRow label="Total Beban Umum & Lainnya" value={reportData?.summary?.total_beban_umum || 0} isNegative bold large color="text-slate-800" />
                {(reportData?.summary?.internal_profit_elimination || 0) > 0 && (
                    <FinancialRow
                        label="Info Laba Internal Mobil Belum Terjual"
                        value={reportData?.summary?.internal_profit_elimination || 0}
                        color="text-amber-700"
                    />
                )}
            </View>
        </Card>
    );

    const renderFinalRecap = () => {
        const finalProfit = reportData?.summary?.laba_bersih || 0;
        const totalProfitBeforePrive = reportData?.summary?.laba_operasional || 0;
        const priveTotal = reportData?.summary?.prive || 0;

        return (
            <Card className="bg-indigo-950 p-6 rounded-[40px] shadow-2xl shadow-indigo-900/40 mb-12 overflow-hidden relative w-full border border-indigo-900">
                <View className="absolute -right-12 -top-12 opacity-10">
                    <TrendingUp size={240} color="white" />
                </View>

                <View className="flex-row items-center mb-6">
                    <View className="bg-indigo-500/20 px-4 py-2 rounded-2xl border border-indigo-500/20 flex-row items-center">
                        <BarChart3 size={16} color="#C7D2FE" className="mr-2" />
                        <Typography weight="bold" className="text-indigo-200 uppercase tracking-[3px] text-[10px]">Financial Summary</Typography>
                    </View>
                </View>

                <View className="mb-6 w-full px-2">
                    <FinancialRow label="Total Laba Operasional Seluruh Unit" value={totalProfitBeforePrive} isDark large />
                    <View className="h-[1px] bg-white/10 w-full my-3" />
                    <FinancialRow label="Beban Prive (Penarikan Modal Pemilik)" value={priveTotal} isNegative isDark color="text-rose-400" />
                </View>

                <View className="w-full bg-indigo-900/50 p-6 rounded-3xl border border-indigo-800 shadow-inner">
                    <View className="flex-row justify-between items-end">
                        <View>
                            <Typography variant="caption" weight="bold" className="text-indigo-300 uppercase tracking-[4px] mb-2 text-[9px]">Laba Bersih Akhir (TPM)</Typography>
                            <Typography variant="h1" weight="bold" className="text-white text-4xl tracking-tighter">
                                {finalProfit < 0 ? `(${formatCurrency(Math.abs(finalProfit))})` : formatCurrency(finalProfit)}
                            </Typography>
                        </View>
                        <View className={`px-3 py-1.5 rounded-xl border ${finalProfit >= 0 ? "bg-emerald-500/20 border-emerald-500/30" : "bg-rose-500/20 border-rose-500/30"}`}>
                            <Typography weight="bold" className={finalProfit >= 0 ? "text-emerald-400 text-[10px]" : "text-rose-400 text-[10px]"}>
                                {finalProfit >= 0 ? "PROFIT" : "LOSS"}
                            </Typography>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <ReportPageHeader
                title="Laba Rugi"
                subtitle="Analisa Finansial TPM"
                onBack={handleBack}
                onExport={() => setShowExportMenu(true)}
                isExporting={isExporting}
            />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 40) }}
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={fetchData} />}
                showsVerticalScrollIndicator={false}
            >
                <View className="px-6 pt-4">
                    <ReportDateControls
                        filterType={filterType}
                        onFilterTypeChange={setFilterType}
                        formattedDate={formattedDate}
                        onPrev={handlePrev}
                        onNext={handleNext}
                    />
                </View>

                <View className="px-4 pt-5">
                {isLoading ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color={themeColors.primary} />
                    </View>
                ) : (
                    <>
                        <View className="flex-row justify-between items-center mb-4 px-2 w-full">
                            <Typography variant="h4" weight="bold" className="text-slate-800">Perincian Laba</Typography>
                            <Typography variant="caption" className="text-slate-400">Total 3 Unit Bisnis</Typography>
                        </View>

                        {renderBengkelSection()}
                        {renderJasaAngkutSection()}
                        {renderMobilSection()}
                        {renderOverheadSection()}
                        {renderFinalRecap()}
                    </>
                )}
                </View>
            </ScrollView>

            <ReportExportSheet
                visible={showExportMenu}
                onClose={() => setShowExportMenu(false)}
                subtitle="Pilih metode ekspor dokumen PDF"
                onPreview={() => handleExportPDF('preview')}
                onPrint={() => handleExportPDF('print')}
                onDownload={() => handleExportPDF('download')}
            />

            {/* Preview Modal */}
            <Modal visible={showPdfPreview} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <Pressable onPress={() => setShowPdfPreview(false)} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"><X size={20} color="#1e293b" /></Pressable>
                        <Typography variant="body1" weight="bold" className="text-slate-900">Preview Laba Rugi</Typography>
                        <Pressable 
                            onPress={async () => {
                                if (Platform.OS === 'web') {
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        printWindow.document.write(previewHtml);
                                        printWindow.document.close();
                                        printWindow.print();
                                    }
                                } else {
                                    await Print.printAsync({ html: previewHtml });
                                }
                            }}
                            className="flex-row items-center px-4 py-2 rounded-xl shadow-sm"
                            style={{ backgroundColor: '#4f46e5' }}
                        >
                            <Download size={16} color="white" className="mr-2" />
                            <Typography variant="caption" weight="bold" className="text-white">CETAK</Typography>
                        </Pressable>
                    </View>
                    <View className="flex-1 bg-slate-100">
                        {Platform.OS === 'web' ? (
                            <iframe srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }} title="Laba Rugi Preview" />
                        ) : (
                            <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
