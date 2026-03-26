import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import {
    ChevronLeft, ChevronRight, Calendar, Wallet, Building2,
    Car, CreditCard, Landmark, TrendingUp, ArrowUpRight,
    ArrowDownLeft, DollarSign, Scale, CheckCircle, AlertTriangle, Banknote, Package, Box, 
    Printer, Download, Eye, Share2, X
} from 'lucide-react-native';
import { Modal } from 'react-native';
import { printReportHTML } from '../../utils/printReport';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';
import { useNeracaReport } from '../../hooks/useKeuangan';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function NeracaScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const { themeColors } = useUIStore();

    // Date Navigation
    const handlePrev = () => {
        if (filterType === 'daily') setDate(subDays(date, 1));
        else if (filterType === 'monthly') setDate(subMonths(date, 1));
        else setDate(subYears(date, 1));
    };

    const handleNext = () => {
        if (filterType === 'daily') setDate(addDays(date, 1));
        else if (filterType === 'monthly') setDate(addMonths(date, 1));
        else setDate(addYears(date, 1));
    };

    const getFormattedDate = () => {
        if (filterType === 'daily') return format(date, 'd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const getHeaderDate = () => {
        if (filterType === 'daily') return format(date, 'd MMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const getDateParams = () => {
        let start = date;
        let end = date;
        if (filterType === 'monthly') {
            start = startOfMonth(date);
            end = endOfMonth(date);
        } else if (filterType === 'yearly') {
            start = startOfYear(date);
            end = endOfYear(date);
        }
        return {
            tanggal_dari: format(start, 'yyyy-MM-dd'),
            tanggal_sampai: format(end, 'yyyy-MM-dd'),
        };
    };

    const { data: report, isLoading, refetch } = useNeracaReport(getDateParams());

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    };

    // Helper Row Component
    const Row = ({ label, value, bold, small, large, color, isNegative, isDark }: {
        label: string;
        value: number;
        bold?: boolean;
        small?: boolean;
        large?: boolean;
        color?: string;
        isNegative?: boolean;
        isDark?: boolean;
    }) => (
        <View className="flex-row justify-between items-center py-1.5 px-1">
            <Typography
                variant={small ? 'caption' : 'body2'}
                weight={bold ? 'bold' : 'normal'}
                className={`${isDark ? 'text-white/60' : small ? 'text-textGray' : 'text-text'} flex-1 mr-2`}
            >
                {label}
            </Typography>
            <Typography
                variant={large ? 'h3' : small ? 'caption' : 'body2'}
                weight={bold ? 'bold' : 'medium'}
                className={
                    isNegative ? 'text-rose-600' :
                        color ? color :
                            isDark ? 'text-white' : 'text-text'
                }
            >
                {isNegative ? `(${formatCurrency(Math.abs(value || 0))})` : formatCurrency(value || 0)}
            </Typography>
        </View>
    );

    // ==========================================
    // RENDER SECTIONS
    // ==========================================

    const renderAktivaLancar = () => {
        const data = report?.aktiva_lancar || {};
        return (
            <Card className="mb-5 p-5">
                <View className="flex-row items-center mb-5">
                    <View className="w-9 h-9 rounded-2xl bg-emerald-100 items-center justify-center mr-3">
                        <Banknote size={18} color="#059669" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-text">Aktiva Lancar</Typography>
                        <Typography variant="caption" className="text-textGray">Current Assets</Typography>
                    </View>
                    <View className="bg-emerald-50 px-3 py-1 rounded-xl">
                        <Typography variant="caption" weight="bold" className="text-emerald-700">
                            {formatCurrency(data.total_aktiva_lancar || 0)}
                        </Typography>
                    </View>
                </View>

                {/* Kas & Bank */}
                <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                        <View className="w-1 h-4 bg-emerald-500 rounded-full mr-2" />
                        <Typography variant="caption" weight="bold" className="text-emerald-700 uppercase tracking-widest text-[10px]">
                            Kas & Bank
                        </Typography>
                    </View>
                    <View className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/50">
                        <Row label="Kas Tunai" value={data.kas_tunai} small />
                        <Row label="Kas Bank" value={data.kas_bank} small />
                        <View className="h-[1px] bg-emerald-200/50 my-1.5" />
                        <Row label="Total Kas & Bank" value={data.total_kas_bank} bold />
                    </View>
                </View>

                {/* Piutang */}
                <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                        <View className="w-1 h-4 bg-blue-500 rounded-full mr-2" />
                        <Typography variant="caption" weight="bold" className="text-blue-700 uppercase tracking-widest text-[10px]">
                            Piutang Usaha
                        </Typography>
                    </View>
                    <View className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100/50">
                        <Row label="Piutang Lainnya" value={data.piutang_lainnya} small />
                        <Row label="Piutang Jual Beli Mobil" value={data.piutang_mobil} small />
                        <Row label="Piutang Part Jual Mobil" value={data.piutang_part_mobil} small />
                        <Row label="Piutang Jasa Angkut" value={data.piutang_jasa_angkut} small />
                        <Row label="Piutang Karyawan (Kasbon)" value={data.piutang_karyawan} small />
                        <Row label="Piutang Usaha" value={data.piutang_usaha} small />
                        <View className="h-[1px] bg-blue-200/50 my-1.5" />
                        <Row label="Total Piutang" value={data.total_piutang} bold />
                    </View>
                </View>

                {/* Persediaan */}
                <View>
                    <View className="flex-row items-center mb-2">
                        <View className="w-1 h-4 bg-amber-500 rounded-full mr-2" />
                        <Typography variant="caption" weight="bold" className="text-amber-700 uppercase tracking-widest text-[10px]">
                            Persediaan & Stok
                        </Typography>
                    </View>
                    <View className="bg-amber-50/50 rounded-2xl p-3 border border-amber-100/50">
                        <Row label="Persediaan Sparepart" value={data.persediaan_sparepart} small />
                        <Row label="Stok Mobil (Inventory)" value={data.stok_mobil} small />
                    </View>
                </View>
            </Card>
        );
    };

    const renderAktivaTetap = () => {
        const data = report?.aktiva_tetap || {};
        return (
            <Card className="mb-5 p-5">
                <View className="flex-row items-center mb-5">
                    <View className="w-9 h-9 rounded-2xl bg-indigo-100 items-center justify-center mr-3">
                        <Box size={18} color="#4338CA" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-text">Aktiva Tetap</Typography>
                        <Typography variant="caption" className="text-textGray">Fixed Assets / Perusahaan</Typography>
                    </View>
                    <View className="bg-indigo-50 px-3 py-1 rounded-xl">
                        <Typography variant="caption" weight="bold" className="text-indigo-700">
                            {formatCurrency(data.total_aktiva_tetap || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/50">
                    <Typography variant="caption" weight="bold" className="text-indigo-700 uppercase tracking-widest text-[9px] mb-2 px-1">
                        Daftar Aset Aktif
                    </Typography>
                    {data.detail_aset && data.detail_aset.length > 0 ? (
                        data.detail_aset.map((aset: any, index: number) => (
                            <Row
                                key={index}
                                label={`${aset.kode} - ${aset.nama}`}
                                value={aset.harga_beli}
                                small
                            />
                        ))
                    ) : (
                        <View className="py-4 items-center">
                            <Typography variant="caption" className="text-gray-400">Belum ada aset terdaftar</Typography>
                        </View>
                    )}
                    <View className="h-[1px] bg-indigo-200/50 my-1.5" />
                    <Row label="Total Aktiva Tetap" value={data.total_aktiva_tetap} bold color="text-indigo-700" />
                </View>
            </Card>
        );
    };

    const renderTotalAktiva = () => (
        <View className="mb-5 bg-emerald-600 p-5 rounded-[28px] shadow-lg shadow-emerald-200">
            <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-white/20 rounded-2xl items-center justify-center mr-3">
                        <ArrowUpRight size={20} color="white" />
                    </View>
                    <View>
                        <Typography variant="caption" weight="bold" className="text-white/60 uppercase tracking-widest text-[9px]">
                            Total Aktiva
                        </Typography>
                        <Typography variant="caption" className="text-white/40">Assets</Typography>
                    </View>
                </View>
                <Typography variant="h3" weight="bold" className="text-white">
                    {formatCurrency(report?.total_aktiva || 0)}
                </Typography>
            </View>
        </View>
    );

    const renderHutang = () => {
        const data = report?.hutang || {};
        return (
            <Card className="mb-5 p-5 border-rose-100 bg-rose-50/10">
                <View className="flex-row items-center mb-5">
                    <View className="w-9 h-9 rounded-2xl bg-rose-100 items-center justify-center mr-3">
                        <CreditCard size={18} color="#E11D48" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-text">Hutang</Typography>
                        <Typography variant="caption" className="text-textGray">Liabilities</Typography>
                    </View>
                    <View className="bg-rose-50 px-3 py-1 rounded-xl">
                        <Typography variant="caption" weight="bold" className="text-rose-700">
                            {formatCurrency(data.total_hutang || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="bg-rose-50/50 rounded-2xl p-3 border border-rose-100/50">
                    <Row label="Hutang Pembelian Part" value={data.hutang_part} small />
                    <Row label="Hutang Pembelian Mobil" value={data.hutang_mobil} small />
                    <Row label="Hutang Investor" value={data.hutang_investor} small />
                    <Row label="Hutang Lainnya" value={data.hutang_lainnya} small />
                    <View className="h-[1px] bg-rose-200/50 my-1.5" />
                    <Row label="Total Hutang" value={data.total_hutang} bold color="text-rose-700" />
                </View>
            </Card>
        );
    };

    const renderModal = () => {
        const data = report?.modal || {};
        return (
            <Card className="mb-5 p-5">
                <View className="flex-row items-center mb-5">
                    <View className="w-9 h-9 rounded-2xl bg-violet-100 items-center justify-center mr-3">
                        <Landmark size={18} color="#7C3AED" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-text">Modal</Typography>
                        <Typography variant="caption" className="text-textGray">Equity</Typography>
                    </View>
                    <View className="bg-violet-50 px-3 py-1 rounded-xl">
                        <Typography variant="caption" weight="bold" className="text-violet-700">
                            {formatCurrency(data.total_modal || 0)}
                        </Typography>
                    </View>
                </View>

                {/* Setoran Modal */}
                <View className="mb-3">
                    <View className="bg-violet-50/50 rounded-2xl p-3 border border-violet-100/50">
                        <Row label="Setoran Modal" value={data.setoran_modal} />
                    </View>
                </View>

                {/* Laba Ditahan */}
                <View className="mb-3">
                    <View className="flex-row items-center mb-2">
                        <View className="w-1 h-4 bg-violet-500 rounded-full mr-2" />
                        <Typography variant="caption" weight="bold" className="text-violet-700 uppercase tracking-widest text-[10px]">
                            Laba Ditahan
                        </Typography>
                    </View>
                    <View className="bg-violet-50/50 rounded-2xl p-3 border border-violet-100/50">
                        <Row label="Laba Kotor" value={data.laba_kotor} small />
                        <View className="ml-3 pl-3 border-l-2 border-violet-200/50 my-1">
                            <Row label="Bengkel" value={data.detail_laba?.bengkel} small />
                            <Row label="Jual Beli Mobil" value={data.detail_laba?.mobil} small />
                            <Row label="Jasa Angkut" value={data.detail_laba?.jasa_angkut} small />
                        </View>
                        <Row label="Total Beban Operasional" value={data.total_beban} small isNegative />
                        <View className="h-[1px] bg-violet-200/50 my-1.5" />
                        <Row label="Laba Ditahan" value={data.laba_ditahan} bold color="text-violet-700" />
                    </View>
                </View>

                {/* Prive */}
                <View className="mb-3 bg-rose-50/50 rounded-2xl p-3 border border-rose-100/50">
                    <Row label="Prive (Pengambilan Pemilik)" value={data.prive} isNegative />
                </View>

                {/* Reconciliation Info */}
                {data.selisih_modal !== 0 && data.selisih_modal != null && (
                    <View className="bg-amber-50/50 rounded-2xl p-3 border border-amber-100/50">
                        <View className="flex-row items-center mb-2">
                            <AlertTriangle size={12} color="#D97706" />
                            <Typography variant="caption" weight="bold" className="text-amber-700 ml-1.5 text-[10px]">
                                SELISIH PENYESUAIAN
                            </Typography>
                        </View>
                        <Row label="Modal (Perhitungan Komponen)" value={data.modal_komponen} small />
                        <Row label="Penyesuaian" value={data.selisih_modal} small color="text-amber-700" />
                        <Typography variant="caption" className="text-amber-600/60 text-[9px] mt-1 px-1">
                            Selisih karena konversi kas ke aset (pembelian mobil, sparepart, dll)
                        </Typography>
                    </View>
                )}
            </Card>
        );
    };

    const renderTotalPasiva = () => (
        <View className="mb-5 bg-violet-600 p-5 rounded-[28px] shadow-lg shadow-violet-200">
            <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-white/20 rounded-2xl items-center justify-center mr-3">
                        <ArrowDownLeft size={20} color="white" />
                    </View>
                    <View>
                        <Typography variant="caption" weight="bold" className="text-white/60 uppercase tracking-widest text-[9px]">
                            Total Pasiva
                        </Typography>
                        <Typography variant="caption" className="text-white/40">Hutang + Modal</Typography>
                    </View>
                </View>
                <Typography variant="h3" weight="bold" className="text-white">
                    {formatCurrency(report?.total_pasiva || 0)}
                </Typography>
            </View>
        </View>
    );

    const renderBalanceCheck = () => {
        const isBalanced = report?.is_balanced;
        const selisih = report?.selisih || 0;

        return (
            <Card className={`mb-24 p-6 ${isBalanced ? 'bg-primary border-0' : 'bg-amber-500 border-0'} shadow-2xl relative overflow-hidden`}>
                {/* Decorative */}
                <View className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />

                <View className="flex-row items-center mb-5">
                    <View className="w-11 h-11 rounded-2xl bg-white/20 items-center justify-center mr-4">
                        <Scale size={22} color="white" />
                    </View>
                    <View>
                        <Typography variant="h4" weight="bold" className="text-white">Keseimbangan Neraca</Typography>
                        <Typography variant="caption" className="text-white/50">Balance Check</Typography>
                    </View>
                </View>

                <View className="bg-white/10 rounded-2xl p-4 border border-white/10 mb-4">
                    <View className="flex-row justify-between items-center mb-3">
                        <Typography className="text-white/60 text-xs">Total Aktiva</Typography>
                        <Typography weight="bold" className="text-white">{formatCurrency(report?.total_aktiva || 0)}</Typography>
                    </View>
                    <View className="flex-row justify-between items-center mb-3">
                        <Typography className="text-white/60 text-xs">Total Pasiva (Hutang + Modal)</Typography>
                        <Typography weight="bold" className="text-white">{formatCurrency(report?.total_pasiva || 0)}</Typography>
                    </View>
                    <View className="h-[1px] bg-white/10 my-2" />
                    <View className="flex-row justify-between items-center">
                        <Typography className="text-white/60 text-xs">Selisih</Typography>
                        <Typography weight="bold" className={selisih === 0 ? "text-emerald-300" : "text-amber-300"}>
                            {formatCurrency(selisih)}
                        </Typography>
                    </View>
                </View>

                <View className="flex-row items-center justify-center p-3 bg-white/10 rounded-2xl">
                    {isBalanced ? (
                        <>
                            <CheckCircle size={18} color="#6EE7B7" />
                            <Typography weight="bold" className="text-emerald-300 ml-2 text-sm">
                                NERACA SEIMBANG
                            </Typography>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={18} color="#FCD34D" />
                            <Typography weight="bold" className="text-amber-200 ml-2 text-sm">
                                TERDAPAT SELISIH
                            </Typography>
                        </>
                    )}
                </View>
            </Card>
        );
    };

    // ==========================================
    // MAIN RENDER
    // ==========================================
    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Neraca</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Laporan Posisi Keuangan</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <View className="bg-white/10 px-4 py-2 rounded-2xl border border-white/5 mr-2">
                            <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[10px]">
                                {getHeaderDate()}
                            </Typography>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowExportMenu(true)}
                            disabled={isExporting}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <Download size={22} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Summary Card */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10 mb-8">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Balance Sheet</Typography>
                        </View>
                        <View className="flex-row items-center">
                            <Scale size={14} color={report?.is_balanced ? "#10B981" : "#FBBF24"} />
                            <Typography className={`${report?.is_balanced ? 'text-emerald-400' : 'text-amber-400'} text-[10px] font-bold ml-1`}>
                                {report?.is_balanced ? 'BALANCED' : 'UNBALANCED'}
                            </Typography>
                        </View>
                    </View>

                    <View className="flex-row justify-between pt-1">
                        <View className="flex-1">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Aktiva</Typography>
                            <Typography weight="bold" className="text-white text-base">{formatCurrency(report?.total_aktiva || 0)}</Typography>
                        </View>
                        <View className="w-[1px] bg-white/10 mx-4" />
                        <View className="flex-1 items-end">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Pasiva</Typography>
                            <Typography weight="bold" className="text-white text-base">{formatCurrency(report?.total_pasiva || 0)}</Typography>
                        </View>
                    </View>
                </View>

                {/* Filter Tabs */}
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
            {/* Date Navigator */}
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

            {/* Content */}
            <ScrollView
                className="flex-1 px-4 pt-8"
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={refetch} />}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color={themeColors.primary} />
                        <Typography className="mt-4 text-textGray font-bold uppercase text-[10px] tracking-widest text-center">
                            Mengolah Neraca...
                        </Typography>
                    </View>
                ) : (
                    <>
                        {/* AKTIVA Section Header */}
                        <View className="flex-row items-center mb-4 px-2">
                            <View className="w-2 h-8 bg-emerald-500 rounded-full mr-3" />
                            <View>
                                <Typography variant="h3" weight="bold" className="text-text tracking-tight">AKTIVA</Typography>
                                <Typography variant="caption" className="text-textGray">Harta Perusahaan</Typography>
                            </View>
                        </View>

                        {renderAktivaLancar()}
                        {renderAktivaTetap()}
                        {renderTotalAktiva()}

                        {/* PASIVA Section Header */}
                        <View className="flex-row items-center mb-4 px-2 mt-4">
                            <View className="w-2 h-8 bg-violet-500 rounded-full mr-3" />
                            <View>
                                <Typography variant="h3" weight="bold" className="text-text tracking-tight">PASIVA</Typography>
                                <Typography variant="caption" className="text-textGray">Kewajiban & Modal</Typography>
                            </View>
                        </View>

                        {renderHutang()}
                        {renderModal()}
                        {renderTotalPasiva()}
                        {/* Balance Check */}
                        {renderBalanceCheck()}
                    </>
                )}
            </ScrollView>

        {/* Export Action Menu */}
        <Modal
            visible={showExportMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowExportMenu(false)}
        >
            <TouchableOpacity
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
                        <TouchableOpacity onPress={() => setShowExportMenu(false)} className="bg-background p-2 rounded-full">
                            <X size={20} color={themeColors.textGray} />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            onPress={async () => {
                                setShowExportMenu(false);
                                if (!report) return;
                                try {
                                    const html = `
                                        <div class="section-header">AKTIVA (ASSETS)</div>
                                        <div style="font-weight:bold; color:#059669; margin:10px 0;">AKTIVA LANCAR</div>
                                        <div class="row-item">
                                            <span>Kas Tunai</span>
                                            <span>${formatCurrency(report.aktiva_lancar.kas_tunai)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Kas Bank</span>
                                            <span>${formatCurrency(report.aktiva_lancar.kas_bank)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>Total Kas & Bank</span>
                                            <span>${formatCurrency(report.aktiva_lancar.total_kas_bank)}</span>
                                        </div>
                                        
                                        <div class="row-item" style="margin-top:10px;">
                                            <span>Piutang Bengkel</span>
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_bengkel)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Piutang Mobil</span>
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_mobil)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>Total Piutang</span>
                                            <span>${formatCurrency(report.aktiva_lancar.total_piutang)}</span>
                                        </div>

                                        <div class="row-item" style="margin-top:10px;">
                                            <span>Persediaan Sparepart</span>
                                            <span>${formatCurrency(report.aktiva_lancar.persediaan_sparepart)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Stok Mobil</span>
                                            <span>${formatCurrency(report.aktiva_lancar.stok_mobil)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL AKTIVA LANCAR</span>
                                            <span class="font-bold">${formatCurrency(report.aktiva_lancar.total_aktiva_lancar)}</span>
                                        </div>

                                        <div style="font-weight:bold; color:#4338CA; margin:20px 0 10px 0;">AKTIVA TETAP</div>
                                        ${report.aktiva_tetap.detail_aset?.map((aset: any) => `
                                            <div class="row-item row-sub">
                                                <span>${aset.kode} - ${aset.nama}</span>
                                                <span>${formatCurrency(aset.harga_beli)}</span>
                                            </div>
                                        `).join('')}
                                        <div class="row-item row-total">
                                            <span>TOTAL AKTIVA TETAP</span>
                                            <span class="font-bold">${formatCurrency(report.aktiva_tetap.total_aktiva_tetap)}</span>
                                        </div>

                                        <div class="row-item row-total" style="font-size:16px; background:#059669; color:white; padding:10px; border-radius:5px; margin-top:20px;">
                                            <span>TOTAL AKTIVA</span>
                                            <span class="font-bold">${formatCurrency(report.total_aktiva)}</span>
                                        </div>

                                        <div class="section-header" style="background:#7C3AED; margin-top:40px;">PASIVA (LIABILITIES & EQUITY)</div>
                                        <div style="font-weight:bold; color:#E11D48; margin:10px 0;">HUTANG</div>
                                        <div class="row-item">
                                            <span>Hutang Part</span>
                                            <span>${formatCurrency(report.hutang.hutang_part)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Hutang Mobil</span>
                                            <span>${formatCurrency(report.hutang.hutang_mobil)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL HUTANG</span>
                                            <span class="font-bold">${formatCurrency(report.hutang.total_hutang)}</span>
                                        </div>

                                        <div style="font-weight:bold; color:#7C3AED; margin:20px 0 10px 0;">MODAL</div>
                                        <div class="row-item">
                                            <span>Setoran Modal</span>
                                            <span>${formatCurrency(report.modal.setoran_modal)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Laba Ditahan</span>
                                            <span>${formatCurrency(report.modal.laba_ditahan)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Prive</span>
                                            <span class="text-error">(${formatCurrency(report.modal.prive)})</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL MODAL</span>
                                            <span class="font-bold">${formatCurrency(report.modal.total_modal)}</span>
                                        </div>

                                        <div class="row-item row-total" style="font-size:16px; background:#7C3AED; color:white; padding:10px; border-radius:5px; margin-top:20px;">
                                            <span>TOTAL PASIVA</span>
                                            <span class="font-bold">${formatCurrency(report.total_pasiva)}</span>
                                        </div>

                                        <div style="margin-top:30px; padding:15px; border:2px solid ${report.is_balanced ? '#059669' : '#D97706'}; border-radius:10px; text-align:center;">
                                            <div style="font-weight:bold; font-size:14px; color:${report.is_balanced ? '#059669' : '#D97706'};">
                                                STATUS NERACA: ${report.is_balanced ? 'SEIMBANG (BALANCED)' : 'SELISIH (UNBALANCED)'}
                                            </div>
                                            ${report.selisih !== 0 ? `<div style="font-size:12px; margin-top:5px;">Selisih: ${formatCurrency(report.selisih)}</div>` : ''}
                                        </div>
                                    `;

                                    await printReportHTML(html, {
                                        title: 'Laporan Neraca',
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
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={async () => {
                                setShowExportMenu(false);
                                if (!report) return;
                                try {
                                    const html = `
                                        <div class="section-header">AKTIVA (ASSETS)</div>
                                        <div style="font-weight:bold; color:#059669; margin:10px 0;">AKTIVA LANCAR</div>
                                        <div class="row-item">
                                            <span>Kas Tunai</span>
                                            <span>${formatCurrency(report.aktiva_lancar.kas_tunai)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Kas Bank</span>
                                            <span>${formatCurrency(report.aktiva_lancar.kas_bank)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>Total Kas & Bank</span>
                                            <span>${formatCurrency(report.aktiva_lancar.total_kas_bank)}</span>
                                        </div>
                                        
                                        <div class="row-item" style="margin-top:10px;">
                                            <span>Piutang Bengkel</span>
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_bengkel)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Piutang Mobil</span>
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_mobil)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>Total Piutang</span>
                                            <span>${formatCurrency(report.aktiva_lancar.total_piutang)}</span>
                                        </div>

                                        <div class="row-item" style="margin-top:10px;">
                                            <span>Persediaan Sparepart</span>
                                            <span>${formatCurrency(report.aktiva_lancar.persediaan_sparepart)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Stok Mobil</span>
                                            <span>${formatCurrency(report.aktiva_lancar.stok_mobil)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL AKTIVA LANCAR</span>
                                            <span class="font-bold">${formatCurrency(report.aktiva_lancar.total_aktiva_lancar)}</span>
                                        </div>

                                        <div style="font-weight:bold; color:#4338CA; margin:20px 0 10px 0;">AKTIVA TETAP</div>
                                        ${report.aktiva_tetap.detail_aset?.map((aset: any) => `
                                            <div class="row-item row-sub">
                                                <span>${aset.kode} - ${aset.nama}</span>
                                                <span>${formatCurrency(aset.harga_beli)}</span>
                                            </div>
                                        `).join('')}
                                        <div class="row-item row-total">
                                            <span>TOTAL AKTIVA TETAP</span>
                                            <span class="font-bold">${formatCurrency(report.aktiva_tetap.total_aktiva_tetap)}</span>
                                        </div>

                                        <div class="row-item row-total" style="font-size:16px; background:#059669; color:white; padding:10px; border-radius:5px; margin-top:20px;">
                                            <span>TOTAL AKTIVA</span>
                                            <span class="font-bold">${formatCurrency(report.total_aktiva)}</span>
                                        </div>

                                        <div class="section-header" style="background:#7C3AED; margin-top:40px;">PASIVA (LIABILITIES & EQUITY)</div>
                                        <div style="font-weight:bold; color:#E11D48; margin:10px 0;">HUTANG</div>
                                        <div class="row-item">
                                            <span>Hutang Part</span>
                                            <span>${formatCurrency(report.hutang.hutang_part)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Hutang Mobil</span>
                                            <span>${formatCurrency(report.hutang.hutang_mobil)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL HUTANG</span>
                                            <span class="font-bold">${formatCurrency(report.hutang.total_hutang)}</span>
                                        </div>

                                        <div style="font-weight:bold; color:#7C3AED; margin:20px 0 10px 0;">MODAL</div>
                                        <div class="row-item">
                                            <span>Setoran Modal</span>
                                            <span>${formatCurrency(report.modal.setoran_modal)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Laba Ditahan</span>
                                            <span>${formatCurrency(report.modal.laba_ditahan)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Prive</span>
                                            <span class="text-error">(${formatCurrency(report.modal.prive)})</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL MODAL</span>
                                            <span class="font-bold">${formatCurrency(report.modal.total_modal)}</span>
                                        </div>

                                        <div class="row-item row-total" style="font-size:16px; background:#7C3AED; color:white; padding:10px; border-radius:5px; margin-top:20px;">
                                            <span>TOTAL PASIVA</span>
                                            <span class="font-bold">${formatCurrency(report.total_pasiva)}</span>
                                        </div>

                                        <div style="margin-top:30px; padding:15px; border:2px solid ${report.is_balanced ? '#059669' : '#D97706'}; border-radius:10px; text-align:center;">
                                            <div style="font-weight:bold; font-size:14px; color:${report.is_balanced ? '#059669' : '#D97706'};">
                                                STATUS NERACA: ${report.is_balanced ? 'SEIMBANG (BALANCED)' : 'SELISIH (UNBALANCED)'}
                                            </div>
                                            ${report.selisih !== 0 ? `<div style="font-size:12px; margin-top:5px;">Selisih: ${formatCurrency(report.selisih)}</div>` : ''}
                                        </div>
                                    `;

                                    await printReportHTML(html, {
                                        title: 'Laporan Neraca',
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
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
        </SafeAreaView>
    );
}
