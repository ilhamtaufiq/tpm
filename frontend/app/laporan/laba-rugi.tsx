import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownLeft, DollarSign, Download, Eye, Share2, X, Truck } from 'lucide-react-native';
import { useRouter, useFocusEffect, useNavigation, Stack } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { keuanganService } from '../../services/keuangan';
import { Alert, Modal } from 'react-native';
import { printReportHTML } from '../../utils/printReport';
import { formatCurrency } from '../../utils/format';
import { useLabaRugiReport } from '../../hooks/useKeuangan';
import { Card } from '../../components/ui/Card';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LabaRugiScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const { themeColors } = useUIStore();

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

    const getFormattedDate = () => {
        if (filterType === 'daily') return format(date, 'd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const getHeaderDate = () => {
        if (filterType === 'daily') return format(date, 'dd MMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const { data: reportData, isLoading, refetch: fetchData } = useLabaRugiReport({
        tanggal_dari: format(filterType === 'daily' ? date : (filterType === 'monthly' ? startOfMonth(date) : startOfYear(date)), 'yyyy-MM-dd'),
        tanggal_sampai: format(filterType === 'daily' ? date : (filterType === 'monthly' ? endOfMonth(date) : endOfYear(date)), 'yyyy-MM-dd')
    });

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [date, filterType])
    );

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    // Bengkel Data Mapping (New Schema)
    const bengkelUnit = reportData?.units?.bengkel || {};
    const bengkelData = {
        penjualan: reportData?.bengkel_details?.total_subtotal || (bengkelUnit.revenue + (reportData?.bengkel_details?.total_diskon || 0)),
        hpp: bengkelUnit.hpp || 0,
        biayaOps: bengkelUnit.beban_operasional || 0,
        biayaGaji: bengkelUnit.beban_gaji || 0,
        biayaLembur: 0, // Now integrated in beban_gaji or separate in backend if needed
        laba_kotor: bengkelUnit.laba_kotor || 0,
        laba_bersih: bengkelUnit.laba_bersih || 0
    };

    const priveTotal = reportData?.summary?.prive || 0;
    const labaBersihTotal = reportData?.summary?.laba_bersih || 0;

    const handleExportPDF = async (mode: 'preview' | 'download' = 'preview') => {
        if (!reportData) return;
        setIsExporting(true);
        try {
            const html = `
                <div class="section-header" style="background: #2563eb; color: white;">UNIT BENGKEL</div>
                <div class="row-item">
                    <span>I. PENDAPATAN OPERASIONAL</span>
                    <span>${formatCurrency(reportData?.units?.bengkel?.revenue || 0)}</span>
                </div>
                <div class="row-item">
                    <span>II. BEBAN POKOK PENJUALAN (HPP)</span>
                    <span class="text-error">(${formatCurrency(reportData?.units?.bengkel?.hpp || 0)})</span>
                </div>
                <div class="row-item row-total" style="background: #f8fafc;">
                    <span>III. LABA KOTOR BENGKEL</span>
                    <span class="font-bold">${formatCurrency(reportData?.units?.bengkel?.laba_kotor || 0)}</span>
                </div>
                <div class="row-item" style="margin-top: 10px;">
                    <span>IV. BEBAN OPERASIONAL UNIT</span>
                    <span class="text-error">(${formatCurrency((reportData?.units?.bengkel?.beban_operasional || 0) + (reportData?.units?.bengkel?.beban_gaji || 0))})</span>
                </div>
                <div class="row-item row-total" style="background: #f0fdf4; border-top: 2px solid #16a34a;">
                    <span>V. LABA BERSIH BENGKEL</span>
                    <span class="font-bold">${formatCurrency(reportData?.units?.bengkel?.laba_bersih || 0)}</span>
                </div>

                <div class="section-header" style="background: #059669; color: white;">UNIT JASA ANGKUT</div>
                <div class="row-item">
                    <span>I. PENDAPATAN JASA (BAGIAN TPM)</span>
                    <span>${formatCurrency(reportData?.units?.jasa_angkut?.revenue || 0)}</span>
                </div>
                <div class="row-item">
                    <span>II. BIAYA DIRECT (ARMADA & MAINTENANCE)</span>
                    <span class="text-error">(${formatCurrency((reportData?.units?.jasa_angkut?.beban_operasional || 0) + (reportData?.units?.jasa_angkut?.maintenance || 0))})</span>
                </div>
                <div class="row-item">
                    <span>III. BEBAN UMUM UNIT</span>
                    <span class="text-error">(${formatCurrency(reportData?.units?.jasa_angkut?.beban_umum || 0)})</span>
                </div>
                <div class="row-item row-total" style="background: #f0fdf4; border-top: 2px solid #059669;">
                    <span>IV. LABA BERSIH JASA ANGKUT</span>
                    <span class="font-bold">${formatCurrency(reportData?.units?.jasa_angkut?.laba_bersih || 0)}</span>
                </div>

                <div class="section-header" style="background: #f59e0b; color: white;">UNIT JUAL BELI MOBIL</div>
                <div class="row-item">
                    <span>I. PENDAPATAN JUAL BELI</span>
                    <span>${formatCurrency(reportData?.units?.mobil?.revenue || 0)}</span>
                </div>
                <div class="row-item">
                    <span>II. BEBAN POKOK MOBIL (HPP)</span>
                    <span class="text-error">(${formatCurrency(reportData?.units?.mobil?.hpp || 0)})</span>
                </div>
                <div class="row-item">
                    <span>III. BIAYA PERSIAPAN (PAJAK, BBN, DLL)</span>
                    <span class="text-error">(${formatCurrency(reportData?.units?.mobil?.beban_operasional || 0)})</span>
                </div>
                <div class="row-item">
                    <span>IV. BAGI HASIL INVESTOR</span>
                    <span class="text-error">(${formatCurrency(reportData?.units?.mobil?.sharing_investor || 0)})</span>
                </div>
                <div class="row-item row-total" style="background: #fefce8;">
                    <span>V. LABA BERSIH MOBIL (TPM)</span>
                    <span class="font-bold">${formatCurrency(reportData?.units?.mobil?.laba_bersih || 0)}</span>
                </div>

                <div class="section-header" style="background: #334155; color: white;">BIAYA UMUM & PRIVE</div>
                <div class="row-item">
                    <span>Biaya Operasional Pusat</span>
                    <span class="text-error">(${formatCurrency(reportData?.summary?.total_beban_umum || 0)})</span>
                </div>
                <div class="row-item">
                    <span>Penarikan Prive Pemilik</span>
                    <span class="text-error">(${formatCurrency(reportData?.summary?.prive || 0)})</span>
                </div>

                <div style="margin-top:40px; padding:25px; background:#0f172a; border-radius:15px; color: white;">
                    <div style="font-size:18px; font-weight:bold; margin-bottom:15px; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 10px;">REKAPITULASI AKHIR</div>
                    <div class="row-item" style="border:none; color: #cbd5e1;">
                        <span>Total Laba Bersih Operasional</span>
                        <span>${formatCurrency(reportData?.summary?.laba_operasional || 0)}</span>
                    </div>
                    <div class="row-item" style="border:none; color: #cbd5e1; margin-bottom: 15px;">
                        <span>Prive Pemilik</span>
                        <span style="color: #fca5a5;">(${formatCurrency(reportData?.summary?.prive || 0)})</span>
                    </div>
                    <div class="row-item row-total" style="font-size:24px; color: #ffffff; border-top: 2px solid white; padding-top: 15px;">
                        <span>PROFIT BERSIH AKHIR</span>
                        <span class="font-bold">${formatCurrency(reportData?.summary?.laba_bersih || 0)}</span>
                    </div>
                </div>
            `;

            if (mode === 'preview') {
                await printReportHTML(html, {
                    title: 'Laporan Laba Rugi',
                    dateRange: getFormattedDate()
                });
            } else {
                const fullHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="utf-8"></head>
                    <body>${html}</body>
                    </html>
                `;

                if (Platform.OS === 'web') {
                    const { uri } = await Print.printToFileAsync({ html: fullHtml });
                    const link = document.createElement('a');
                    link.href = uri;
                    link.download = `Laporan_Laba_Rugi_${format(new Date(), 'yyyyMMdd')}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    const { uri } = await Print.printToFileAsync({ html: fullHtml });
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(uri, {
                            mimeType: 'application/pdf',
                            dialogTitle: 'Laporan Laba Rugi',
                            UTI: 'com.adobe.pdf'
                        });
                    }
                }
            }
        } catch (e) {
            Alert.alert('Error', 'Gagal memproses dokumen PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const renderHeader = () => (
        <>
            {/* Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl z-20">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Laba Rugi</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Analisa Finansial TPM</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <View className="bg-white/10 px-4 py-2 rounded-2xl border border-white/5 mr-2">
                            <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[10px]">
                                {getHeaderDate()}
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => setShowExportMenu(true)}
                            disabled={isExporting}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            {isExporting ? <ActivityIndicator size="small" color="white" /> : <Download size={22} color="white" />}
                        </Pressable>
                    </View>
                </View>

                {/* Filter Tabs */}
                <View className="flex-row bg-black/20 p-1.5 rounded-2xl border border-white/5">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => {
                                setFilterType(type);
                                setDate(new Date());
                            }}
                            className={`flex-1 py-2.5 items-center rounded-xl ${filterType === type ? 'bg-primary shadow-lg border border-white/10' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight="bold"
                                className={filterType === type ? 'text-white' : 'text-white/40'}
                            >
                                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </Typography>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Date Navigator */}
            <View className="px-6 -mt-6 z-30">
                <View className="bg-surface p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                    <Pressable
                        onPress={handlePrev}
                        className="w-12 h-12 bg-background rounded-2xl items-center justify-center border border-gray-100"
                    >
                        <ChevronLeft size={20} color={themeColors.text} />
                    </Pressable>

                    <View className="flex-1 flex-row items-center justify-center">
                        <Calendar size={18} color={themeColors.primary} className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-text capitalize tracking-tight">
                            {getFormattedDate()}
                        </Typography>
                    </View>

                    <Pressable
                        onPress={handleNext}
                        className="w-12 h-12 bg-background rounded-2xl items-center justify-center border border-gray-100"
                    >
                        <ChevronRight size={20} color={themeColors.text} />
                    </Pressable>
                </View>
            </View>
        </>
    );

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
                {/* 1. PENDAPATAN */}
                <View className="mb-4 w-full">
                    <Typography variant="caption" weight="bold" className="text-blue-600 mb-2 uppercase tracking-widest text-[10px]">I. Pendapatan Operasional</Typography>
                    <Row label="Penjualan Sparepart & Jasa" value={bengkelData.penjualan} bold large color="text-slate-800" />
                    <Row label=" - Penjualan Sparepart (Retail)" value={reportData?.bengkel_details?.total_parts || 0} small indent />
                    <Row label=" - Jasa Servis" value={reportData?.bengkel_details?.total_jasa || 0} small indent />
                    <Row label=" - Diskon Penjualan" value={reportData?.bengkel_details?.total_diskon || 0} small indent isNegative color="text-rose-500" />
                </View>

                {/* 2. HPP */}
                <View className="bg-slate-50/80 p-3 rounded-xl mb-4 border border-slate-100">
                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">II. Beban Pokok Penjualan (HPP)</Typography>
                    <Row label="HPP Sparepart Terjual" value={bengkelData.hpp} isNegative color="text-rose-600" />
                </View>

                {/* 3. LABA KOTOR */}
                <View className="bg-blue-50/50 w-full p-4 rounded-xl border border-blue-100/60 mb-5">
                    <Row label="Laba Kotor Bengkel" value={bengkelData.laba_kotor} bold large color="text-blue-800" />
                </View>

                {/* 4. BEBAN OPERASIONAL */}
                <View className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 w-full mb-4">
                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">III. Beban Operasional Unit</Typography>
                    <Row label="Beban Gaji Karyawan" value={bengkelData.biayaGaji} isNegative />
                    <Row label="Beban Lembur" value={bengkelData.biayaLembur} isNegative />
                    <Row label="Beban Operasional Unit" value={bengkelData.biayaOps} isNegative />
                </View>

                {/* FINAL PROFIT */}
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
        const unit = reportData?.units?.jasa_angkut || {};
        const revenue = unit.revenue || 0;
        const maintenance = unit.maintenance || 0;
        const directOps = unit.beban_operasional || 0;
        const generalOps = unit.beban_umum || 0;
        const netProfit = unit.laba_bersih || 0;

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
                    <Row label="Pendapatan Jasa (Kotor Unit)" value={revenue} bold large color="text-slate-800" />
                    <View className="bg-slate-50/50 rounded-lg p-2 mt-1 mb-4 border border-slate-100">
                        <Typography variant="caption" className="text-slate-400 italic text-[10px] px-1 text-center">Bagian TPM sebelum dikurangi biaya operasional trip</Typography>
                    </View>


                    <View className="bg-slate-50/80 p-3 rounded-xl mb-4 border border-slate-100">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">II. Biaya Armada & Maintenance</Typography>
                        <Row label="Pemeliharaan (Bengkel)" value={maintenance} isNegative color="text-rose-600" />
                        <Row label="Operasional (BBM, Tol, dll)" value={directOps} isNegative color="text-rose-600" />
                    </View>

                    <View className="p-1 px-3 mb-4">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-1 uppercase tracking-widest text-[10px]">III. Biaya Umum Unit</Typography>
                        <Row label="Beban Umum Jasa Angkut" value={generalOps} isNegative />
                    </View>

                    <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                        <View>
                            <Typography variant="body2" weight="bold" className="text-white">IV. Laba Bersih Unit</Typography>
                            <Typography variant="caption" className="text-white/60 uppercase tracking-tighter text-[10px] mt-0.5">Final Profit Share</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className="text-white">
                            {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit))})` : formatCurrency(netProfit)}
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderMobilSection = () => {
        const unit = reportData?.units?.mobil || {};
        const revenue = unit.revenue || 0;
        const hpp = unit.hpp || 0;
        const maintenance = unit.maintenance || 0;
        const directOps = unit.beban_operasional || 0;
        const generalOps = unit.beban_umum || 0;
        const netProfit = unit.laba_bersih || 0;

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
                    <Row label="Total Penjualan Unit (Gross)" value={revenue} bold large color="text-slate-800" />

                    <View className="bg-slate-50/80 p-3 rounded-xl mb-4 mt-4 border border-slate-100">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">II. Beban Pokok Penjualan (HPP)</Typography>
                        <Row label="Harga Beli Unit" value={hpp} isNegative color="text-rose-600" />
                        <Row label="Biaya Persiapan (Pajak, BBN, dll)" value={directOps} isNegative color="text-rose-600" />
                        <Row label="Biaya Perbaikan (Workshop)" value={maintenance} isNegative color="text-rose-600" />
                    </View>

                    <View className="p-1 px-3 mb-4">
                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-2 uppercase tracking-widest text-[10px]">III. Beban Umum Unit</Typography>
                        <Row label="Bagi Hasil Investor" value={unit.sharing_investor || 0} isNegative color="text-rose-600" />
                        <Row label="Beban Umum & Operasional" value={generalOps} isNegative />
                    </View>

                    <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                        <View>
                            <Typography variant="body2" weight="bold" className="text-white">IV. Laba Bersih TPM</Typography>
                            <Typography variant="caption" className="text-white/60 uppercase tracking-tighter text-[10px] mt-0.5">Setelah Biaya & Share</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className="text-white">
                            {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit))})` : formatCurrency(netProfit)}
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
                <Row label="Total Beban Umum & Lainnya" value={reportData?.summary?.total_beban_umum || 0} isNegative bold large color="text-slate-800" />

                <View className="bg-slate-50 rounded-xl p-3 mt-3 w-full border border-slate-100 italic">
                    <Typography variant="caption" className="text-slate-500 leading-snug text-[11px]">
                        *Beban administrasi pusat dan biaya lainnya yang tidak dialokasikan ke unit bisnis spesifik.
                    </Typography>
                </View>
            </View>
        </Card>
    );

    const renderSubFooterSection = () => (
        <View className="flex-row flex-wrap justify-between w-full mb-4">
            {/* Beban Lainnya */}
            {/* <Card className="w-full bg-white p-5 rounded-2xl mb-4 border border-slate-100 shadow-sm shadow-slate-200/50 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-rose-50 rounded-xl items-center justify-center mr-3 border border-rose-100/50">
                        <TrendingDown size={20} className="text-rose-500" />
                    </View>
                    <View>
                        <Typography variant="caption" weight="bold" className="text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Beban Lainnya</Typography>
                        <Typography variant="h4" weight="bold" className="text-rose-600">{formatCurrency(reportData?.pengeluaran_details?.biaya_lainnya?.total || 0)}</Typography>
                    </View>
                </View>
                <View className="bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md">
                    <Typography weight="bold" className="text-rose-600 text-[10px] uppercase tracking-wide">Minus</Typography>
                </View>
            </Card> */}

            {/* Prive */}
            <Card className="w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mr-3 border border-blue-100/50">
                        <Wallet size={20} className="text-blue-500" />
                    </View>
                    <View>
                        <Typography variant="caption" weight="bold" className="text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">Prive Pemilik</Typography>
                        <Typography variant="h4" weight="bold" className="text-slate-700">{formatCurrency(priveTotal)}</Typography>
                    </View>
                </View>
                <View className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                    <Typography weight="bold" className="text-slate-600 text-[10px] uppercase tracking-wide">Tarik</Typography>
                </View>
            </Card>
        </View>
    );

    const renderFinalRecap = () => {
        const finalProfit = reportData?.summary?.laba_bersih || 0;
        const totalProfitBeforePrive = reportData?.summary?.laba_operasional || 0;

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
                    <Row label="Total Laba Operasional Seluruh Unit" value={totalProfitBeforePrive} isDark large />
                    <View className="h-[1px] bg-white/10 w-full my-3" />
                    <Row label="Beban Prive (Penarikan Modal Pemilik)" value={priveTotal} isNegative isDark color="text-rose-400" />
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

                <Typography variant="caption" className="text-indigo-500/60 text-center mt-6 uppercase tracking-widest text-[8px]">
                    Laporan ini dihasilkan secara otomatis dan bersifat final
                </Typography>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {renderHeader()}

            <ScrollView
                className="flex-1 px-4 pt-5"
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={fetchData} />}
                showsVerticalScrollIndicator={false}
            >
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
                        {renderSubFooterSection()}
                        {renderFinalRecap()}
                    </>
                )}
            </ScrollView>

            <Modal
                visible={showExportMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExportMenu(false)}
            >
                <Pressable
                    className="flex-1 bg-slate-900/40 justify-end backdrop-blur-sm"
                    onPress={() => setShowExportMenu(false)}
                >
                    <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-6 w-full">
                            <View>
                                <Typography variant="h3" weight="bold" className="text-slate-800">Ekspor Laporan</Typography>
                                <Typography variant="caption" className="text-slate-500">Pilih metode ekspor PDF</Typography>
                            </View>
                            <Pressable onPress={() => setShowExportMenu(false)} className="bg-slate-100 p-2.5 rounded-full active:bg-slate-200">
                                <X size={20} className="text-slate-600" />
                            </Pressable>
                        </View>

                        <View className="flex-row gap-4 w-full">
                            <Pressable
                                onPress={() => {
                                    setShowExportMenu(false);
                                    setTimeout(() => handleExportPDF('preview'), 100);
                                }}
                                className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200 items-center active:bg-slate-50"
                            >
                                <View className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl items-center justify-center mb-3">
                                    <Eye size={28} className="text-blue-600" />
                                </View>
                                <Typography weight="bold" className="text-slate-700">Tampilkan</Typography>
                                <Typography variant="caption" className="text-slate-500 text-center mt-1">Pratinjau PDF</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setShowExportMenu(false);
                                    setTimeout(() => handleExportPDF('download'), 100);
                                }}
                                className="flex-1 bg-primary p-5 rounded-2xl shadow-md shadow-primary/30 items-center active:bg-primary-dark"
                            >
                                <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center mb-3">
                                    <Download size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-white">Download</Typography>
                                <Typography variant="caption" className="text-primary-100 text-center mt-1">Simpan File</Typography>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// Helper Row Component
const Row = ({
    label,
    value,
    bold,
    small,
    large,
    color,
    isNegative,
    isDark,
    className,
    indent
}: {
    label: string,
    value: number,
    bold?: boolean,
    small?: boolean,
    large?: boolean,
    color?: string,
    isNegative?: boolean,
    isDark?: boolean,
    className?: string,
    indent?: boolean,
}) => (
    <View className={`flex-row justify-between items-center py-[2px] w-full ${indent ? 'pl-4' : ''} ${className || ''}`}>
        <Typography
            variant={small ? 'caption' : 'body2'}
            className={`${isDark ? 'text-white/70' : small ? 'text-slate-500' : 'text-slate-600'} flex-1 pr-2`}
        >
            {label}
        </Typography>
        <Typography
            variant={large ? 'h3' : small ? 'body2' : 'body1'}
            weight={bold ? 'bold' : 'semibold'}
            className={`${color || (isDark ? 'text-white' : 'text-slate-800')} text-right flex-shrink-0`}
        >
            {isNegative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value || 0)}
        </Typography>
    </View>
);
