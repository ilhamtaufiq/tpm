import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownLeft, DollarSign, Download, Eye, Share2, X } from 'lucide-react-native';
import { useRouter, useFocusEffect, useNavigation, Stack } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { keuanganService } from '../../services/keuangan';
import { Alert, Modal } from 'react-native';
import { printReportHTML } from '../../utils/printReport';
import { formatCurrency } from '../../utils/format';
import { Card } from '../../components/ui/Card';

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

    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

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

            const data = await keuanganService.getProfitSummary({
                tanggal_dari: dari,
                tanggal_sampai: sampai
            });
            setReportData(data);
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

    // Bengkel Data Mapping
    const bengkelData = {
        penjualan: reportData?.bengkel_details?.total_penjualan || 0,
        hpp: reportData?.bengkel_details?.total_hpp || 0,
        biayaOps: reportData?.pengeluaran_unit_details?.bengkel || 0,
        biayaGaji: reportData?.pengeluaran_details?.gaji?.total_gaji_pokok || 0,
        biayaLembur: reportData?.pengeluaran_details?.gaji?.total_uang_lembur || 0,
    };

    const priveTotal = reportData?.pengeluaran_details?.prive?.total || 0;

    const labaKotor = bengkelData.penjualan - bengkelData.hpp;
    const totalBiaya = bengkelData.biayaOps + bengkelData.biayaGaji + bengkelData.biayaLembur - (reportData?.pengeluaran_details?.gaji?.total_potongan_kasbon || 0);
    const labaBersih = labaKotor - totalBiaya;

    const handleExportPDF = async (mode: 'preview' | 'download' = 'preview') => {
        if (!reportData) return;
        setIsExporting(true);
        try {
            const html = `
                <div class="section-header">UNIT BENGKEL</div>
                <div class="row-item">
                    <span>1. Penjualan Sparepart & Jasa</span>
                    <span>${formatCurrency(bengkelData.penjualan)}</span>
                </div>
                <div class="row-item row-sub">
                    <span>Sparepart</span>
                    <span>${formatCurrency(reportData?.bengkel_details?.total_parts || 0)}</span>
                </div>
                <div class="row-item row-sub">
                    <span>Jasa</span>
                    <span>${formatCurrency(reportData?.bengkel_details?.total_jasa || 0)}</span>
                </div>
                <div class="row-item row-sub">
                    <span>Diskon</span>
                    <span class="text-error">(${formatCurrency(reportData?.bengkel_details?.total_diskon || 0)})</span>
                </div>
                <div class="row-item">
                    <span>2. HPP Sparepart Terjual</span>
                    <span class="text-error">(${formatCurrency(bengkelData.hpp)})</span>
                </div>
                <div class="row-item row-total">
                    <span>3. LABA KOTOR BENGKEL</span>
                    <span class="font-bold">${formatCurrency(labaKotor)}</span>
                </div>
                <div class="row-item" style="margin-top: 10px;">
                    <span>Biaya Operasional</span>
                    <span class="text-error">(${formatCurrency(bengkelData.biayaOps)})</span>
                </div>
                <div class="row-item">
                    <span>Beban Gaji</span>
                    <span class="text-error">(${formatCurrency(bengkelData.biayaGaji)})</span>
                </div>
                <div class="row-item">
                    <span>Beban Lembur</span>
                    <span class="text-error">(${formatCurrency(bengkelData.biayaLembur)})</span>
                </div>
                <div class="row-item row-total">
                    <span>4. LABA BERSIH BENGKEL</span>
                    <span class="font-bold">${formatCurrency(labaBersih)}</span>
                </div>

                <div class="section-header">UNIT JASA ANGKUT</div>
                <div class="row-item">
                    <span>1. Penghasilan Jasa (Gross TPM)</span>
                    <span>${formatCurrency(reportData?.jasa_angkut_details?.gross_share_tpm || 0)}</span>
                </div>
                <div class="row-item">
                    <span>2. Biaya Sparepart & Servis</span>
                    <span class="text-error">(${formatCurrency(reportData?.jasa_angkut_details?.biaya_bengkel || 0)})</span>
                </div>
                ${reportData?.jasa_angkut_details?.bengkel_per_armada && Object.keys(reportData.jasa_angkut_details.bengkel_per_armada).length > 0 ? `
                    <div style="padding-left: 20px; font-size: 10px; color: #6B7280; margin-bottom: 5px;">
                        ${Object.entries(reportData.jasa_angkut_details.bengkel_per_armada).map(([name, val]) => `
                            <div class="row-item" style="border:none; padding:2px 0;">
                                <span>- ${name}</span>
                                <span class="text-error">(${formatCurrency(val as number)})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="row-item">
                    <span>3. Biaya Operasional Umum</span>
                    <span class="text-error">(${formatCurrency(reportData?.pengeluaran_unit_details?.jasa_angkut || 0)})</span>
                </div>
                <div class="row-item row-total">
                    <span>4. LABA BERSIH JASA ANGKUT</span>
                    <span class="font-bold">${formatCurrency((reportData?.jasa_angkut_details?.gross_share_tpm || 0) - (reportData?.jasa_angkut_details?.biaya_lainnya || 0) - (reportData?.jasa_angkut_details?.biaya_bengkel || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0))}</span>
                </div>

                <div class="section-header">UNIT JUAL BELI MOBIL</div>
                <div class="row-item">
                    <span>1. Total Penjualan (Gross)</span>
                    <span>${formatCurrency(reportData?.mobil_details?.total_penjualan || 0)}</span>
                </div>
                <div class="row-item">
                    <span>2. Biaya Operasional Unit</span>
                    <span class="text-error">(${formatCurrency(reportData?.pengeluaran_unit_details?.mobil || 0)})</span>
                </div>
                ${reportData?.pengeluaran_unit_details?.mobil_unit && Object.keys(reportData.pengeluaran_unit_details.mobil_unit).length > 0 ? `
                    <div style="padding-left: 20px; font-size: 10px; color: #6B7280; margin-bottom: 5px;">
                        ${Object.entries(reportData.pengeluaran_unit_details.mobil_unit).map(([name, val]) => `
                            <div class="row-item" style="border:none; padding:2px 0;">
                                <span>- ${name}</span>
                                <span class="text-error">(${formatCurrency(val as number)})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="row-item">
                    <span>3. Biaya Sparepart & Servis</span>
                    <span class="text-error">(${formatCurrency(reportData?.mobil_details?.biaya_bengkel || 0)})</span>
                </div>
                ${reportData?.mobil_details?.bengkel_per_mobil && Object.keys(reportData.mobil_details.bengkel_per_mobil).length > 0 ? `
                    <div style="padding-left: 20px; font-size: 10px; color: #6B7280; margin-bottom: 5px;">
                        ${Object.entries(reportData.mobil_details.bengkel_per_mobil).map(([name, val]) => `
                            <div class="row-item" style="border:none; padding:2px 0;">
                                <span>- ${name}</span>
                                <span class="text-error">(${formatCurrency(val as number)})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="row-item">
                    <span>4. Laba Investor</span>
                    <span class="text-error">(${formatCurrency(reportData?.mobil_details?.laba_investor || 0)})</span>
                </div>
                <div class="row-item row-sub" style="color: ${(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? '#D97706' : '#6B7280'};">
                    <span>5. Sisa Piutang (Belum Lunas)</span>
                    <span>${formatCurrency(reportData?.mobil_details?.piutang_nilai || 0)}</span>
                </div>
                <div class="row-item row-total">
                    <span>6. LABA TPM (NET)</span>
                    <span class="font-bold">${formatCurrency((reportData?.mobil_details?.laba_tpm || 0) - (reportData?.pengeluaran_unit_details?.mobil || 0))}</span>
                </div>

                <div class="section-header">BIAYA OPERASIONAL UMUM</div>
                <div class="row-item">
                    <span>1. Biaya Operasional Umum (Overhead)</span>
                    <span class="text-error">(${formatCurrency(reportData?.pengeluaran_unit_details?.umum || 0)})</span>
                </div>
                <div class="row-item row-total">
                    <span>TOTAL BIAYA UMUM</span>
                    <span class="font-bold">(${formatCurrency(reportData?.pengeluaran_unit_details?.umum || 0)})</span>
                </div>

                <div class="section-header">BEBAN & PRIVE</div>

                <div class="row-item">
                    <span>Beban Lainnya</span>
                    <span class="text-error">(${formatCurrency(reportData?.pengeluaran_details?.biaya_lainnya?.total || 0)})</span>
                </div>
                <div class="row-item">
                    <span>Prive Pemilik</span>
                    <span class="text-error">(${formatCurrency(priveTotal)})</span>
                </div>

                <div style="margin-top:30px; padding:20px; background:#f0f7ff; border-radius:10px; border: 2px solid #023C69;">
                    <div style="font-size:16px; font-weight:bold; margin-bottom:10px;">RINGKASAN AKHIR</div>
                    <div class="row-item">
                        <span>Total Laba Bersih Unit (Sebelum Prive)</span>
                        <span>${formatCurrency((reportData?.laba_bersih || 0) + priveTotal)}</span>
                    </div>

                    <div class="row-item">
                        <span>Prive Pemilik</span>
                        <span class="text-error">(${formatCurrency(priveTotal)})</span>
                    </div>
                    <div class="row-item row-total" style="font-size:18px; color:#023C69;">
                        <span>PROFIT BERSIH AKHIR</span>
                        <span>${formatCurrency(reportData?.laba_bersih || 0)}</span>
                    </div>
                </div>
            `;

            await printReportHTML(html, {
                title: 'Laporan Laba Rugi',
                dateRange: getFormattedDate()
            });
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
            <View className="bg-blue-50/70 px-5 py-4 flex-row items-center border-b border-blue-100/50 w-full">
                <View className="w-8 h-8 rounded-full bg-blue-100/80 items-center justify-center mr-3">
                    <ArrowUpRight size={18} className="text-blue-600" />
                </View>
                <Typography variant="h4" weight="bold" className="text-blue-900 tracking-tight">Unit Bengkel</Typography>
            </View>

            <View className="p-5 w-full">
                <View className="mb-4 w-full">
                    <Row label="1. Penjualan Sparepart & Jasa" value={bengkelData.penjualan} bold large />
                    <Row label="Sparepart" value={reportData?.bengkel_details?.total_parts || 0} small indent />
                    <Row label="Jasa" value={reportData?.bengkel_details?.total_jasa || 0} small indent />
                    <Row label="Diskon" value={reportData?.bengkel_details?.total_diskon || 0} small indent isNegative />
                </View>

                <View className="h-[1px] bg-slate-100 w-full my-3" />
                <Row label="2. HPP Sparepart Terjual" value={bengkelData.hpp} bold large isNegative />

                <View className="bg-blue-50/50 w-full p-4 rounded-xl border border-blue-100 mt-4 mb-4">
                    <Row label="3. Laba Kotor Bengkel" value={labaKotor} bold large color="text-blue-700" />
                </View>

                <View className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full mb-4">
                    <Typography variant="caption" weight="bold" className="text-slate-400 mb-2 uppercase tracking-wider">Beban Operasional</Typography>
                    <Row label="Biaya Operasional" value={bengkelData.biayaOps} small isNegative />
                    <Row label="Beban Gaji" value={bengkelData.biayaGaji} small isNegative />
                    <Row label="Beban Lembur" value={bengkelData.biayaLembur} small isNegative />
                </View>

                <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${labaBersih >= 0 ? 'bg-emerald-50 border-emerald-100/50' : 'bg-rose-50 border-rose-100/50'}`}>
                    <View>
                        <Typography variant="body2" weight="bold" className={labaBersih >= 0 ? "text-emerald-800" : "text-rose-800"}>4. Laba/Rugi Bersih</Typography>
                        <Typography variant="caption" className={labaBersih >= 0 ? "text-emerald-600/70 uppercase tracking-tighter text-[10px] mt-0.5" : "text-rose-600/70 uppercase tracking-tighter text-[10px] mt-0.5"}>Unit Bengkel</Typography>
                    </View>
                    <Typography variant="h3" weight="bold" className={labaBersih >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {labaBersih < 0 ? `(${formatCurrency(Math.abs(labaBersih))})` : formatCurrency(labaBersih)}
                    </Typography>
                </View>
            </View>
        </Card>
    );

    const renderJasaAngkutSection = () => {
        const grossJasaAngkut = (reportData?.jasa_angkut_details?.gross_share_tpm || 0); // Already represents (Revenue - Driver Share)

        // Use consolidated armada costs from backend (includes Maintenance + BBM/Tol/Parkir)
        const armadaOps = reportData?.jasa_angkut_details?.armada_period_ops || 0;
        const generalOps = reportData?.pengeluaran_unit_details?.jasa_angkut || 0;

        const netJasaAngkut = grossJasaAngkut - (reportData?.jasa_angkut_details?.biaya_bengkel || 0) - armadaOps - generalOps;

        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-emerald-50/70 px-5 py-4 flex-row items-center border-b border-emerald-100/50 w-full">
                    <View className="w-8 h-8 rounded-full bg-emerald-100/80 items-center justify-center mr-3">
                        <ArrowUpRight size={18} className="text-emerald-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-emerald-900 tracking-tight">Unit Jasa Angkut</Typography>
                </View>

                <View className="p-5 w-full">
                    <Row label="1. Penghasilan Jasa (Bagian TPM)" value={grossJasaAngkut} bold large />

                    <Row label="2. Biaya Sparepart & Servis" value={reportData?.jasa_angkut_details?.biaya_bengkel || 0} isNegative />

                    <Row label="3. Biaya Operasional Armada" value={armadaOps} bold large isNegative />
                    <Typography variant="caption" className="text-slate-400 ml-4 mb-2 -mt-1">(BBM, Tol, Parkir, & Umum)</Typography>

                    <Row label="4. Biaya Umum Unit" value={generalOps} isNegative />

                    <View className="h-[1px] bg-slate-100 w-full my-4" />

                    <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${netJasaAngkut >= 0 ? 'bg-emerald-50 border-emerald-100/50' : 'bg-rose-50 border-rose-100/50'}`}>
                        <View>
                            <Typography variant="body2" weight="bold" className={netJasaAngkut >= 0 ? "text-emerald-800" : "text-rose-800"}>5. Laba/Rugi Bersih</Typography>
                            <Typography variant="caption" className={netJasaAngkut >= 0 ? "text-emerald-600/70 uppercase tracking-tighter text-[10px] mt-0.5" : "text-rose-600/70 uppercase tracking-tighter text-[10px] mt-0.5"}>Unit Jasa Angkut</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className={netJasaAngkut >= 0 ? "text-emerald-700" : "text-rose-700"}>
                            {netJasaAngkut < 0 ? `(${formatCurrency(Math.abs(netJasaAngkut))})` : formatCurrency(netJasaAngkut)}
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderMobilSection = () => {
        const totalPenjualan = reportData?.mobil_details?.total_penjualan || 0;

        // Modal Dasar = Total Modal from sales (HPP) + Capital expenditures made this period for ANY car
        const modalDasar = (reportData?.mobil_details?.total_modal || 0) + (reportData?.mobil_details?.capital_period_ops || 0);
        const biayaPerbaikan = reportData?.mobil_details?.biaya_bengkel || 0; // Spareparts & Service
        const labaKotorUnit = totalPenjualan - modalDasar - biayaPerbaikan;

        const labaInvestor = reportData?.mobil_details?.laba_investor || 0;
        const labaKotorTPM = totalPenjualan - modalDasar - biayaPerbaikan - labaInvestor;

        const operasionalBisnis = reportData?.pengeluaran_unit_details?.mobil || 0;
        const netMobil = labaKotorTPM - operasionalBisnis;

        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-amber-50/70 px-5 py-4 flex-row items-center border-b border-amber-100/50 w-full">
                    <View className="w-8 h-8 rounded-full bg-amber-100/80 items-center justify-center mr-3">
                        <ArrowUpRight size={18} className="text-amber-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-amber-900 tracking-tight">Unit Jual Beli Mobil</Typography>
                </View>

                <View className="p-5 w-full">
                    <Row label="1. Total Penjualan Unit" value={totalPenjualan} bold large />

                    <View className="bg-slate-50/50 p-3 rounded-xl mb-3 border border-slate-100">
                        <Row label="2. Manajemen Biaya Unit" value={modalDasar} isNegative />
                        <Typography variant="caption" className="text-slate-400 ml-4 mb-2 -mt-1">(Pajak, BBN, dll)</Typography>

                        <Row label="3. Biaya Perbaikan Unit" value={biayaPerbaikan} isNegative />
                        <Typography variant="caption" className="text-slate-400 ml-4 -mt-1">(Sparepart & Servis Bengkel)</Typography>
                    </View>

                    <Row label="4. Laba Kotor Unit" value={labaKotorUnit} bold />
                    <Row label="5. Bagian Laba Investor" value={labaInvestor} isNegative />

                    <View className="h-[1px] bg-slate-100 w-full my-3" />

                    <Row label="6. Laba Kotor TPM" value={labaKotorTPM} bold />
                    <Row label="7. Biaya Operasional Bisnis" value={operasionalBisnis} isNegative />
                    <Typography variant="caption" className="text-slate-400 ml-4 mb-2 -mt-1">(Umum: Listrik, Admin, Sewa, dll)</Typography>

                    <View className={`w-full rounded-xl p-3 my-3 border flex-row justify-between items-center ${(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? 'bg-amber-50/50 border-amber-200/60' : 'bg-slate-50 border-slate-100/50'}`}>
                        <View className="flex-1 pr-2">
                            <View className="flex-row items-center">
                                <Typography variant="caption" weight="bold" className={(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? "text-amber-800 tracking-wide uppercase text-[10px] mr-2" : "text-slate-500 tracking-wide uppercase text-[10px] mr-2"}>Sisa Piutang Unit</Typography>
                                {(reportData?.mobil_details?.piutang_nilai || 0) > 0 && <View className="bg-amber-500 w-1.5 h-1.5 rounded-full" />}
                            </View>
                        </View>
                        <Typography variant="body2" weight="bold" className={(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? "text-amber-700 flex-shrink-0" : "text-slate-400 flex-shrink-0"}>
                            {formatCurrency(reportData?.mobil_details?.piutang_nilai || 0)}
                        </Typography>
                    </View>

                    <View className="h-[1px] bg-slate-100 w-full my-4" />

                    <View className={`w-full p-4 rounded-xl border flex-row justify-between items-center ${netMobil >= 0 ? 'bg-emerald-50 border-emerald-100/50' : 'bg-rose-50 border-rose-100/50'}`}>
                        <View>
                            <Typography variant="body2" weight="bold" className={netMobil >= 0 ? "text-emerald-800" : "text-rose-800"}>8. Laba Bersih TPM</Typography>
                            <Typography variant="caption" className={netMobil >= 0 ? "text-emerald-600/70 uppercase tracking-tighter text-[10px] mt-0.5" : "text-rose-600/70 uppercase tracking-tighter text-[10px] mt-0.5"}>Unit Jual Beli Mobil</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className={netMobil >= 0 ? "text-emerald-700" : "text-rose-700"}>
                            {netMobil < 0 ? `(${formatCurrency(Math.abs(netMobil))})` : formatCurrency(netMobil)}
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderOverheadSection = () => (
        <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
            <View className="bg-rose-50/70 px-5 py-4 flex-row items-center border-b border-rose-100/50 w-full">
                <View className="w-8 h-8 rounded-full bg-rose-100/80 items-center justify-center mr-3">
                    <ArrowDownLeft size={18} className="text-rose-600" />
                </View>
                <Typography variant="h4" weight="bold" className="text-rose-900 tracking-tight">Biaya Umum & Overhead</Typography>
            </View>

            <View className="p-5 w-full">
                <Row label="1. Operasional Umum (Listrik, Admin, dll)" value={reportData?.pengeluaran_unit_details?.umum || 0} isNegative bold large />

                <View className="bg-slate-50 rounded-xl p-3 mt-3 w-full border border-slate-100">
                    <Typography variant="caption" className="text-slate-500 leading-snug">
                        Pengeluaran yang ditarik dari kas utama dan tidak membebani unit/bisnis tertentu secara langsung.
                    </Typography>
                </View>
            </View>
        </Card>
    );

    const renderSubFooterSection = () => (
        <View className="flex-row flex-wrap justify-between w-full mb-4">
            {/* Beban Lainnya */}
            <Card className="w-full bg-white p-5 rounded-2xl mb-4 border border-slate-100 shadow-sm shadow-slate-200/50 flex-row items-center justify-between">
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
            </Card>

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
        const finalProfit = reportData?.laba_bersih || 0;

        return (
            <Card className="bg-indigo-900 p-6 rounded-[32px] shadow-lg shadow-indigo-900/30 mb-10 overflow-hidden relative w-full border border-indigo-800">
                <View className="absolute -right-8 -bottom-8 opacity-10">
                    <BarChart3 size={160} color="white" />
                </View>

                <View className="flex-row items-center mb-6">
                    <View className="bg-indigo-500/30 px-3 py-1.5 rounded-lg border border-indigo-500/30 flex-row items-center">
                        <TrendingUp size={14} className="text-indigo-200 mr-1.5" />
                        <Typography weight="bold" className="text-indigo-200 uppercase tracking-widest text-[10px]">Rekap Final</Typography>
                    </View>
                </View>

                <View className="mb-6 w-full">
                    <Row label="Profit Bersih Seluruh Unit (Seblm Prive)" value={finalProfit + priveTotal} isDark />
                    <Row label="Opsi: Penarikan Prive" value={priveTotal} isNegative isDark color="text-rose-300" />
                </View>

                <View className="w-full bg-indigo-800/60 p-4 rounded-xl border border-indigo-700">
                    <Typography variant="caption" weight="bold" className="text-indigo-300 uppercase tracking-[2px] mb-1">PROFIT BERSIH AKHIR</Typography>
                    <Typography variant="h1" weight="bold" className="text-white tracking-tighter">
                        {finalProfit < 0 ? `(${formatCurrency(Math.abs(finalProfit))})` : formatCurrency(finalProfit)}
                    </Typography>
                </View>
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
