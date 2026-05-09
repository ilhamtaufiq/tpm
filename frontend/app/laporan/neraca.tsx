import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Alert, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import {
    ChevronLeft, ChevronRight, Calendar, Landmark,
    ArrowUpRight, ArrowDownLeft, Banknote, Box,
    Printer, Download, Eye, X, Scale, AlertTriangle, CheckCircle, CreditCard
} from 'lucide-react-native';
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
import { buildNeracaExportHtml } from '../../utils/reportTemplates';
import { FinancialRow } from '../../components/ui/FinancialRow';
import { NeracaReport } from '../../types/reports';

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

    const headerDate = useMemo(() => {
        if (filterType === 'daily') return format(date, 'd MMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [date, filterType]);

    const reportParams = useMemo(() => {
        let end = date;
        if (filterType === 'monthly') {
            end = endOfMonth(date);
        } else if (filterType === 'yearly') {
            end = endOfYear(date);
        }
        return {
            as_of_date: format(end, 'yyyy-MM-dd'),
        };
    }, [date, filterType]);

    const { data, isLoading, refetch } = useNeracaReport(reportParams);
    const report = data as NeracaReport | undefined;

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    }, [navigation, router]);

    const handleFilterChange = (type: FilterType) => {
        setFilterType(type);
        // We don't reset date to today to preserve historical context
    };

    // ==========================================
    // RENDER SECTIONS
    // ==========================================

    const renderAktivaLancar = () => {
        const al = report?.aktiva_lancar || {} as any;
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
                            {formatCurrency(al.total_aktiva_lancar || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <View className="mb-4 w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-emerald-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">Kas & Bank</Typography>
                        </View>
                        <View className="w-full pl-3">
                            <FinancialRow label="Kas Tunai (Utama)" value={al.kas_tunai} small />
                            <FinancialRow label="Kas Bank" value={al.kas_bank} small />
                            <FinancialRow label="Kas di Unit Operasional" value={al.unit_cash} small />
                            {al.unit_details && Object.entries(al.unit_details).map(([unit, val]) => (
                                <FinancialRow
                                    key={unit}
                                    label={unit.replace('kas_unit_', '').replace(/_/g, ' ').toUpperCase()}
                                    value={val as number}
                                    small
                                    indent
                                />
                            ))}
                            <View className="h-[1px] bg-slate-100 w-full my-2" />
                            <FinancialRow label="Total Kas & Bank" value={al.total_kas_bank} bold color="text-emerald-700" />
                        </View>
                    </View>

                    <View className="mb-4 w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-blue-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">Piutang Usaha</Typography>
                        </View>
                        <View className="w-full pl-3">
                            <FinancialRow label="Piutang Lainnya" value={al.piutang_lainnya} small />
                            <FinancialRow label="Piutang Unit Mobil" value={al.piutang_mobil} small />
                            <FinancialRow label="Piutang Sparepart Mobil" value={al.piutang_part_mobil} small />
                            <FinancialRow label="Piutang Unit Jasa Angkut" value={al.piutang_jasa_angkut} small />
                            <FinancialRow label="Piutang Karyawan (Kasbon)" value={al.piutang_karyawan} small />
                            <FinancialRow label="Piutang Unit Bengkel" value={al.piutang_usaha} small />
                            
                            {/* Direct Unit-Specific Internal Receivable Rows */}
                            {report?.cross_validation?.mismatches && report.cross_validation.mismatches
                                .filter(m => m.piutang > 0)
                                .map((m, idx) => (
                                    <FinancialRow 
                                        key={`int-piutang-${idx}`} 
                                        label={`Tagihan Perbaikan ke ${m.ref}`} 
                                        value={m.piutang} 
                                        small 
                                        bold 
                                        color="text-blue-600"
                                    />
                                ))
                            }

                            <View className="h-[1px] bg-slate-100 w-full my-2" />
                            <FinancialRow label="Total Piutang" value={al.total_piutang} bold color="text-blue-700" />
                        </View>
                    </View>

                    <View className="w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-amber-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">Persediaan & Stok</Typography>
                        </View>
                        <View className="w-full pl-3">
                            <FinancialRow label="Persediaan Sparepart" value={al.persediaan_sparepart} small />
                            <FinancialRow label="Stok Mobil (Inventory)" value={al.stok_mobil} small bold={!!al.stok_mobil_detail?.length} />
                            {al.stok_mobil_detail?.map((m: any, idx: number) => (
                                <View key={idx} className="ml-4 border-l border-amber-100 pl-3 my-1">
                                    <FinancialRow label={m.nama} value={m.total} small color="text-slate-500" />
                                    {(m.biaya_persiapan > 0 || m.perbaikan_external > 0 || m.perbaikan_internal > 0) && (
                                        <Typography variant="caption" className="text-slate-400 text-[9px] -mt-1 mb-1">
                                            Beli: {formatCurrency(m.harga_beli)} 
                                            {m.biaya_persiapan > 0 && ` | Prep: ${formatCurrency(m.biaya_persiapan)}`}
                                            {(m.perbaikan_external > 0 || m.perbaikan_internal > 0) && ` | Repair: ${formatCurrency(m.perbaikan_external + m.perbaikan_internal)}`}
                                        </Typography>
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    const renderAktivaTetap = () => {
        const at = report?.aktiva_tetap || {} as any;
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
                            {formatCurrency(at.total_aktiva_tetap || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px] mb-3">Daftar Aset Aktif</Typography>
                    <View className="w-full pl-2">
                        {at.detail_aset && at.detail_aset.length > 0 ? (
                            at.detail_aset.map((aset: any, index: number) => (
                                <FinancialRow key={index} label={`${aset.kode} - ${aset.nama}`} value={aset.harga_beli} small />
                            ))
                        ) : (
                            <View className="py-4 items-center">
                                <Typography variant="caption" className="text-slate-400">Belum ada aset terdaftar</Typography>
                            </View>
                        )}
                        <View className="h-[1px] bg-slate-100 w-full my-3" />
                        <FinancialRow label="Total Aktiva Tetap" value={at.total_aktiva_tetap} bold color="text-indigo-700" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderModalSection = () => {
        const m = report?.modal || {} as any;
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
                            {formatCurrency(m.total_modal || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <View className="mb-4 w-full">
                        <FinancialRow label="1. Setoran Modal" value={m.setoran_modal} bold large />
                        {(m.setoran_modal_kas > 0 || m.modal_non_kas > 0) && (
                            <View className="bg-violet-50/50 w-full p-3 rounded-xl border border-violet-100 mt-2">
                                {m.setoran_modal_kas > 0 && <FinancialRow label="Modal Tunai (Kas)" value={m.setoran_modal_kas} small indent />}
                                {m.modal_non_kas > 0 && <FinancialRow label="Modal Non-Kas (Aset)" value={m.modal_non_kas} small indent />}
                            </View>
                        )}
                    </View>

                    {m.modal_non_kas > 0 && (m.modal_persediaan > 0 || m.modal_stok_mobil > 0 || m.modal_aset_tetap > 0) && (
                        <View className="mb-4 w-full">
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase text-[10px] tracking-wider mb-2">Detail Modal Non-Kas</Typography>
                            <View className="bg-slate-50 w-full p-4 rounded-xl border border-slate-100">
                                {m.modal_persediaan > 0 && <FinancialRow label="Persediaan Sparepart" value={m.modal_persediaan} small indent />}
                                {m.modal_stok_mobil > 0 && <FinancialRow label="Stok Mobil (Inventory)" value={m.modal_stok_mobil} small indent />}
                                {m.modal_aset_tetap > 0 && <FinancialRow label="Aset Tetap" value={m.modal_aset_tetap} small indent />}
                            </View>
                        </View>
                    )}

                    <View className="mb-4 w-full">
                        <FinancialRow label="2. Laba Ditahan" value={m.laba_ditahan} bold large color="text-violet-700" />
                    </View>

                    <View className="mb-4 w-full">
                        <FinancialRow label="3. Prive (Pengambilan Pemilik)" value={m.prive} isNegative bold large />
                    </View>
                </View>
            </Card>
        );
    };

    const renderHutangSection = () => {
        const h = report?.hutang || {} as any;
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
                            {formatCurrency(h.total_hutang || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <FinancialRow label="1. Hutang Pembelian Part" value={h.hutang_part} small large />
                    <FinancialRow label="2. Hutang Pembelian Mobil" value={h.hutang_mobil} small large />
                    <FinancialRow label="3. Hutang Investor" value={h.hutang_investor} small large />
                    <FinancialRow label="4. Hutang Lainnya" value={h.hutang_lainnya} small large />
                    
                    {/* Fallback: Show internal debt if total doesn't match the categories */}
                    {((h.total_hutang || 0) - ((h.hutang_part || 0) + (h.hutang_mobil || 0) + (h.hutang_investor || 0) + (h.hutang_lainnya || 0))) > 0 && (
                        <FinancialRow 
                            label="5. Hutang Perbaikan Stok Mobil (Internal)" 
                            value={(h.total_hutang || 0) - ((h.hutang_part || 0) + (h.hutang_mobil || 0) + (h.hutang_investor || 0) + (h.hutang_lainnya || 0))} 
                            small 
                            large 
                            color="text-rose-600"
                        />
                    )}

                    {/* Direct Unit-Specific Internal Debt Rows from cross-validation */}
                    {report?.cross_validation?.mismatches && report.cross_validation.mismatches
                        .filter(m => m.hutang > 0)
                        .map((m, idx) => (
                            <FinancialRow 
                                key={`int-debt-${idx}`} 
                                label={`Detail: Hutang Perbaikan ke ${m.ref}`} 
                                value={m.hutang} 
                                small 
                                indent 
                            />
                        ))
                    }

                    <View className="h-[1px] bg-slate-100 w-full my-3" />
                    <View className="w-full bg-rose-50 p-4 rounded-xl border border-rose-100/50">
                        <FinancialRow label="Total Hutang" value={h.total_hutang} bold large color="text-rose-800" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderAnalysisSection = () => {
        if (!report?.info?.units) return null;
        const units = report.info.units;

        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-amber-50/70 px-5 py-4 flex-row justify-between items-center border-b border-amber-100/50 w-full">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-amber-100/80 items-center justify-center mr-3">
                            <Scale size={20} className="text-amber-600" />
                        </View>
                        <View>
                            <Typography variant="h4" weight="bold" className="text-amber-900 tracking-tight">Performansi Laba Per Unit</Typography>
                            <Typography variant="caption" className="text-amber-700/60 uppercase text-[10px] tracking-wider mt-0.5">Unit Profitability Analysis</Typography>
                        </View>
                    </View>
                </View>

                <View className="p-5 w-full">
                    {/* Bengkel Unit */}
                    <FinancialRow label="Bengkel & Sparepart" value={units.bengkel?.total_laba_tpm || 0} small bold={!!units.bengkel?.details?.length} />
                    {units.bengkel?.details?.map((d, i) => (
                        <View key={i} className="ml-4 border-l border-slate-100 pl-3 my-1">
                            <FinancialRow label={d.label} value={d.laba} small color="text-slate-500" />
                        </View>
                    ))}

                    {/* Mobil Unit */}
                    <View className="mt-2">
                        <FinancialRow label="Jual Beli Mobil" value={units.mobil?.total_laba_tpm || 0} small bold={!!units.mobil?.details?.length} />
                        {units.mobil?.details?.map((d, i) => (
                            <View key={i} className="ml-4 border-l border-slate-100 pl-3 my-1">
                                <FinancialRow label={d.label} value={d.laba} small color="text-slate-500" />
                            </View>
                        ))}
                    </View>

                    {/* Jasa Angkut Unit */}
                    <View className="mt-2">
                        <FinancialRow label="Jasa Angkut (JA)" value={units.jasa_angkut?.total_laba_tpm || 0} small bold={!!units.jasa_angkut?.details?.length} />
                        {units.jasa_angkut?.details?.map((d, i) => (
                            <View key={i} className="ml-4 border-l border-slate-100 pl-3 my-1">
                                <FinancialRow label={d.label} value={d.laba} small color="text-slate-500" />
                            </View>
                        ))}
                    </View>

                    <View className="my-2 border-t border-slate-100" />
                    <FinancialRow label="Total Laba Ditahan (Hingga Saat Ini)" value={report.modal?.laba_ditahan || 0} bold color="text-emerald-700" />
                </View>
            </Card>
        );
    };

    const renderBalanceCheck = () => {
        if (!report) return null;
        const isBalanced = report.is_balanced;
        const selisih = report.selisih || 0;
        const cv = report.cross_validation || {};
        const selisihModal = report.modal?.selisih_modal || 0;

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
                    <FinancialRow label="Total Aktiva" value={report.total_aktiva} isDark small />
                    <FinancialRow label="Total Pasiva (Hutang + Modal)" value={report.total_pasiva} isDark small />
                    <View className="h-[1px] bg-white/20 w-full my-3" />
                    <View className="flex-row justify-between items-center w-full">
                        <Typography className="text-white/60 text-xs flex-1">Selisih Neraca</Typography>
                        <Typography variant="h4" weight="bold" className={Math.abs(selisih) < 100 ? "text-emerald-300" : "text-amber-300"}>
                            {formatCurrency(selisih)}
                        </Typography>
                    </View>
                </View>

                {/* Validation Sections */}
                {cv.equity_from_components !== undefined && (
                    <View className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4 w-full">
                        <Typography variant="caption" weight="bold" className="text-white/50 uppercase tracking-widest text-[9px] mb-2">Validasi Komponen Modal</Typography>
                        <FinancialRow label="Modal (Bottom-Up)" value={cv.equity_from_components} isDark small />
                        <FinancialRow label="Modal (Aktiva-Hutang)" value={cv.equity_from_identity} isDark small />
                        <View className="h-[1px] bg-white/15 w-full my-1.5" />
                        <FinancialRow label="Selisih Modal" value={cv.selisih_equity} isDark bold color={Math.abs(selisihModal) < 100 ? "text-emerald-300" : "text-amber-300"} />
                    </View>
                )}

                <View className={`flex-row items-center justify-center p-4 rounded-xl w-full border ${isBalanced ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                    {isBalanced ? (
                        <View className="flex-row items-center">
                            <CheckCircle size={20} color="#6EE7B7" />
                            <Typography weight="bold" className="text-emerald-300 ml-2 tracking-wide uppercase text-sm">NERACA SEIMBANG</Typography>
                        </View>
                    ) : (
                        <View className="flex-row items-center">
                            <AlertTriangle size={20} color="#FDE68A" />
                            <Typography weight="bold" className="text-amber-200 ml-2 tracking-wide uppercase text-sm">TERDAPAT SELISIH</Typography>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!report) return;
        setIsExporting(true);
        try {
            const html = buildNeracaExportHtml(report, date, filterType);
            
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
                    link.download = `Neraca_${headerDate.replace(/ /g, '_')}.pdf`;
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

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable onPress={handleBack} className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5">
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Neraca</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Laporan Posisi Keuangan</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <View className="bg-white/10 px-4 py-2 rounded-2xl border border-white/5 mr-2">
                            <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[10px]">{headerDate}</Typography>
                        </View>
                        <Pressable onPress={() => setShowExportMenu(true)} disabled={isExporting} className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5">
                            <Download size={22} color="white" />
                        </Pressable>
                    </View>
                </View>

                {/* Filter Tabs */}
                <View className="flex-row bg-black/20 p-1.5 rounded-2xl border border-white/5">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => handleFilterChange(type)}
                            className={`flex-1 py-2.5 items-center rounded-xl ${filterType === type ? 'bg-primary shadow-lg border border-white/10' : ''}`}
                        >
                            <Typography variant="caption" weight="bold" className={filterType === type ? 'text-white' : 'text-white/40'}>
                                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </Typography>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Date Navigator */}
            <View className="px-6 -mt-6 z-10">
                <View className="bg-surface p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                    <Pressable onPress={handlePrev} className="w-12 h-12 bg-background rounded-2xl items-center justify-center border border-gray-100">
                        <ChevronLeft size={20} color={themeColors.text} />
                    </Pressable>
                    <View className="flex-1 flex-row items-center justify-center">
                        <Calendar size={18} color={themeColors.primary} className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-text capitalize tracking-tight">{formattedDate}</Typography>
                    </View>
                    <Pressable onPress={handleNext} className="w-12 h-12 bg-background rounded-2xl items-center justify-center border border-gray-100">
                        <ChevronRight size={20} color={themeColors.text} />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4 pt-8"
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={refetch} />}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color={themeColors.primary} />
                        <Typography className="mt-4 text-textGray font-bold uppercase text-[10px] tracking-widest text-center">Mengolah Neraca...</Typography>
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

                        <View className="flex-row items-center mb-4 px-2">
                            <View className="w-2 h-8 bg-emerald-500 rounded-full mr-3" />
                            <View>
                                <Typography variant="h3" weight="bold" className="text-text tracking-tight">AKTIVA</Typography>
                                <Typography variant="caption" className="text-textGray">Harta Perusahaan</Typography>
                            </View>
                        </View>
                        {renderAktivaLancar()}
                        {renderAktivaTetap()}

                        <View className="flex-row items-center mb-4 px-2 mt-4">
                            <View className="w-2 h-8 bg-violet-500 rounded-full mr-3" />
                            <View>
                                <Typography variant="h3" weight="bold" className="text-text tracking-tight">PASIVA</Typography>
                                <Typography variant="caption" className="text-textGray">Kewajiban & Modal</Typography>
                            </View>
                        </View>
                        {renderModalSection()}
                        {renderHutangSection()}
                        {renderAnalysisSection()}
                        {renderBalanceCheck()}
                    </>
                )}
            </ScrollView>

            {/* Export Menu */}
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
                            <Pressable onPress={() => handleExportPDF('preview')} className="flex-1 bg-indigo-50 p-6 rounded-[32px] border border-indigo-100 items-center">
                                <View className="w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-indigo-200"><Eye size={28} color="white" /></View>
                                <Typography weight="bold" className="text-indigo-900">Preview</Typography>
                            </Pressable>
                            <Pressable onPress={() => handleExportPDF('print')} className="flex-1 bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 items-center">
                                <View className="w-14 h-14 bg-emerald-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-emerald-200"><Printer size={28} color="white" /></View>
                                <Typography weight="bold" className="text-emerald-900">Cetak</Typography>
                            </Pressable>
                            <Pressable onPress={() => handleExportPDF('download')} className="flex-1 bg-amber-50 p-6 rounded-[32px] border border-amber-100 items-center">
                                <View className="w-14 h-14 bg-amber-500 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-amber-200"><Download size={28} color="white" /></View>
                                <Typography weight="bold" className="text-amber-900">PDF</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Preview Modal */}
            <Modal visible={showPdfPreview} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <Pressable onPress={() => setShowPdfPreview(false)} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"><X size={20} color="#1e293b" /></Pressable>
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
                            <iframe srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }} title="Neraca Preview" />
                        ) : (
                            <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
