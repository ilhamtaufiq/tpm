import React, { useState } from 'react';
import { View, ScrollView, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { keuanganService } from '../../services/keuangan';
import { ActivityIndicator, Alert, Modal } from 'react-native';
import { Printer, Download, Eye, Share2, X } from 'lucide-react-native';
import { printReportHTML } from '../../utils/printReport';

import { formatCurrency } from '../../utils/format';

const ReportRow = ({ label, value, isNegative = false, isBold = false, isHeader = false, children }: any) => {
    return (
        <View className={`flex-row justify-between items-center py-2 ${isHeader ? 'border-b border-gray-100 mb-2 pb-2' : ''}`}>
            <View>
                <Typography variant={isHeader ? "h3" : "body2"} weight={isBold || isHeader ? "bold" : "normal"} className="text-text">
                    {label}
                </Typography>
                {children}
            </View>
            <Typography
                variant={isHeader ? "h3" : "body2"}
                weight={isBold || isHeader ? "bold" : "normal"}
                className={isNegative ? "text-error" : isHeader ? "text-primary" : "text-text"}
            >
                {isNegative ? `(${formatCurrency(value)})` : formatCurrency(value)}
            </Typography>
        </View>
    );
};

const SubItemRow = ({ label, value, isNegative = false }: any) => (
    <View className="flex-row justify-between items-center py-1 pl-4">
        <Typography variant="caption" className="text-textGray">
            {label}
        </Typography>
        <Typography variant="caption" className={isNegative ? "text-error" : "text-text/70"}>
            {isNegative ? `(${formatCurrency(value)})` : formatCurrency(value)}
        </Typography>
    </View>
);

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LabaRugiScreen() {
    const router = useRouter();
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
        if (filterType === 'daily') return format(date, 'dd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const getHeaderDate = () => {
        if (filterType === 'daily') return format(date, 'd MMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMM yyyy', { locale: localeID });
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

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-12 pb-10 px-6 rounded-b-[32px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-6">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/(tabs)/home');
                                }
                            }}
                            className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-3 border border-white/5"
                        >
                            <ChevronLeft size={22} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h3" weight="bold" className="text-white text-xl tracking-tighter">Laba Rugi</Typography>
                            <Typography className="text-white/50 text-[10px] mt-0.5">Analisa Finansial</Typography>
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        {/* Period Badge */}
                        <View className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/5 mr-2">
                            <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                {getHeaderDate()}
                            </Typography>
                        </View>
                        {/* Export Button */}
                        <Pressable
                            onPress={() => setShowExportMenu(true)}
                            disabled={isExporting}
                            className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center border border-white/5"
                        >
                            <Download size={20} color="white" />
                        </Pressable>
                    </View>
                </View>

                {/* Net Profit Insight Card (Glassmorphism) - Compact Version */}
                <View className="bg-white/10 p-5 rounded-[28px] border border-white/10 mb-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[9px] font-bold uppercase tracking-widest">Net Profit TPM</Typography>
                        </View>
                        <View className="flex-row items-center">
                            <TrendingUp size={12} color="#10B981" />
                            <Typography className="text-emerald-400 text-[9px] font-bold ml-1">LIVE</Typography>
                        </View>
                    </View>

                    <View className="flex-row items-end justify-between mb-4">
                        <View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold tracking-[1.5px] mb-0.5">Total Laba Bersih</Typography>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">
                                {formatCurrency(reportData?.laba_bersih || 0)}
                            </Typography>
                        </View>
                        <View className="items-end">
                            <Typography className="text-emerald-300 text-[11px] font-bold">{Math.round((reportData?.laba_bersih / (reportData?.bengkel_details?.total_penjualan || 1)) * 100)}% Margin</Typography>
                        </View>
                    </View>

                    <View className="flex-row justify-between pt-4 border-t border-white/10">
                        <View className="flex-1">
                            <Typography className="text-white/30 text-[8px] uppercase font-bold mb-0.5 tracking-widest">Laba Kotor</Typography>
                            <Typography weight="bold" className="text-white text-xs">{formatCurrency(reportData?.laba_kotor?.total || 0)}</Typography>
                        </View>
                        <View className="flex-1 items-end">
                            <Typography className="text-white/30 text-[8px] uppercase font-bold mb-0.5 tracking-widest">Unit Performance</Typography>
                            <Typography weight="bold" className="text-emerald-300 text-xs">Healthy</Typography>
                        </View>
                    </View>
                </View>

                {/* Date Filter Tabs (Floating in Header) */}
                <View className="flex-row bg-black/20 p-1 rounded-xl border border-white/5">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => {
                                setFilterType(type);
                                setDate(new Date());
                            }}
                            className={`flex-1 py-2 items-center rounded-lg ${filterType === type ? 'bg-primary shadow-lg border border-white/10' : ''}`}
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

            {/* Date Navigator Overlay */}
            <View className="px-6 -mt-6 z-10">
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

            {isLoading ? (
                <View className="flex-1 items-center justify-center p-12">
                    <ActivityIndicator size="large" color={themeColors.primary} />
                    <Typography className="mt-4 text-textGray font-bold uppercase text-[10px] tracking-widest">Mengolah Data Finansial...</Typography>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-6 pt-10"
                    showsVerticalScrollIndicator={false}
                >
                    {/* SECTION 1: BENGKEL */}
                    <View className="mb-8 bg-surface rounded-[32px] p-6 border border-gray-50 shadow-sm">
                        <View className="flex-row items-center mb-6 px-1">
                            <View className="w-1.5 h-6 bg-primary rounded-full mr-3" />
                            <Typography variant="h3" weight="bold" className="text-text tracking-tight">Unit Bengkel</Typography>
                        </View>

                        <View className="space-y-1">
                            <ReportRow label="1. Penjualan Sparepart & Jasa" value={bengkelData.penjualan}>
                                <SubItemRow label="Sparepart" value={reportData?.bengkel_details?.total_parts || 0} />
                                <SubItemRow label="Jasa" value={reportData?.bengkel_details?.total_jasa || 0} />
                                <SubItemRow label="Diskon" value={reportData?.bengkel_details?.total_diskon || 0} isNegative />
                            </ReportRow>
                            <ReportRow label="2. HPP Sparepart Terjual" value={bengkelData.hpp} isNegative />

                            <View className="h-[1px] bg-gray-50 my-4" />

                            <ReportRow label="3. Laba Kotor Bengkel" value={labaKotor} isBold isHeader />

                            <View className="bg-gray-50/50 rounded-2xl p-4 my-4 border border-gray-100/50">
                                <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-3">Beban Operasional</Typography>
                                <SubItemRow label="Biaya Operasional" value={bengkelData.biayaOps} isNegative />
                                <SubItemRow label="Biaya Gaji" value={bengkelData.biayaGaji} isNegative />
                                <SubItemRow label="Biaya Lembur" value={bengkelData.biayaLembur} isNegative />
                            </View>

                            <View className={`p-5 rounded-[24px] flex-row justify-between items-center ${labaBersih >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <View>
                                    <Typography variant="body2" weight="bold" className={labaBersih >= 0 ? "text-emerald-800" : "text-rose-800"}>4. Laba/Rugi Bersih</Typography>
                                    <Typography className={labaBersih >= 0 ? "text-emerald-600/60 text-[10px] font-bold uppercase tracking-tighter" : "text-rose-600/60 text-[10px] font-bold uppercase tracking-tighter"}>Unit Bengkel</Typography>
                                </View>
                                <Typography variant="h3" weight="bold" className={labaBersih >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatCurrency(labaBersih)}</Typography>
                            </View>
                        </View>
                    </View>

                    {/* SECTION 2: JASA ANGKUT */}
                    <View className="mb-8 bg-surface rounded-[32px] p-6 border border-gray-50 shadow-sm">
                        <View className="flex-row items-center mb-6 px-1">
                            <View className="w-1.5 h-6 bg-secondary rounded-full mr-3" />
                            <Typography variant="h3" weight="bold" className="text-text tracking-tight">Unit Jasa Angkut</Typography>
                        </View>

                        <View className="space-y-1">
                            <ReportRow label="1. Penghasilan Jasa (Gross TPM)" value={reportData?.jasa_angkut_details?.gross_share_tpm || 0} />
                            <ReportRow label="2. Biaya Lainnya (Muatan)" value={reportData?.jasa_angkut_details?.biaya_lainnya || 0} isNegative />
                            <ReportRow label="3. Biaya Sparepart & Servis" value={reportData?.jasa_angkut_details?.biaya_bengkel || 0} isNegative />
                            <ReportRow label="4. Biaya Operasional Umum" value={reportData?.pengeluaran_unit_details?.jasa_angkut || 0} isNegative />
                             
                             {reportData?.pengeluaran_unit_details?.jasa_angkut_armada && Object.keys(reportData.pengeluaran_unit_details.jasa_angkut_armada).length > 0 && (
                                 <View className="ml-4 border-l border-red-100 pl-2 mb-2">
                                     {Object.entries(reportData.pengeluaran_unit_details.jasa_angkut_armada).map(([name, val]) => (
                                         <SubItemRow 
                                             key={name}
                                             label={name} 
                                             value={val as number} 
                                             isNegative 
                                         />
                                     ))}
                                 </View>
                             )}

                            <View className="h-[1px] bg-gray-50 my-4" />

                            <View className={`p-5 rounded-[24px] flex-row justify-between items-center ${((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0)) >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <View>
                                    <Typography variant="body2" weight="bold" className={((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0)) >= 0 ? "text-emerald-800" : "text-rose-800"}>5. Laba/Rugi Bersih</Typography>
                                    <Typography className={((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0)) >= 0 ? "text-emerald-600/60 text-[10px] font-bold uppercase tracking-tighter" : "text-rose-600/60 text-[10px] font-bold uppercase tracking-tighter"}>Unit Jasa Angkut</Typography>
                                </View>
                                <Typography variant="h3" weight="bold" className={((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0)) >= 0 ? "text-emerald-700" : "text-rose-700"}>
                                    {formatCurrency((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0))}
                                </Typography>
                            </View>
                        </View>
                    </View>

                    {/* SECTION 3: JUAL BELI MOBIL */}
                    <View className="mb-8 bg-surface rounded-[32px] p-6 border border-gray-50 shadow-sm">
                        <View className="flex-row items-center mb-6 px-1">
                            <View className="w-1.5 h-6 bg-primary rounded-full mr-3 opacity-60" />
                            <Typography variant="h3" weight="bold" className="text-text tracking-tight">Unit Jual Beli Mobil</Typography>
                        </View>

                        <View className="space-y-1">
                            <ReportRow label="1. Total Penjualan (Gross)" value={reportData?.mobil_details?.total_penjualan || 0} />
                            <ReportRow label="2. Biaya Operasional Unit" value={reportData?.pengeluaran_unit_details?.mobil || 0} isNegative />
                            <ReportRow label="3. Laba Investor" value={reportData?.mobil_details?.laba_investor || 0} isNegative />
                            
                            {/* Credit/Receivable Info for Car Unit */}
                            <View className={`rounded-2xl p-4 my-3 border flex-row justify-between items-center ${(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? 'bg-amber-50 border-amber-100/50' : 'bg-gray-50 border-gray-100/50'}`}>
                                <View>
                                    <View className="flex-row items-center">
                                        <Typography className={(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? "text-amber-800 text-[9px] font-bold uppercase tracking-widest mr-2" : "text-gray-800/60 text-[9px] font-bold uppercase tracking-widest mr-2"}>4. Sisa Piutang (Belum Lunas)</Typography>
                                        {(reportData?.mobil_details?.piutang_nilai || 0) > 0 && <View className="bg-amber-500 w-1.5 h-1.5 rounded-full" />}
                                    </View>
                                    <Typography className={(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? "text-amber-600/70 text-[8px]" : "text-gray-400 text-[8px]"}>
                                        {(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? "Uang penjualan yang belum tertagih" : "Semua unit periode ini sudah lunas"}
                                    </Typography>
                                </View>
                                <Typography variant="body2" weight="bold" className={(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? "text-amber-700" : "text-gray-500"}>
                                    {formatCurrency(reportData?.mobil_details?.piutang_nilai || 0)}
                                </Typography>
                            </View>

                            <View className="h-[1px] bg-gray-50 my-4" />

                            <View className={`p-5 rounded-[24px] flex-row justify-between items-center ${((reportData?.mobil_details?.laba_tpm || 0) - (reportData?.pengeluaran_unit_details?.mobil || 0)) >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <View>
                                    <Typography variant="body2" weight="bold" className={((reportData?.mobil_details?.laba_tpm || 0) - (reportData?.pengeluaran_unit_details?.mobil || 0)) >= 0 ? "text-emerald-800" : "text-rose-800"}>5. Laba TPM (Net)</Typography>
                                    <Typography className={((reportData?.mobil_details?.laba_tpm || 0) - (reportData?.pengeluaran_unit_details?.mobil || 0)) >= 0 ? "text-emerald-600/60 text-[10px] font-bold uppercase tracking-tighter" : "text-rose-600/60 text-[10px] font-bold uppercase tracking-tighter"}>Unit Jual Beli Mobil</Typography>
                                </View>
                                <Typography variant="h3" weight="bold" className={((reportData?.mobil_details?.laba_tpm || 0) - (reportData?.pengeluaran_unit_details?.mobil || 0)) >= 0 ? "text-emerald-700" : "text-rose-700"}>
                                    {formatCurrency((reportData?.mobil_details?.laba_tpm || 0) - (reportData?.pengeluaran_unit_details?.mobil || 0))}
                                </Typography>
                            </View>
                        </View>
                    </View>

                    {/* SECTION 4: BIAYA OPERASIONAL UMUM */}
                    <View className="mb-8 bg-surface rounded-[32px] p-6 border border-gray-50 shadow-sm">
                        <View className="flex-row items-center mb-6 px-1">
                            <View className="w-1.5 h-6 bg-rose-500 rounded-full mr-3" />
                            <Typography variant="h3" weight="bold" className="text-text tracking-tight">Biaya Umum / Overhead</Typography>
                        </View>

                        <View className="space-y-1">
                            <ReportRow label="1. Biaya Operasional Umum" value={reportData?.pengeluaran_unit_details?.umum || 0} isNegative />
                            
                            <View className="bg-gray-50/50 rounded-2xl p-4 my-2 border border-gray-100/50">
                                <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-2">Info Pengeluaran</Typography>
                                <Typography variant="caption" className="text-textGray">Beban konsolidasi yang tidak dibebankan ke unit spesifik (Listrik, Air, Keamanan, Administrasi Kantor, dll).</Typography>
                            </View>

                            <View className="h-[1px] bg-gray-50 my-4" />

                            <View className="p-5 rounded-[24px] flex-row justify-between items-center bg-rose-50">
                                <View>
                                    <Typography variant="body2" weight="bold" className="text-rose-800">Total Biaya Umum</Typography>
                                    <Typography className="text-rose-600/60 text-[10px] font-bold uppercase tracking-tighter">Konsolidasi TPM</Typography>
                                </View>
                                <Typography variant="h3" weight="bold" className="text-rose-700">
                                    ({formatCurrency(reportData?.pengeluaran_unit_details?.umum || 0)})
                                </Typography>
                            </View>
                        </View>
                    </View>


                    {/* OTHER SECTIONS (Bento Small Grid) */}
                    <View className="flex-row flex-wrap justify-between mb-8">
                        {/* Pengeluaran Lainnya */}
                        <View className="w-full bg-surface p-6 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-rose-50 rounded-2xl items-center justify-center mr-4">
                                    <TrendingDown size={24} color="#EF4444" />
                                </View>
                                <View>
                                    <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-1">Beban Lainnya</Typography>
                                    <Typography variant="body1" weight="bold" className="text-rose-600">{formatCurrency(reportData?.pengeluaran_details?.biaya_lainnya?.total || 0)}</Typography>
                                </View>
                            </View>
                            <View className="bg-rose-50 px-3 py-1 rounded-lg">
                                <Typography weight="bold" className="text-rose-600 text-[10px] uppercase">Operasional</Typography>
                            </View>
                        </View>

                        {/* Prive */}
                        <View className="w-full bg-surface p-6 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-secondary/10 rounded-2xl items-center justify-center mr-4">
                                    <Wallet size={24} color={themeColors.secondary} />
                                </View>
                                <View>
                                    <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-1">Prive Pemilik</Typography>
                                    <Typography variant="body1" weight="bold" className="text-text">{formatCurrency(priveTotal)}</Typography>
                                </View>
                            </View>
                            <View className="bg-secondary/10 px-3 py-1 rounded-lg">
                                <Typography weight="bold" className="text-secondary text-[10px]">PENARIKAN</Typography>
                            </View>
                        </View>
                    </View>

                    {/* FINAL REKAP */}
                    <View className="bg-primary p-8 rounded-[40px] shadow-2xl shadow-primary/30 mb-10 overflow-hidden relative">
                        {/* Decorative Background Icon */}
                        <View className="absolute -right-10 -bottom-10 opacity-10">
                            <BarChart3 size={200} color="white" />
                        </View>

                        <Typography variant="h3" weight="bold" className="text-white mb-8 tracking-tighter text-xl">Rekapitulasi Final (TPM)</Typography>

                        <View className="space-y-4">
                            <View className="flex-row justify-between items-center">
                                <Typography className="text-white/60 text-xs">Profit Bersih Seluruh Unit</Typography>
                                <Typography weight="bold" className="text-white">{formatCurrency((reportData?.laba_bersih || 0) + priveTotal)}</Typography>
                            </View>

                            <View className="flex-row justify-between items-center">
                                <Typography className="text-white/60 text-xs">Prive Pemilik</Typography>
                                <Typography weight="bold" className="text-rose-300">({formatCurrency(priveTotal)})</Typography>
                            </View>

                            <View className="h-[1px] bg-white/10 my-4" />

                            <View>
                                <Typography weight="bold" className="text-white/40 text-[10px] uppercase tracking-[3px] mb-2">Profit Bersih Akhir</Typography>
                                <Typography variant="h1" weight="bold" className="text-white text-4xl tracking-tighter">
                                    {formatCurrency(reportData?.laba_bersih || 0)}
                                </Typography>
                            </View>
                        </View>
                    </View>

                    <View className="h-20" />
                </ScrollView>
            )}
        
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
                            <X size={20} color={themeColors.textGray} />
                        </Pressable>
                    </View>

                    <View className="flex-row gap-4">
                        <Pressable
                            onPress={async () => {
                                setShowExportMenu(false);
                                if (!reportData) return;
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
                                            <span>Biaya Gaji</span>
                                            <span class="text-error">(${formatCurrency(bengkelData.biayaGaji)})</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Biaya Lembur</span>
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
                                            <span>2. Biaya Lainnya (Muatan)</span>
                                            <span class="text-error">(${formatCurrency(reportData?.jasa_angkut_details?.biaya_lainnya || 0)})</span>
                                        </div>
                                        <div class="row-item">
                                            <span>3. Biaya Sparepart & Servis</span>
                                            <span class="text-error">(${formatCurrency(reportData?.jasa_angkut_details?.biaya_bengkel || 0)})</span>
                                        </div>
                                        <div class="row-item">
                                            <span>4. Biaya Operasional Umum</span>
                                            <span class="text-error">(${formatCurrency(reportData?.pengeluaran_unit_details?.jasa_angkut || 0)})</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>5. LABA BERSIH JASA ANGKUT</span>
                                            <span class="font-bold">${formatCurrency((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0))}</span>
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
                                        <div class="row-item">
                                            <span>3. Laba Investor</span>
                                            <span class="text-error">(${formatCurrency(reportData?.mobil_details?.laba_investor || 0)})</span>
                                        </div>
                                        <div class="row-item row-sub" style="color: ${(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? '#D97706' : '#6B7280'};">
                                            <span>4. Sisa Piutang (Belum Lunas)</span>
                                            <span>${formatCurrency(reportData?.mobil_details?.piutang_nilai || 0)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>5. LABA TPM (NET)</span>
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
                                // For now, download and preview use same logic through expo-print/sharing in printReportHTML
                                // which automatically handles sharing on mobile
                                if (!reportData) return;
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
                                            <span>Biaya Gaji</span>
                                            <span class="text-error">(${formatCurrency(bengkelData.biayaGaji)})</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Biaya Lembur</span>
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
                                            <span>2. Biaya Lainnya (Muatan)</span>
                                            <span class="text-error">(${formatCurrency(reportData?.jasa_angkut_details?.biaya_lainnya || 0)})</span>
                                        </div>
                                        <div class="row-item">
                                            <span>3. Biaya Sparepart & Servis</span>
                                            <span class="text-error">(${formatCurrency(reportData?.jasa_angkut_details?.biaya_bengkel || 0)})</span>
                                        </div>
                                        <div class="row-item">
                                            <span>4. Biaya Operasional Umum</span>
                                            <span class="text-error">(${formatCurrency(reportData?.pengeluaran_unit_details?.jasa_angkut || 0)})</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>5. LABA BERSIH JASA ANGKUT</span>
                                            <span class="font-bold">${formatCurrency((reportData?.laba_kotor?.jasa_angkut || 0) - (reportData?.pengeluaran_unit_details?.jasa_angkut || 0))}</span>
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
                                        <div class="row-item">
                                            <span>3. Laba Investor</span>
                                            <span class="text-error">(${formatCurrency(reportData?.mobil_details?.laba_investor || 0)})</span>
                                        </div>
                                        <div class="row-item row-sub" style="color: ${(reportData?.mobil_details?.piutang_nilai || 0) > 0 ? '#D97706' : '#6B7280'};">
                                            <span>4. Sisa Piutang (Belum Lunas)</span>
                                            <span>${formatCurrency(reportData?.mobil_details?.piutang_nilai || 0)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>5. LABA TPM (NET)</span>
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

