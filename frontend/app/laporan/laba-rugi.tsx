import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { keuanganService } from '../../services/keuangan';
import { ActivityIndicator } from 'react-native';

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
        biayaOps: (
            (reportData?.pengeluaran_details?.operasional?.total || 0) +
            (reportData?.pengeluaran_details?.pemeliharaan?.total || 0) +
            (reportData?.pengeluaran_details?.utilitas?.total || 0) +
            (reportData?.pengeluaran_details?.lainnya?.total || 0) +
            (reportData?.pengeluaran_details?.biaya_operasional?.total || 0) +
            (reportData?.pengeluaran_details?.biaya_lainnya?.total || 0)
        ),
        biayaGaji: reportData?.pengeluaran_details?.gaji?.total || 0,
    };

    const priveTotal = reportData?.pengeluaran_details?.prive?.total || 0;

    const labaKotor = bengkelData.penjualan - bengkelData.hpp;
    const totalBiaya = bengkelData.biayaOps + bengkelData.biayaGaji;
    const labaBersih = labaKotor - totalBiaya;

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/(tabs)/home');
                                }
                            }}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Laba Rugi</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Analisa Performa Finansial</Typography>
                        </View>
                    </View>

                    {/* Period Badge */}
                    <View className="bg-white/10 px-4 py-2 rounded-2xl border border-white/5">
                        <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[10px]">
                            {getHeaderDate()}
                        </Typography>
                    </View>
                </View>

                {/* Net Profit Insight Card (Glassmorphism) */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10 mb-8">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Net Profit TPM</Typography>
                        </View>
                        <View className="flex-row items-center">
                            <TrendingUp size={14} color="#10B981" />
                            <Typography className="text-emerald-400 text-[10px] font-bold ml-1">LIVE REPORT</Typography>
                        </View>
                    </View>

                    <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-[2px] mb-1">Total Laba Bersih</Typography>
                    <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter mb-6">
                        {formatCurrency(reportData?.laba_bersih || 0)}
                    </Typography>

                    <View className="flex-row justify-between pt-5 border-t border-white/10">
                        <View className="flex-1">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Laba Kotor</Typography>
                            <Typography weight="bold" className="text-white text-sm">{formatCurrency(reportData?.laba_kotor?.total || 0)}</Typography>
                        </View>
                        <View className="flex-1 items-end">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Beban</Typography>
                            <Typography weight="bold" className="text-red-300 text-sm">({formatCurrency(reportData?.pengeluaran || 0)})</Typography>
                        </View>
                    </View>
                </View>

                {/* Date Filter Tabs (Floating in Header) */}
                <View className="flex-row bg-black/20 p-1.5 rounded-2xl border border-white/5">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <TouchableOpacity
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
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Date Navigator Overlay */}
            <View className="px-6 -mt-6 z-10">
                <View className="bg-surface p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                    <TouchableOpacity
                        onPress={handlePrev}
                        className="w-12 h-12 bg-background rounded-2xl items-center justify-center border border-gray-100"
                        activeOpacity={0.7}
                    >
                        <ChevronLeft size={20} color={themeColors.text} />
                    </TouchableOpacity>

                    <View className="flex-1 flex-row items-center justify-center">
                        <Calendar size={18} color={themeColors.primary} className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-text capitalize tracking-tight">
                            {getFormattedDate()}
                        </Typography>
                    </View>

                    <TouchableOpacity
                        onPress={handleNext}
                        className="w-12 h-12 bg-background rounded-2xl items-center justify-center border border-gray-100"
                        activeOpacity={0.7}
                    >
                        <ChevronRight size={20} color={themeColors.text} />
                    </TouchableOpacity>
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
                                <View className="h-[1px] bg-gray-100/50 my-3" />
                                <View className="flex-row justify-between items-center pl-4">
                                    <Typography variant="caption" weight="bold" className="text-textGray">Total Beban</Typography>
                                    <Typography variant="caption" weight="bold" className="text-rose-600">({formatCurrency(totalBiaya)})</Typography>
                                </View>
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
                            <ReportRow label="2. Biaya Lainnya" value={reportData?.jasa_angkut_details?.biaya_lainnya || 0} isNegative />
                            <ReportRow label="3. Biaya Sparepart & Servis" value={reportData?.jasa_angkut_details?.biaya_bengkel || 0} isNegative />

                            <View className="h-[1px] bg-gray-50 my-4" />

                            <View className={`p-5 rounded-[24px] flex-row justify-between items-center ${(reportData?.laba_kotor?.jasa_angkut || 0) >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <View>
                                    <Typography variant="body2" weight="bold" className={(reportData?.laba_kotor?.jasa_angkut || 0) >= 0 ? "text-emerald-800" : "text-rose-800"}>4. Laba/Rugi Bersih</Typography>
                                    <Typography className={(reportData?.laba_kotor?.jasa_angkut || 0) >= 0 ? "text-emerald-600/60 text-[10px] font-bold uppercase tracking-tighter" : "text-rose-600/60 text-[10px] font-bold uppercase tracking-tighter"}>Unit Jasa Angkut</Typography>
                                </View>
                                <Typography variant="h3" weight="bold" className={(reportData?.laba_kotor?.jasa_angkut || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}>
                                    {formatCurrency(reportData?.laba_kotor?.jasa_angkut || 0)}
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
                            <ReportRow label="1. Laba Kotor Terjual" value={reportData?.mobil_details?.total_laba_kotor || 0} />
                            <ReportRow label="2. Laba Investor" value={reportData?.mobil_details?.laba_investor || 0} isNegative />

                            <View className="h-[1px] bg-gray-50 my-4" />

                            <View className={`p-5 rounded-[24px] flex-row justify-between items-center ${(reportData?.mobil_details?.laba_tpm || 0) >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <View>
                                    <Typography variant="body2" weight="bold" className={(reportData?.mobil_details?.laba_tpm || 0) >= 0 ? "text-emerald-800" : "text-rose-800"}>3. Laba TPM (Net)</Typography>
                                    <Typography className={(reportData?.mobil_details?.laba_tpm || 0) >= 0 ? "text-emerald-600/60 text-[10px] font-bold uppercase tracking-tighter" : "text-rose-600/60 text-[10px] font-bold uppercase tracking-tighter"}>Unit Jual Beli Mobil</Typography>
                                </View>
                                <Typography variant="h3" weight="bold" className={(reportData?.mobil_details?.laba_tpm || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}>
                                    {formatCurrency(reportData?.mobil_details?.laba_tpm || 0)}
                                </Typography>
                            </View>
                        </View>
                    </View>

                    {/* OTHER SECTIONS (Bento Small Grid) */}
                    <View className="flex-row flex-wrap justify-between mb-8">
                        {/* Pemasukkan Lainnya */}
                        <View className="w-[48%] bg-surface p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm">
                            <View className="w-10 h-10 bg-teal-50 rounded-2xl items-center justify-center mb-4">
                                <ArrowUpRight size={20} color="#14B8A6" />
                            </View>
                            <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-1">Pemasukkan DP</Typography>
                            <Typography variant="body1" weight="bold" className="text-teal-600">{formatCurrency(reportData?.mobil_details?.total_dp || 0)}</Typography>
                        </View>

                        {/* Pengeluaran Lainnya */}
                        <View className="w-[48%] bg-surface p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm">
                            <View className="w-10 h-10 bg-rose-50 rounded-2xl items-center justify-center mb-4">
                                <TrendingDown size={20} color="#EF4444" />
                            </View>
                            <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-1">Beban Lainnya</Typography>
                            <Typography variant="body1" weight="bold" className="text-rose-600">{formatCurrency(reportData?.pengeluaran_details?.biaya_lainnya?.total || 0)}</Typography>
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
                                <Typography className="text-white/60 text-xs">Total Laba Kotor Unit</Typography>
                                <Typography weight="bold" className="text-white">{formatCurrency(reportData?.laba_kotor?.total || 0)}</Typography>
                            </View>
                            <View className="flex-row justify-between items-center">
                                <Typography className="text-white/60 text-xs">Total Beban Bisnis</Typography>
                                <Typography weight="bold" className="text-rose-300">({formatCurrency((reportData?.pengeluaran || 0) - priveTotal)})</Typography>
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
        </View>
    );
}

