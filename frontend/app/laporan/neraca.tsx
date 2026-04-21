import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Alert } from 'react-native';
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

    const Row = ({ label, value, bold, small, large, color, isNegative, isDark, indent }: {
        label: string;
        value: number;
        bold?: boolean;
        small?: boolean;
        large?: boolean;
        color?: string;
        isNegative?: boolean;
        isDark?: boolean;
        indent?: boolean;
    }) => (
        <View className={`flex-row justify-between items-center py-1.5 w-full ${indent ? 'pl-4' : ''}`}>
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

    // ==========================================
    // RENDER SECTIONS
    // ==========================================

    const renderAktivaLancar = () => {
        const data = report?.aktiva_lancar || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-emerald-50/70 px-5 py-4 flex-row justify-between items-center border-b border-emerald-100/50 w-full">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-emerald-100/80 items-center justify-center mr-3">
                            <Banknote size={20} className="text-emerald-600" />
                        </View>
                        <View>
                            <Typography variant="h4" weight="bold" className="text-emerald-900 tracking-tight">Aktiva Lancar</Typography>
                            <Typography variant="caption" className="text-emerald-700/60 uppercase text-[10px] tracking-wider mt-0.5">Current Assets</Typography>
                        </View>
                    </View>
                    <View className="bg-emerald-100/50 px-3 py-1.5 rounded-full border border-emerald-200/30">
                        <Typography variant="body2" weight="bold" className="text-emerald-800">
                            {formatCurrency(data.total_aktiva_lancar || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    {/* Kas & Bank */}
                    <View className="mb-4 w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-emerald-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">
                                Kas & Bank
                            </Typography>
                        </View>
                        <View className="w-full pl-3">
                            <Row label="Kas Tunai (Utama)" value={data.kas_tunai} small />
                            <Row label="Kas Bank" value={data.kas_bank} small />
                            <Row label="Kas di Unit Operasional" value={data.unit_cash} small />

                            {/* Breakdown Unit Cash if relevant */}
                            {data.unit_details && (
                                <View className="ml-2 pl-2 border-l border-slate-200/50 mt-1 mb-1">
                                    {Object.entries(data.unit_details).map(([unit, val]) => (
                                        <Row
                                            key={unit}
                                            label={unit.replace('kas_unit_', '').replace(/_/g, ' ').toUpperCase()}
                                            value={val as number}
                                            small
                                            indent
                                        />
                                    ))}
                                </View>
                            )}

                            <View className="h-[1px] bg-slate-100 w-full my-2" />
                            <Row label="Total Kas & Bank" value={data.total_kas_bank} bold color="text-emerald-700" />
                        </View>
                    </View>

                    {/* Piutang */}
                    <View className="mb-4 w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-blue-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">
                                Piutang Usaha
                            </Typography>
                        </View>
                        <View className="w-full pl-3">
                            <Row label="Piutang Lainnya" value={data.piutang_lainnya} small />
                            <Row label="Piutang Unit Mobil" value={data.piutang_mobil} small />
                            <Row label="Piutang Sparepart Mobil" value={data.piutang_part_mobil} small />
                            <Row label="Piutang Unit Jasa Angkut" value={data.piutang_jasa_angkut} small />
                            <Row label="Piutang Karyawan (Kasbon)" value={data.piutang_karyawan} small />
                            <Row label="Piutang Unit Bengkel" value={data.piutang_usaha} small />
                            <View className="h-[1px] bg-slate-100 w-full my-2" />
                            <Row label="Total Piutang" value={data.total_piutang} bold color="text-blue-700" />
                        </View>
                    </View>

                    {/* Persediaan */}
                    <View className="w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-amber-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">
                                Persediaan & Stok
                            </Typography>
                        </View>
                        <View className="w-full pl-3">
                            <Row label="Persediaan Sparepart" value={data.persediaan_sparepart} small />
                            <Row label="Stok Mobil (Inventory)" value={data.stok_mobil} small />
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    const renderAktivaTetap = () => {
        const data = report?.aktiva_tetap || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-indigo-50/70 px-5 py-4 flex-row justify-between items-center border-b border-indigo-100/50 w-full">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-indigo-100/80 items-center justify-center mr-3">
                            <Box size={20} className="text-indigo-600" />
                        </View>
                        <View>
                            <Typography variant="h4" weight="bold" className="text-indigo-900 tracking-tight">Aktiva Tetap</Typography>
                            <Typography variant="caption" className="text-indigo-700/60 uppercase text-[10px] tracking-wider mt-0.5">Fixed Assets</Typography>
                        </View>
                    </View>
                    <View className="bg-indigo-100/50 px-3 py-1.5 rounded-full border border-indigo-200/30">
                        <Typography variant="body2" weight="bold" className="text-indigo-800">
                            {formatCurrency(data.total_aktiva_tetap || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px] mb-3">
                        Daftar Aset Aktif
                    </Typography>
                    <View className="w-full pl-2">
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
                                <Typography variant="caption" className="text-slate-400">Belum ada aset terdaftar</Typography>
                            </View>
                        )}
                        <View className="h-[1px] bg-slate-100 w-full my-3" />
                        <Row label="Total Aktiva Tetap" value={data.total_aktiva_tetap} bold color="text-indigo-700" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderTotalAktiva = () => (
        <View className="mb-6 rounded-[32px] p-1 bg-gradient-to-r from-emerald-500 to-emerald-700 w-full shadow-lg shadow-emerald-500/30">
            <View className="bg-emerald-600 rounded-[28px] p-5 w-full flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-white/20 rounded-[20px] items-center justify-center mr-4">
                        <ArrowUpRight size={24} color="white" />
                    </View>
                    <View>
                        <Typography variant="caption" weight="bold" className="text-white/60 uppercase tracking-widest text-[10px] mb-1">
                            Total Aktiva
                        </Typography>
                        <Typography variant="caption" className="text-white/80">Semua Aset</Typography>
                    </View>
                </View>
                <Typography variant="h2" weight="bold" className="text-white flex-shrink-0">
                    {formatCurrency(report?.total_aktiva || 0)}
                </Typography>
            </View>
        </View>
    );

    const renderModal = () => {
        const data = report?.modal || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-violet-50/70 px-5 py-4 flex-row justify-between items-center border-b border-violet-100/50 w-full">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-violet-100/80 items-center justify-center mr-3">
                            <Landmark size={20} className="text-violet-600" />
                        </View>
                        <View>
                            <Typography variant="h4" weight="bold" className="text-violet-900 tracking-tight">Modal</Typography>
                            <Typography variant="caption" className="text-violet-700/60 uppercase text-[10px] tracking-wider mt-0.5">Equity</Typography>
                        </View>
                    </View>
                    <View className="bg-violet-100/50 px-3 py-1.5 rounded-full border border-violet-200/30">
                        <Typography variant="body2" weight="bold" className="text-violet-800">
                            {formatCurrency(data.total_modal || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    {/* Modal Awal & Setoran */}
                    <View className="mb-4 w-full">
                        <Row label="1. Setoran Modal Tunai" value={data.setoran_modal} bold large />
                        {data.modal_persediaan > 0 && (
                            <Row label="Modal Awal Persediaan Sparepart" value={data.modal_persediaan} small indent />
                        )}
                        {data.pencairan_investor > 0 && (
                            <Row label="Pengembalian Modal Investor Mobil" value={data.pencairan_investor} isNegative small indent />
                        )}
                    </View>

                    {/* Laba Ditahan */}
                    <View className="mb-4 w-full">
                        <Row label="2. Laba Ditahan" value={data.laba_ditahan} bold large color="text-violet-700" />
                        <View className="bg-slate-50 w-full p-4 rounded-xl border border-slate-100 mt-2">
                            <Row label="Laba Kotor Total" value={data.laba_kotor} small />
                            <View className="ml-3 pl-3 border-l border-slate-200/60 my-1">
                                <Row label="Bengkel" value={data.detail_laba?.bengkel} small indent />
                                <Row label="Jual Beli Mobil" value={data.detail_laba?.mobil} small indent />
                                <Row label="Jasa Angkut" value={data.detail_laba?.jasa_angkut} small indent />
                            </View>
                            <Row label="Total Beban Operasional" value={data.total_beban} small isNegative />
                        </View>
                    </View>

                    {/* Prive */}
                    <View className="mb-4 w-full">
                        <Row label="3. Prive (Pengambilan Pemilik)" value={data.prive} isNegative bold large />
                    </View>

                    <View className="h-[1px] bg-slate-100 w-full my-1" />

                    {/* Reconciliation Info */}
                    {data.selisih_modal !== 0 && data.selisih_modal != null && (
                        <View className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50 mt-4 w-full">
                            <View className="flex-row items-center mb-3 border-b border-amber-100/50 pb-2">
                                <AlertTriangle size={14} className="text-amber-600" />
                                <Typography variant="caption" weight="bold" className="text-amber-800 ml-2 tracking-widest text-[10px]">
                                    SELISIH PENYESUAIAN
                                </Typography>
                            </View>
                            <Row label="Modal (Perhitungan Komponen)" value={data.modal_komponen} small />
                            <Row label="Penyesuaian" value={data.selisih_modal} small color="text-amber-700" />
                            <Typography variant="caption" className="text-amber-600/70 text-[10px] mt-2 block w-full leading-snug">
                                Penyesuaian karena selisih saldo yang tidak imbang
                            </Typography>
                        </View>
                    )}
                </View>
            </Card>
        );
    };

    const renderHutang = () => {
        const data = report?.hutang || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-rose-50/70 px-5 py-4 flex-row justify-between items-center border-b border-rose-100/50 w-full">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-rose-100/80 items-center justify-center mr-3">
                            <CreditCard size={20} className="text-rose-600" />
                        </View>
                        <View>
                            <Typography variant="h4" weight="bold" className="text-rose-900 tracking-tight">Hutang</Typography>
                            <Typography variant="caption" className="text-rose-700/60 uppercase text-[10px] tracking-wider mt-0.5">Liabilities</Typography>
                        </View>
                    </View>
                    <View className="bg-rose-100/50 px-3 py-1.5 rounded-full border border-rose-200/30">
                        <Typography variant="body2" weight="bold" className="text-rose-800">
                            {formatCurrency(data.total_hutang || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <Row label="1. Hutang Pembelian Part" value={data.hutang_part} small large />
                    <Row label="2. Hutang Pembelian Mobil" value={data.hutang_mobil} small large />
                    <Row label="3. Hutang Investor" value={data.hutang_investor} small large />
                    <Row label="4. Hutang Lainnya" value={data.hutang_lainnya} small large />
                    
                    <View className="h-[1px] bg-slate-100 w-full my-3" />
                    
                    <View className="w-full bg-rose-50 p-4 rounded-xl border border-rose-100/50">
                        <Row label="Total Hutang" value={data.total_hutang} bold large color="text-rose-800" />
                    </View>
                </View>
            </Card>
        );
    };



    const renderTotalPasiva = () => (
        <View className="mb-6 rounded-[32px] p-1 bg-gradient-to-r from-violet-500 to-violet-700 w-full shadow-lg shadow-violet-500/30">
            <View className="bg-violet-600 rounded-[28px] p-5 w-full flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-white/20 rounded-[20px] items-center justify-center mr-4">
                        <ArrowDownLeft size={24} color="white" />
                    </View>
                    <View>
                        <Typography variant="caption" weight="bold" className="text-white/60 uppercase tracking-widest text-[10px] mb-1">
                            Total Pasiva
                        </Typography>
                        <Typography variant="caption" className="text-white/80">Hutang + Modal</Typography>
                    </View>
                </View>
                <Typography variant="h2" weight="bold" className="text-white flex-shrink-0">
                    {formatCurrency(report?.total_pasiva || 0)}
                </Typography>
            </View>
        </View>
    );

    const renderBalanceCheck = () => {
        const isBalanced = report?.is_balanced;
        const selisih = report?.selisih || 0;

        return (
            <View className={`mb-24 rounded-[32px] overflow-hidden p-6 ${isBalanced ? 'bg-primary' : 'bg-amber-600'} shadow-2xl relative w-full`}>
                <View className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
                <View className="absolute -bottom-10 -left-10 w-20 h-20 bg-black/5 rounded-full" />

                <View className="flex-row items-center mb-6">
                    <View className="w-12 h-12 rounded-[20px] bg-white/20 items-center justify-center mr-4">
                        <Scale size={24} color="white" />
                    </View>
                    <View>
                        <Typography variant="h3" weight="bold" className="text-white tracking-tight">Keseimbangan Neraca</Typography>
                        <Typography variant="caption" className="text-white/60 uppercase tracking-widest text-[10px] mt-0.5">Balance Check</Typography>
                    </View>
                </View>

                <View className="bg-white/10 rounded-2xl p-5 border border-white/10 mb-4 w-full">
                    <Row label="Total Aktiva" value={report?.total_aktiva || 0} isDark small />
                    <Row label="Total Pasiva (Hutang + Modal)" value={report?.total_pasiva || 0} isDark small />
                    <View className="h-[1px] bg-white/20 w-full my-3" />
                    <View className="flex-row justify-between items-center w-full">
                        <Typography className="text-white/60 text-xs flex-1">Selisih</Typography>
                        <Typography variant="h4" weight="bold" className={selisih === 0 ? "text-emerald-300" : "text-amber-300"}>
                            {formatCurrency(selisih)}
                        </Typography>
                    </View>
                </View>

                <View className={`flex-row items-center justify-center p-4 rounded-xl w-full border ${isBalanced ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                    {isBalanced ? (
                        <>
                            <CheckCircle size={20} color="#6EE7B7" />
                            <Typography weight="bold" className="text-emerald-300 ml-2 tracking-wide uppercase text-sm">
                                NERACA SEIMBANG
                            </Typography>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={20} color="#FDE68A" />
                            <Typography weight="bold" className="text-amber-200 ml-2 tracking-wide uppercase text-sm">
                                TERDAPAT SELISIH
                            </Typography>
                        </>
                    )}
                </View>
            </View>
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
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
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
                        <Pressable
                            onPress={() => setShowExportMenu(true)}
                            disabled={isExporting}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <Download size={22} color="white" />
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
                        <View className="bg-slate-900 p-6 rounded-[32px] shadow-xl shadow-slate-900/20 mb-8 mt-2 w-full">
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                    <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Balance Sheet</Typography>
                                </View>
                                <View className="flex-row items-center">
                                    <Scale size={14} color={report?.is_balanced ? "#34D399" : "#FBBF24"} />
                                    <Typography className={`${report?.is_balanced ? 'text-emerald-400' : 'text-amber-400'} text-[10px] font-bold ml-1`}>
                                        {report?.is_balanced ? 'BALANCED' : 'UNBALANCED'}
                                    </Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between pt-1">
                                <View className="flex-1">
                                    <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Aktiva</Typography>
                                    <Typography weight="bold" className="text-white text-base">{formatCurrency(report?.total_aktiva || 0)}</Typography>
                                </View>
                                <View className="w-[1px] bg-slate-700/50 mx-4" />
                                <View className="flex-1 items-end">
                                    <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Pasiva</Typography>
                                    <Typography weight="bold" className="text-white text-base">{formatCurrency(report?.total_pasiva || 0)}</Typography>
                                </View>
                            </View>
                        </View>

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
                        {renderModal()}
                        {renderHutang()}
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
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_usaha)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Piutang Mobil</span>
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_mobil)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Piutang Jasa Angkut</span>
                                            <span>${formatCurrency(report.aktiva_lancar.piutang_jasa_angkut)}</span>
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
                                        <div style="font-weight:bold; color:#E11D48; margin:10px 0;">HUTANG</div>
                                        <div class="row-item">
                                            <span>Hutang Part</span>
                                            <span>${formatCurrency(report.hutang.hutang_part)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Hutang Mobil</span>
                                            <span>${formatCurrency(report.hutang.hutang_mobil)}</span>
                                        </div>
                                        <div class="row-item">
                                            <span>Hutang Investor</span>
                                            <span>${formatCurrency(report.hutang.hutang_investor)}</span>
                                        </div>
                                        <div class="row-item row-total">
                                            <span>TOTAL HUTANG</span>
                                            <span class="font-bold">${formatCurrency(report.hutang.total_hutang)}</span>
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
                            </Pressable>

                            <Pressable
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
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
