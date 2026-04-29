import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownLeft, DollarSign, Download, Eye, Share2, X, Truck, Printer } from 'lucide-react-native';
import { useRouter, useFocusEffect, useNavigation, Stack } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { keuanganService } from '../../services/keuangan';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { Modal, Alert, Platform } from 'react-native';
import { formatCurrency } from '../../utils/format';
import { useLabaRugiReport } from '../../hooks/useKeuangan';
import { Card } from '../../components/ui/Card';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LabaRugiScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
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

    const buildLabaRugiExportHtml = () => {
        if (!reportData) return '';

        const getHeaderDate = () => {
            if (filterType === 'daily') return format(date, 'd MMMM yyyy', { locale: localeID });
            if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
            return format(date, 'yyyy', { locale: localeID });
        };

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <style>
                    body { font-family: 'Helvetica', sans-serif; font-size: 10.5px; color: #1e293b; padding: 40px 35px; line-height: 1.4; background-color: #fff; }
                    .header { text-align: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 20px; margin-bottom: 25px; }
                    .title { font-size: 20px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
                    .subtitle { font-size: 13px; color: #4f46e5; font-weight: 600; margin-bottom: 3px; }
                    .date { font-size: 11px; color: #64748b; }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                    
                    .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11.5px; }
                    .section-title { background-color: #f8fafc; font-weight: 800; color: #4f46e5; text-transform: uppercase; font-size: 10.5px; letter-spacing: 1.5px; border-top: 1.5px solid #e2e8f0; }
                    .unit-header { background-color: #4f46e5; color: #ffffff; font-weight: 800; padding: 12px 10px; font-size: 11px; }
                    .total-row { font-weight: 800; background-color: #f1f5f9; color: #1e293b; border-top: 2px solid #cbd5e1; }
                    .grand-total { font-weight: 800; background-color: #1e293b; color: #ffffff; font-size: 13px; }
                    
                    .sub-item { color: #64748b; padding-left: 25px; font-size: 9.5px; font-style: italic; }
                    .negative { color: #e11d48; }
                    .positive { color: #059669; }
                    
                    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #f1f5f9; font-size: 9px; color: #94a3b8; text-align: center; font-style: italic; }
                    
                    .recap-box { border-radius: 12px; padding: 20px; background-color: #0f172a; color: #ffffff; margin-top: 30px; }
                    .recap-title { font-weight: 900; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">Laporan Laba Rugi</div>
                    <div class="subtitle">BENGKEL TPM - ANALISA FINANSIAL</div>
                    <div class="date">Periode: ${getFormattedDate()}</div>
                </div>

                <table>
                    <!-- UNIT BENGKEL -->
                    <tr class="unit-header"><td colspan="2">UNIT BENGKEL & SPAREPART</td></tr>
                    <tr class="section-title"><td colspan="2">I. PENDAPATAN</td></tr>
                    <tr><td>Penjualan Sparepart (Retail)</td><td class="amount">${formatCurrency(reportData?.bengkel_details?.total_parts || 0)}</td></tr>
                    <tr><td>Jasa Servis & Bengkel</td><td class="amount">${formatCurrency(reportData?.bengkel_details?.total_jasa || 0)}</td></tr>
                    <tr><td>Diskon Penjualan</td><td class="amount negative">(${formatCurrency(reportData?.bengkel_details?.total_diskon || 0)})</td></tr>
                    <tr class="total-row"><td>TOTAL PENDAPATAN BENGKEL</td><td class="amount">${formatCurrency(reportData?.units?.bengkel?.revenue || 0)}</td></tr>

                    <tr class="section-title"><td colspan="2">II. BEBAN POKOK (HPP)</td></tr>
                    <tr><td>HPP Sparepart Terjual</td><td class="amount negative">(${formatCurrency(reportData?.units?.bengkel?.hpp || 0)})</td></tr>
                    <tr class="total-row"><td>LABA KOTOR BENGKEL</td><td class="amount">${formatCurrency(reportData?.units?.bengkel?.laba_kotor || 0)}</td></tr>

                    <tr class="section-title"><td colspan="2">III. BEBAN OPERASIONAL UNIT</td></tr>
                    <tr><td>Beban Gaji & Lembur</td><td class="amount negative">(${formatCurrency(reportData?.units?.bengkel?.beban_gaji || 0)})</td></tr>
                    <tr><td>Beban Operasional Bengkel</td><td class="amount negative">(${formatCurrency(reportData?.units?.bengkel?.beban_operasional || 0)})</td></tr>
                    <tr class="total-row" style="background-color: #f0fdf4;"><td>LABA BERSIH BENGKEL</td><td class="amount positive">${formatCurrency(reportData?.units?.bengkel?.laba_bersih || 0)}</td></tr>

                    <tr style="height: 25px;"></tr>

                    <!-- UNIT JASA ANGKUT -->
                    <tr class="unit-header" style="background-color: #059669;"><td colspan="2">UNIT JASA ANGKUT (LOGISTIC)</td></tr>
                    <tr class="section-title"><td colspan="2">I. PENDAPATAN JASA</td></tr>
                    <tr><td>Total Pendapatan Jasa (Gross)</td><td class="amount">${formatCurrency(reportData?.units?.jasa_angkut?.revenue || 0)}</td></tr>

                    <tr class="section-title"><td colspan="2">II. BIAYA ARMADA & MAINTENANCE</td></tr>
                    <tr><td>Biaya Operasional Trip (BBM, Tol, dll)</td><td class="amount negative">(${formatCurrency(reportData?.units?.jasa_angkut?.beban_operasional || 0)})</td></tr>
                    <tr><td>Biaya Perbaikan & Maintenance</td><td class="amount negative">(${formatCurrency(reportData?.units?.jasa_angkut?.maintenance || 0)})</td></tr>
                    
                    <tr class="section-title"><td colspan="2">III. BEBAN UMUM UNIT</td></tr>
                    <tr><td>Beban Umum Jasa Angkut</td><td class="amount negative">(${formatCurrency(reportData?.units?.jasa_angkut?.beban_umum || 0)})</td></tr>
                    <tr class="total-row" style="background-color: #f0fdf4;"><td>LABA BERSIH JASA ANGKUT</td><td class="amount positive">${formatCurrency(reportData?.units?.jasa_angkut?.laba_bersih || 0)}</td></tr>

                    <tr style="height: 25px;"></tr>

                    <!-- UNIT MOBIL -->
                    <tr class="unit-header" style="background-color: #d97706;"><td colspan="2">UNIT JUAL BELI MOBIL</td></tr>
                    <tr class="section-title"><td colspan="2">I. PENDAPATAN JUAL BELI</td></tr>
                    <tr><td>Total Penjualan Unit Mobil</td><td class="amount">${formatCurrency(reportData?.units?.mobil?.revenue || 0)}</td></tr>

                    <tr class="section-title"><td colspan="2">II. BEBAN POKOK (HPP)</td></tr>
                    <tr><td>Harga Beli Unit Mobil</td><td class="amount negative">(${formatCurrency(reportData?.units?.mobil?.hpp || 0)})</td></tr>
                    <tr><td>Biaya Persiapan (Pajak, BBN, dll)</td><td class="amount negative">(${formatCurrency(reportData?.units?.mobil?.beban_operasional || 0)})</td></tr>
                    <tr><td>Biaya Perbaikan (Workshop)</td><td class="amount negative">(${formatCurrency(reportData?.units?.mobil?.maintenance || 0)})</td></tr>

                    <tr class="section-title"><td colspan="2">III. BAGI HASIL & UMUM</td></tr>
                    <tr><td>Bagi Hasil Investor (Sharing)</td><td class="amount negative">(${formatCurrency(reportData?.units?.mobil?.sharing_investor || 0)})</td></tr>
                    <tr><td>Beban Umum Unit Mobil</td><td class="amount negative">(${formatCurrency(reportData?.units?.mobil?.beban_umum || 0)})</td></tr>
                    <tr class="total-row" style="background-color: #f0fdf4;"><td>LABA BERSIH MOBIL (TPM)</td><td class="amount positive">${formatCurrency(reportData?.units?.mobil?.laba_bersih || 0)}</td></tr>
                </table>

                <div class="recap-box">
                    <div class="recap-title">REKAPITULASI FINANSIAL</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Total Laba Operasional Seluruh Unit</span>
                        <span class="amount">${formatCurrency(reportData?.summary?.laba_operasional || 0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Beban Umum & Operasional Pusat</span>
                        <span class="amount negative">(${formatCurrency(reportData?.summary?.total_beban_umum || 0)})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>Pengambilan Prive Pemilik</span>
                        <span class="amount negative">(${formatCurrency(reportData?.summary?.prive || 0)})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 900;">
                        <span>LABA BERSIH AKHIR (TPM)</span>
                        <span class="amount" style="color: #4ade80;">${formatCurrency(reportData?.summary?.laba_bersih || 0)}</span>
                    </div>
                </div>

                <div class="footer">
                    Laporan Laba Rugi TPM Finance System<br/>
                    Dicetak pada ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeID })}
                </div>
            </body>
            </html>
        `;
    };

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!reportData) return;
        setIsExporting(true);
        try {
            const html = buildLabaRugiExportHtml();
            
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
                    link.download = `LabaRugi_${getFormattedDate().replace(/ /g, '_')}.pdf`;
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

            <Modal visible={showExportMenu} transparent animationType="fade">
                <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setShowExportMenu(false)}>
                    <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-8">
                            <View>
                                <Typography variant="h3" weight="bold">Ekspor Laporan</Typography>
                                <Typography variant="caption" className="text-gray-500">Pilih metode ekspor dokumen PDF</Typography>
                            </View>
                            <Pressable onPress={() => setShowExportMenu(false)} className="bg-slate-100 p-2 rounded-full">
                                <X size={20} color="#64748b" />
                            </Pressable>
                        </View>

                        <View className="flex-row gap-4">
                            <Pressable
                                onPress={() => handleExportPDF('preview')}
                                className="flex-1 bg-indigo-50 p-6 rounded-[32px] border border-indigo-100 items-center"
                            >
                                <View className="w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-indigo-200">
                                    <Eye size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-indigo-900">Preview</Typography>
                                <Typography variant="caption" className="text-indigo-600/70 text-center mt-1">Lihat & Cek</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => handleExportPDF('print')}
                                className="flex-1 bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 items-center"
                            >
                                <View className="w-14 h-14 bg-emerald-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-emerald-200">
                                    <Printer size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-emerald-900">Cetak</Typography>
                                <Typography variant="caption" className="text-emerald-600/70 text-center mt-1">Print Langsung</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => handleExportPDF('download')}
                                className="flex-1 bg-amber-50 p-6 rounded-[32px] border border-amber-100 items-center"
                            >
                                <View className="w-14 h-14 bg-amber-500 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-amber-200">
                                    <Download size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-amber-900">PDF</Typography>
                                <Typography variant="caption" className="text-amber-600/70 text-center mt-1">Simpan File</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* FULL SCREEN PDF PREVIEW MODAL */}
            <Modal visible={showPdfPreview} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <Pressable 
                            onPress={() => setShowPdfPreview(false)}
                            className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
                        >
                            <X size={20} color="#1e293b" />
                        </Pressable>
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
                            <iframe 
                                srcDoc={previewHtml} 
                                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }} 
                                title="Laba Rugi Preview"
                            />
                        ) : (
                            <WebView 
                                originWhitelist={['*']}
                                source={{ html: previewHtml }}
                                style={{ flex: 1 }}
                            />
                        )}
                    </View>
                </SafeAreaView>
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
