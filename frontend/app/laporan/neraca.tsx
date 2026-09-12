import { appAlert } from '../../utils/appAlert';
import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import {
    Landmark, Banknote, Box,
    Download, X, Scale, AlertTriangle, CheckCircle, CreditCard,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, endOfMonth, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../../components/ui/Card';
import { formatCurrencyDisplay } from '../../utils/format';
import { useNeracaReport } from '../../hooks/useKeuangan';
import { buildNeracaExportHtml } from '../../utils/reportTemplates';
import { FinancialRow } from '../../components/ui/FinancialRow';
import { NeracaReport } from '../../types/reports';
import {
    ReportPageHeader,
    ReportDateControls,
    ReportExportSheet,
    ReportFilterType,
} from '../../components/laporan';

export default function NeracaScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const { themeColors } = useUIStore();

    // Label kas unit sesuai laporan Excel (bukan kode backend mentah).
    const kasUnitLabel = (unit: unknown) => {
        const u = String(unit ?? '').toUpperCase();
        return u === 'JUAL_BELI_MOBIL' ? 'KAS UNIT MOBIL'
            : u === 'BENGKEL' ? 'KAS UNIT BENGKEL'
            : u === 'JASA_ANGKUT' ? 'KAS UNIT JASA ANGKUT'
            : u;
    };

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

    const {
        totalHutangExternal,
        totalAktivaLancarAdj,
        totalStokAdj,
        stockBreakdown,
        totalLabaAdj,
        adjUnitCashDetails,
    } = useMemo(() => {
        const h = report?.hutang || {} as any;
        const al = report?.aktiva_lancar || {} as any;
        const m = report?.modal || {} as any;

        // 1. Gunakan total_hutang langsung dari backend (sudah termasuk semua komponen)
        const hExt = h.total_hutang || 0;

        // 2. Capitalized Stock detail, including workshop repairs linked to JB Mobil.
        const stockDetails = al.stok_mobil_detail || [];
        const stockFromDetails = stockDetails.reduce((acc: number, item: any) => acc + (item.total || 0), 0);
        const sAdj = al.stok_mobil || stockFromDetails || 0;
        const stockBreakdown = stockDetails.reduce((acc: any, item: any) => ({
            harga_beli: acc.harga_beli + Number(item.harga_beli || 0),
        }), {
            harga_beli: 0,
        });

        // 3. Laba Ditahan: gunakan nilai dari backend cross_validation
        const lAdj = m.laba_ditahan ?? report?.cross_validation?.retained_earnings ?? report?.cross_validation?.laba_bersih_from_base ?? 0;

        // 4. Total Aktiva & Pasiva: gunakan langsung dari backend sebagai sumber kebenaran
        // Backend sudah menghitung dengan benar termasuk semua komponen aktiva
        const aAdj = report?.total_aktiva || 0;
        const alAdj = al.total_aktiva_lancar || (aAdj - (report?.aktiva_tetap?.total_aktiva_tetap || 0));
        const pAdj = report?.total_pasiva || aAdj;

        const adjUnitCashDetails = Array.isArray(al.unit_cash_details)
            ? al.unit_cash_details
            : Object.entries(al.unit_details || {}).map(([unit, total_cash]) => ({
                unit,
                total_cash: Number(total_cash || 0),
            }));

        return {
            totalHutangExternal: hExt,
            totalStokAdj: sAdj,
            stockBreakdown,
            totalLabaAdj: lAdj,
            adjUnitCashDetails,
            totalAktivaLancarAdj: alAdj,
        };
    }, [report]);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    }, [navigation, router]);

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
                        <Typography variant="body2" weight="bold" className={totalAktivaLancarAdj < 0 ? "text-red-600" : "text-emerald-800"}>
                            {formatCurrencyDisplay(totalAktivaLancarAdj)}
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
                            {adjUnitCashDetails?.map((u: any, i: number) => (
                                <FinancialRow
                                    key={i}
                                    label={kasUnitLabel(u.unit)}
                                    value={u.total_cash}
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
                            <FinancialRow label="Piutang Lainnya / Manual Unit" value={al.piutang_lainnya} small />
                            {(al.piutang_karyawan || 0) > 0 && <FinancialRow label="Piutang Karyawan (Kasbon)" value={al.piutang_karyawan} small />}
                            <FinancialRow label="Piutang Unit Bengkel" value={al.piutang_usaha || 0} small />
                            <FinancialRow label="Piutang Unit Mobil" value={al.piutang_mobil || 0} small />
                            <FinancialRow label="Piutang Jasa Angkut" value={al.piutang_jasa_angkut || 0} small />
                            <Typography variant="caption" className="text-slate-400 text-[10px] mt-1">Total Piutang = akumulasi sejak awal sistem per tanggal sama.</Typography>
                            <View className="h-[1px] bg-slate-100 w-full my-2" />
                            <FinancialRow label="Total Piutang" value={al.total_piutang || 0} bold color="text-indigo-700" />
                        </View>
                    </View>

                    <View className="w-full">
                        <View className="flex-row items-center mb-2">
                            <View className="w-1 h-3.5 bg-amber-500 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest text-[10px]">Persediaan & Stok</Typography>
                        </View>
                        <View className="w-full pl-3">
                            <FinancialRow label="Persediaan Sparepart" value={al.persediaan_sparepart} small />
                            <FinancialRow label="Stok Mobil (Inventory)" value={totalStokAdj} small />
                            {(totalStokAdj || 0) > 0 && (
                                <View className="bg-amber-50/60 w-full p-3 rounded-xl border border-amber-100 mt-2">
                                    <FinancialRow label="Harga Beli Unit" value={stockBreakdown.harga_beli || totalStokAdj} small indent />
                                </View>
                            )}
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
                        <Typography variant="body2" weight="bold" className={(at.total_aktiva_tetap || 0) < 0 ? "text-red-600" : "text-indigo-800"}>
                            {formatCurrencyDisplay(at.total_aktiva_tetap || 0)}
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
                        <Typography variant="body2" weight="bold" className={(m.total_modal || 0) < 0 ? "text-red-600" : "text-violet-800"}>
                            {formatCurrencyDisplay(m.total_modal || 0)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <View className="mb-4 w-full">
                        <FinancialRow label="Modal" value={m.total_modal} bold large />
                    </View>

                    <View className="mb-4 w-full">
                        <FinancialRow label="2. Laba Ditahan" value={totalLabaAdj} bold large color="text-violet-700" />
                    </View>

                    <View className="mb-4 w-full">
                        <FinancialRow label="Penyesuaian Harga Beli Spare Part (Memo)" value={m.penyesuaian_harga_beli_sparepart} bold large color="text-violet-700" />
                        <Typography variant="caption" className="text-slate-400 text-[10px] mt-1">Informasi saja — stok sudah dinilai historical cost, tidak menambah/mengurangi total modal.</Typography>
                    </View>

                    <View className="mb-4 w-full">
                        <FinancialRow label="3. Prive (Pengambilan Pemilik)" value={m.prive} isNegative bold large />
                        <Typography variant="caption" className="text-slate-400 text-[10px] mt-1">Prive kumulatif; Prive Laba Rugi = periode berjalan saja.</Typography>
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
                        <Typography variant="body2" weight="bold" className={totalHutangExternal < 0 ? "text-red-600" : "text-rose-800"}>
                            {formatCurrencyDisplay(totalHutangExternal)}
                        </Typography>
                    </View>
                </View>

                <View className="p-5 w-full">
                    <FinancialRow label="1. Hutang Pembelian Part" value={h.hutang_part} small large />
                    <FinancialRow label="2. Hutang Pembelian Mobil" value={h.hutang_mobil} small large />
                    <FinancialRow label="3. Hutang Investor" value={h.hutang_investor} small large />
                    <Typography variant="caption" className="text-slate-400 text-[10px] mt-1">Cerminan Dana Investor di Perubahan Modal — berkurang saat unit terjual & dana cair ke investor.</Typography>
                    <FinancialRow label="4. Hutang Lainnya / Manual Unit" value={h.hutang_lainnya} small large />
                    {(h.hutang_jasa_angkut || 0) > 0 && (
                        <FinancialRow label="5. Hutang Jasa Angkut" value={h.hutang_jasa_angkut} small large />
                    )}
                    {(h.uang_muka_penjualan || 0) > 0 && (
                        <FinancialRow label="Uang Muka Penjualan" value={h.uang_muka_penjualan} small large />
                    )}
                    {(h.piutang_booking || 0) > 0 && (
                        <FinancialRow label="Sisa Kewajiban Booking Mobil" value={h.piutang_booking} small large />
                    )}

                    <View className="h-[1px] bg-slate-100 w-full my-3" />
                    <View className="w-full bg-rose-50 p-4 rounded-xl border border-rose-100/50">
                        <FinancialRow label="Total Hutang" value={totalHutangExternal} bold large color="text-rose-800" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderBalanceCheck = () => {
        if (!report) return null;
        // Gunakan data dari backend sebagai sumber kebenaran utama
        const selisih = report.selisih || 0;
        const isBalanced = report.is_balanced ?? (Math.abs(selisih) < 100);

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
                    <FinancialRow label="Total Aktiva" value={report.total_aktiva || 0} isDark small />
                    <FinancialRow label="Total Pasiva (Hutang + Modal)" value={report.total_pasiva || 0} isDark small />
                    <View className="h-[1px] bg-white/20 w-full my-3" />
                    <View className="flex-row justify-between items-center w-full">
                        <Typography className="text-white/60 text-xs flex-1">Selisih Neraca</Typography>
                        {(() => {
                            const isNegSelisih = selisih < 0;
                            const selisihDisplay = formatCurrencyDisplay(selisih);
                            const selisihColor = Math.abs(selisih) < 100
                                ? 'text-emerald-300'
                                : (isNegSelisih ? 'text-red-400' : 'text-amber-300');
                            return (
                                <Typography variant="h4" weight="bold" className={selisihColor}>
                                    {selisihDisplay}
                                </Typography>
                            );
                        })()}
                    </View>
                </View>

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
                <Typography variant="caption" className="text-slate-100/70 text-[10px] mt-3 leading-relaxed">
                    Aktiva = Kas & Bank + Piutang + Persediaan + Stok Mobil + Aset Tetap. Pasiva = Hutang + Modal (Setoran + Laba Ditahan − Prive). Selisih ≠ 0 = ada transaksi belum tercatat / salah pos.
                </Typography>
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
            appAlert('Error', 'Gagal memproses laporan');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <ReportPageHeader
                title="Neraca"
                subtitle="Laporan Posisi Keuangan"
                onBack={handleBack}
                onExport={() => setShowExportMenu(true)}
                isExporting={isExporting}
            />

            <ScrollView
                className="flex-1"
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={refetch} />}
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
                                    <Typography weight="bold" className={(report?.total_aktiva || 0) < 0 ? "text-red-400" : "text-white"}>{formatCurrencyDisplay(report?.total_aktiva || 0)}</Typography>
                                </View>
                                <View className="w-[1px] bg-slate-700/50 mx-4" />
                                <View className="flex-1 items-end">
                                    <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Pasiva</Typography>
                                    <Typography weight="bold" className={(report?.total_pasiva || 0) < 0 ? "text-red-400" : "text-white"}>{formatCurrencyDisplay(report?.total_pasiva || 0)}</Typography>
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
                        {renderBalanceCheck()}
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
            {showPdfPreview && (
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
            )}
        </SafeAreaView>
    );
}
