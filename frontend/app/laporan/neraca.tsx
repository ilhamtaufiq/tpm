import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import {
    ChevronLeft, ChevronRight, Calendar, Wallet, Building2,
    Car, CreditCard, Landmark, TrendingUp, ArrowUpRight,
    ArrowDownLeft, DollarSign, Scale, CheckCircle, AlertTriangle, Banknote, Package, Box,
    Printer, Download, Eye, Share2, X
} from 'lucide-react-native';
import { Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, endOfMonth, endOfYear } from 'date-fns';
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
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
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
        // Neraca is a point-in-time report (Balance Sheet)
        // We send the END date as as_of_date
        let end = date;
        if (filterType === 'monthly') {
            end = endOfMonth(date);
        } else if (filterType === 'yearly') {
            end = endOfYear(date);
        }
        return {
            as_of_date: format(end, 'yyyy-MM-dd'),
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
                    {/* 1. Setoran Modal */}
                    <View className="mb-4 w-full">
                        <Row label="1. Setoran Modal" value={data.setoran_modal} bold large />
                        
                        {/* Breakdown: Kas + Non-Kas */}
                        {(data.setoran_modal_kas > 0 || data.modal_non_kas > 0) && (
                            <View className="bg-violet-50/50 w-full p-3 rounded-xl border border-violet-100 mt-2">
                                {data.setoran_modal_kas > 0 && (
                                    <Row label="Modal Tunai (Kas)" value={data.setoran_modal_kas} small indent />
                                )}
                                {data.modal_non_kas > 0 && (
                                    <Row label="Modal Non-Kas (Aset)" value={data.modal_non_kas} small indent />
                                )}
                            </View>
                        )}
                    </View>

                    {/* Detail Modal Non-Kas (Breakdown per Jenis Aset) */}
                    {data.modal_non_kas > 0 && (data.modal_persediaan > 0 || data.modal_stok_mobil > 0 || data.modal_aset_tetap > 0) && (
                        <View className="mb-4 w-full">
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase text-[10px] tracking-wider mb-2">
                                Detail Modal Non-Kas
                            </Typography>
                            <View className="bg-slate-50 w-full p-4 rounded-xl border border-slate-100">
                                {data.modal_persediaan > 0 && (
                                    <Row label="Persediaan Sparepart" value={data.modal_persediaan} small indent />
                                )}
                                {data.modal_stok_mobil > 0 && (
                                    <Row label="Stok Mobil (Inventory)" value={data.modal_stok_mobil} small indent />
                                )}
                                {data.modal_aset_tetap > 0 && (
                                    <Row label="Aset Tetap" value={data.modal_aset_tetap} small indent />
                                )}
                            </View>
                        </View>
                    )}

                    {/* Laba Ditahan */}
                    <View className="mb-4 w-full">
                        <Row label="2. Laba Ditahan" value={data.laba_ditahan} bold large color="text-violet-700" />
                    </View>

                    {/* Prive */}
                    <View className="mb-4 w-full">
                        <Row label="3. Prive (Pengambilan Pemilik)" value={data.prive} isNegative bold large />
                    </View>

                    <View className="h-[1px] bg-slate-100 w-full my-1" />
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
        const crossVal = report?.cross_validation || {};
        const selisihModal = report?.modal?.selisih_modal || 0;

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
                        <Typography className="text-white/60 text-xs flex-1">Selisih Neraca</Typography>
                        <Typography variant="h4" weight="bold" className={Math.abs(selisih) < 100 ? "text-emerald-300" : "text-amber-300"}>
                            {formatCurrency(selisih)}
                        </Typography>
                    </View>
                </View>

                {/* Cross-Validation: Equity Breakdown */}
                {crossVal.equity_from_components !== undefined && (
                    <View className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4 w-full">
                        <Typography variant="caption" weight="bold" className="text-white/50 uppercase tracking-widest text-[9px] mb-2">
                            Validasi Komponen Modal
                        </Typography>
                        <View className="w-full">
                            <View className="flex-row justify-between items-center py-1">
                                <Typography variant="caption" className="text-white/60 flex-1">Modal (Bottom-Up)</Typography>
                                <Typography variant="body2" weight="semibold" className="text-white/80">
                                    {formatCurrency(crossVal.equity_from_components || 0)}
                                </Typography>
                            </View>
                            <View className="flex-row justify-between items-center py-1">
                                <Typography variant="caption" className="text-white/60 flex-1">Modal (Aktiva-Hutang)</Typography>
                                <Typography variant="body2" weight="semibold" className="text-white/80">
                                    {formatCurrency(crossVal.equity_from_identity || 0)}
                                </Typography>
                            </View>
                            <View className="h-[1px] bg-white/15 w-full my-1.5" />
                            <View className="flex-row justify-between items-center py-1">
                                <Typography variant="caption" className="text-white/60 flex-1">Selisih Modal</Typography>
                                <Typography variant="body2" weight="bold" className={Math.abs(selisihModal) < 100 ? "text-emerald-300" : "text-amber-300"}>
                                    {formatCurrency(crossVal.selisih_equity || 0)}
                                </Typography>
                            </View>
                        </View>
                    </View>
                )}

                {/* Cross-Validation: Laba Reference */}
                {crossVal.laba_bersih_from_base !== undefined && (
                    <View className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4 w-full">
                        <Typography variant="caption" weight="bold" className="text-white/50 uppercase tracking-widest text-[9px] mb-2">
                            Referensi Silang Laba Rugi
                        </Typography>
                        <View className="flex-row justify-between items-center py-1">
                            <Typography variant="caption" className="text-white/60 flex-1">Laba Ditahan</Typography>
                            <Typography variant="body2" weight="semibold" className="text-white/80">
                                {formatCurrency(crossVal.retained_earnings || 0)}
                            </Typography>
                        </View>
                        <View className="flex-row justify-between items-center py-1">
                            <Typography variant="caption" className="text-white/60 flex-1">Laba Bersih (setelah Prive)</Typography>
                            <Typography variant="body2" weight="semibold" className="text-white/80">
                                {formatCurrency(crossVal.laba_bersih_from_base || 0)}
                            </Typography>
                        </View>
                    </View>
                )}

                {/* DEBUG: Internal Offset Check */}
                {crossVal.piutang_internal !== undefined && (
                    <View className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50 mb-4 w-full">
                        <Typography variant="caption" weight="bold" className="text-blue-300 uppercase tracking-widest text-[9px] mb-3">
                            DEBUG: Sinkronisasi Internal (Keseluruhan Transaksi)
                        </Typography>
                        <View className="w-full">
                            <View className="flex-row justify-between items-center py-1">
                                <Typography variant="caption" className="text-slate-400 flex-1">Total Piutang Internal</Typography>
                                <Typography variant="body2" weight="semibold" className="text-blue-200">
                                    {formatCurrency(crossVal.piutang_internal || 0)}
                                </Typography>
                            </View>
                            <View className="flex-row justify-between items-center py-1">
                                <Typography variant="caption" className="text-slate-400 flex-1">Total Hutang Internal</Typography>
                                <Typography variant="body2" weight="semibold" className="text-rose-200">
                                    {formatCurrency(crossVal.hutang_internal || 0)}
                                </Typography>
                            </View>
                            <View className="h-[1px] bg-slate-700 w-full my-2" />
                            <View className="flex-row justify-between items-center py-1">
                                <Typography variant="caption" className="text-slate-300 font-bold flex-1">GAP Keseluruhan</Typography>
                                <Typography variant="body2" weight="bold" className={Math.abs(crossVal.selisih_internal || 0) < 100 ? "text-emerald-400" : "text-amber-400"}>
                                    {formatCurrency(crossVal.selisih_internal || 0)}
                                </Typography>
                            </View>
                            <Typography variant="caption" className="text-slate-500 text-[9px] mt-2 italic">
                                *Gap ini harus 0 jika semua transaksi antar unit sudah tercatat di kedua sisi secara lengkap.
                            </Typography>
                        </View>
                    </View>
                )}

                {/* Mismatched Transactions Trace */}
                {crossVal.mismatches && crossVal.mismatches.length > 0 && (
                    <View className="bg-amber-900/20 rounded-xl p-4 border border-amber-700/30 mb-4 w-full">
                        <View className="flex-row items-center mb-3">
                            <AlertTriangle size={14} color="#FBBF24" />
                            <Typography variant="caption" weight="bold" className="text-amber-400 uppercase tracking-widest text-[9px] ml-2">
                                TRACE: Transaksi Tidak Sinkron
                            </Typography>
                        </View>
                        <View className="w-full space-y-2">
                            {crossVal.mismatches.map((item: any, idx: number) => (
                                <View key={idx} className="bg-black/20 p-3 rounded-lg border border-white/5">
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Typography variant="caption" weight="bold" className="text-slate-300">{item.ref}</Typography>
                                        <Typography variant="caption" weight="bold" className="text-amber-400">
                                            Gap: {formatCurrency(item.gap)}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography variant="caption" className="text-slate-500 text-[9px]">Piutang: {formatCurrency(item.piutang)}</Typography>
                                        <Typography variant="caption" className="text-slate-500 text-[9px]">Hutang: {formatCurrency(item.hutang)}</Typography>
                                    </View>
                                </View>
                            ))}
                            <Typography variant="caption" className="text-amber-500/70 text-[8px] mt-2 italic">
                                Menampilkan 10 transaksi dengan selisih terbesar.
                            </Typography>
                        </View>
                    </View>
                )}

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

    const buildNeracaExportHtml = () => {
        if (!report) return '';

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
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                    
                    .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11.5px; }
                    .section-title { background-color: #f8fafc; font-weight: 800; color: #4f46e5; text-transform: uppercase; font-size: 10px; letter-spacing: 1.5px; border-top: 1.5px solid #e2e8f0; }
                    .total-row { font-weight: 800; background-color: #f1f5f9; color: #1e293b; border-top: 2px solid #cbd5e1; }
                    .grand-total { font-weight: 800; background-color: #4f46e5; color: #ffffff; font-size: 13px; }
                    .grand-total td { border-bottom: none; }
                    
                    .sub-item { color: #64748b; padding-left: 25px; font-size: 9.5px; font-style: italic; }
                    .negative { color: #e11d48; }
                    .positive { color: #059669; }
                    
                    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #f1f5f9; font-size: 9px; color: #94a3b8; text-align: center; font-style: italic; }
                    
                    .balance-box { border-radius: 12px; padding: 15px; text-align: center; margin-top: 20px; border: 2px solid #e2e8f0; }
                    .balance-balanced { border-color: #059669; background-color: #f0fdf4; color: #059669; }
                    .balance-unbalanced { border-color: #e11d48; background-color: #fef2f2; color: #e11d48; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">Laporan Neraca</div>
                    <div class="subtitle">BENGKEL TPM - POSISI KEUANGAN</div>
                    <div class="date">Per ${getHeaderDate()}</div>
                </div>

                <table>
                    <tr class="section-title">
                        <td colspan="2">AKTIVA LANCAR</td>
                    </tr>
                    <tr>
                        <td>Kas & Bank</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.total_kas_bank || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Kas Tunai Utama</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.kas_tunai || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Kas Bank</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.kas_bank || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Kas Unit Bisnis</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.unit_cash || 0)}</td>
                    </tr>

                    <tr>
                        <td>Piutang Usaha (External & Internal)</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.total_piutang || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Piutang Unit Mobil</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.piutang_mobil || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Piutang Unit Jasa Angkut</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.piutang_jasa_angkut || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Piutang Bengkel & Sparepart</td>
                        <td class="amount">${formatCurrency((report.aktiva_lancar?.piutang_usaha || 0) + (report.aktiva_lancar?.piutang_part_mobil || 0))}</td>
                    </tr>

                    <tr>
                        <td>Persediaan & Stok</td>
                        <td class="amount">${formatCurrency((report.aktiva_lancar?.persediaan_sparepart || 0) + (report.aktiva_lancar?.stok_mobil || 0))}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Stok Sparepart</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.persediaan_sparepart || 0)}</td>
                    </tr>
                    <tr class="sub-item">
                        <td>◦ Stok Unit Mobil (Inventory)</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.stok_mobil || 0)}</td>
                    </tr>
                    
                    <tr class="total-row">
                        <td>TOTAL AKTIVA LANCAR</td>
                        <td class="amount">${formatCurrency(report.aktiva_lancar?.total_aktiva_lancar || 0)}</td>
                    </tr>

                    <tr class="section-title">
                        <td colspan="2">AKTIVA TETAP</td>
                    </tr>
                    ${report.aktiva_tetap?.detail_aset?.map((aset: any) => `
                        <tr>
                            <td>${aset.kode} - ${aset.nama}</td>
                            <td class="amount">${formatCurrency(aset.harga_beli)}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Tidak ada aset tetap</td></tr>'}
                    
                    <tr class="total-row">
                        <td>TOTAL AKTIVA TETAP</td>
                        <td class="amount">${formatCurrency(report.aktiva_tetap?.total_aktiva_tetap || 0)}</td>
                    </tr>

                    <tr style="height: 15px;"></tr>
                    <tr class="grand-total">
                        <td>TOTAL AKTIVA (ASSETS)</td>
                        <td class="amount">${formatCurrency(report.total_aktiva || 0)}</td>
                    </tr>

                    <tr style="height: 25px;"></tr>

                    <tr class="section-title">
                        <td colspan="2">KEWAJIBAN / HUTANG</td>
                    </tr>
                    <tr>
                        <td>Hutang Pembelian (Part & Mobil)</td>
                        <td class="amount">${formatCurrency((report.hutang?.hutang_part || 0) + (report.hutang?.hutang_mobil || 0))}</td>
                    </tr>
                    <tr>
                        <td>Hutang Investor & Pihak Ketiga</td>
                        <td class="amount">${formatCurrency(report.hutang?.hutang_investor || 0)}</td>
                    </tr>
                    <tr>
                        <td>Kewajiban Lainnya</td>
                        <td class="amount">${formatCurrency(report.hutang?.hutang_lainnya || 0)}</td>
                    </tr>
                    <tr class="total-row">
                        <td>TOTAL KEWAJIBAN</td>
                        <td class="amount">${formatCurrency(report.hutang?.total_hutang || 0)}</td>
                    </tr>

                    <tr class="section-title">
                        <td colspan="2">MODAL / EKUITAS</td>
                    </tr>
                    <tr>
                        <td>Modal Disetor (Cash & Aset)</td>
                        <td class="amount">${formatCurrency(report.modal?.setoran_modal || 0)}</td>
                    </tr>
                    <tr>
                        <td>Laba Ditahan (Retained Earnings)</td>
                        <td class="amount">${formatCurrency(report.modal?.laba_ditahan || 0)}</td>
                    </tr>
                    <tr>
                        <td>Prive (Pengambilan Pemilik)</td>
                        <td class="amount negative">(${formatCurrency(report.modal?.prive || 0)})</td>
                    </tr>
                    <tr class="total-row">
                        <td>TOTAL MODAL</td>
                        <td class="amount">${formatCurrency(report.modal?.total_modal || 0)}</td>
                    </tr>

                    <tr style="height: 15px;"></tr>
                    <tr class="grand-total" style="background-color: #7c3aed;">
                        <td>TOTAL PASIVA (LIABILITIES + EQUITY)</td>
                        <td class="amount">${formatCurrency(report.total_pasiva || 0)}</td>
                    </tr>
                </table>

                <div class="balance-box ${report.is_balanced ? 'balance-balanced' : 'balance-unbalanced'}">
                    <div style="font-weight: 900; font-size: 12px; margin-bottom: 5px; text-transform: uppercase;">
                        Status Neraca: ${report.is_balanced ? 'SEIMBANG (BALANCED)' : 'TERDAPAT SELISIH'}
                    </div>
                    <div style="font-size: 10px;">
                        Selisih: ${formatCurrency(report.selisih || 0)}
                    </div>
                </div>

                <div class="footer">
                    Laporan Neraca TPM Finance System<br/>
                    Dicetak pada ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeID })}
                </div>
            </body>
            </html>
        `;
    };

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!report) return;
        setIsExporting(true);
        try {
            const html = buildNeracaExportHtml();
            
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
                    link.download = `Neraca_${getHeaderDate().replace(/ /g, '_')}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Laporan Neraca',
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
                        <Typography variant="body1" weight="bold" className="text-slate-900">Preview Neraca</Typography>
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
                                title="Neraca Preview"
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
