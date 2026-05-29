import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import {
    ChevronLeft, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, Wallet,
    Download, Eye, X, AlertTriangle, Building, Printer, Scale, CheckCircle
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Typography } from '../../components/ui/Typography';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';
import { useCapitalReport } from '../../hooks/useKeuangan';
import { buildCapitalExportHtml } from '../../utils/reportTemplates';
import { FinancialRow } from '../../components/ui/FinancialRow';
import { CapitalReport } from '../../types/reports';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LaporanPerubahanModalScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const { themeColors } = useUIStore();

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
        if (filterType === 'daily') return format(date, 'dd MMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [date, filterType]);

    const reportParams = useMemo(() => {
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
    }, [date, filterType]);

    const { data, isLoading, refetch } = useCapitalReport(reportParams);
    const report = data as CapitalReport | undefined;

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    }, [navigation, router]);

    const equity = useMemo(() => {
        if (!report) {
            return {
                modalAwal: 0,
                setoranKas: 0,
                modalNonKas: 0,
                investorFunding: 0,
                labaBersih: 0,
                prive: 0,
                pembayaranInvestor: 0,
                modalAkhir: 0,
                perubahanBersih: 0,
                expectedModalAkhir: 0,
                selisih: 0,
                isBalanced: true,
                status: 'UNKNOWN',
            };
        }

        const r = report;
        const modalAwal = r.modal_awal || 0;
        const setoranKas = r.penambahan?.setoran_modal || 0;
        const modalNonKas = r.penambahan?.modal_non_kas?.total || 0;
        const investorFunding = r.penambahan?.investor_funding || 0;
        const labaBersih = r.info?.laba_bersih || 0;
        const prive = (r.pengurangan?.prive || 0) + (r.pengurangan?.pengembalian_modal || 0);
        const pembayaranInvestor = r.pengurangan?.pembayaran_investor || 0;
        const modalAkhir = r.modal_akhir || 0;
        
        const perubahanBersih = setoranKas + modalNonKas + investorFunding + labaBersih - prive - pembayaranInvestor;
        const expectedModalAkhir = modalAwal + perubahanBersih;
        
        // Use the same values shown on screen for reconciliation. Backend
        // `selisih` can include diagnostic fields that are not part of this
        // displayed equity flow.
        const selisih = modalAkhir - expectedModalAkhir;
        const isBalanced = Math.abs(selisih) < 100;

        return {
            modalAwal,
            setoranKas,
            modalNonKas,
            investorFunding,
            labaBersih,
            prive,
            pembayaranInvestor,
            modalAkhir,
            perubahanBersih,
            expectedModalAkhir,
            selisih,
            isBalanced,
            status: isBalanced ? 'BALANCE' : 'UNBALANCED',
        };
    }, [report]);

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!report) return;
        setIsExporting(true);
        try {
            const html = buildCapitalExportHtml(report, date, filterType);

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
                    link.download = `PerubahanModal_${formattedDate.replace(/ /g, '_')}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Laporan Perubahan Modal',
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

    const StatCard = ({ label, value, icon: Icon, subLabel, bgColor }: any) => (
        <View className="flex-1 p-5 rounded-[28px] shadow-sm border border-white/10 mr-2" style={{ backgroundColor: bgColor || '#1e293b' }}>
            <View className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center mb-3">
                <Icon size={18} color="white" />
            </View>
            <Typography variant="caption" weight="bold" className="text-white/70 mb-1 uppercase tracking-wider">{label}</Typography>
            <Typography variant="h4" weight="bold" className="text-white mb-1">{formatCurrency(value)}</Typography>
            {subLabel && <Typography variant="caption" className="text-white/50 text-[10px] italic leading-tight">{subLabel}</Typography>}
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
            <Stack.Screen options={{ headerShown: false }} />

            <View className="bg-slate-50 px-4 pt-2 pb-6 z-20 rounded-b-[40px] shadow-sm">
                <View className="flex-row items-center justify-between mb-6">
                    <View className="flex-row items-center">
                        <Pressable onPress={handleBack} className="w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm">
                            <ChevronLeft size={20} color={themeColors.text} />
                        </Pressable>
                        <View className="ml-3">
                            <Typography variant="h4" weight="bold" className="text-slate-900">Perubahan Ekuitas</Typography>
                            <Typography variant="caption" weight="medium" className="text-slate-400">Capital Statement</Typography>
                        </View>
                    </View>
                    <Pressable
                        onPress={() => setShowExportMenu(true)}
                        disabled={isExporting || isLoading}
                        className={`w-10 h-10 rounded-full items-center justify-center shadow-sm ${isExporting ? 'bg-slate-100' : 'bg-white border border-slate-100'}`}
                    >
                        {isExporting ? <ActivityIndicator size="small" color={themeColors.primary} /> : <Download size={18} color={themeColors.primary} />}
                    </Pressable>
                </View>

                <View className="flex-row bg-slate-200/50 p-1.5 rounded-2xl mb-6">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => setFilterType(type)}
                            className={`flex-1 py-2.5 items-center justify-center rounded-xl ${filterType === type ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Typography variant="caption" weight="bold" className={filterType === type ? 'text-indigo-600' : 'text-slate-400'}>
                                {type === 'daily' ? 'HARIAN' : type === 'monthly' ? 'BULANAN' : 'TAHUNAN'}
                            </Typography>
                        </Pressable>
                    ))}
                </View>

                <View className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 flex-row items-center">
                    <Pressable onPress={handlePrev} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                        <ChevronLeft size={18} color={themeColors.text} />
                    </Pressable>
                    <View className="flex-1 flex-row items-center justify-center">
                        <Calendar size={16} color={themeColors.primary} className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-slate-800 capitalize">
                            {formattedDate}
                        </Typography>
                    </View>
                    <Pressable onPress={handleNext} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                        <ChevronRight size={18} color={themeColors.text} />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={refetch} colors={[themeColors.primary]} />}
            >
                {isLoading && !report ? (
                    <View className="py-12 items-center justify-center">
                        <ActivityIndicator size="large" color={themeColors.primary} />
                    </View>
                ) : !report ? (
                    <View className="py-12 items-center justify-center">
                        <AlertTriangle size={48} color="#94a3b8" />
                        <Typography variant="body1" className="text-slate-500 mt-4">Data tidak tersedia</Typography>
                    </View>
                ) : (
                    <View className="space-y-5">
                        <View className="w-full rounded-[36px] p-7 shadow-2xl overflow-hidden relative" style={{ backgroundColor: '#4f46e5' }}>
                            <View className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full" />
                            <View className="absolute top-20 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full" />

                            <View className="flex-row items-start justify-between mb-6">
                                <View className="flex-1 pr-4">
                                    <Typography variant="caption" weight="bold" className="text-indigo-100 uppercase tracking-[2.5px]">Modal Akhir Periode</Typography>
                                    <Typography variant="h1" weight="bold" className="text-white mt-1" style={{ fontSize: 32 }}>{formatCurrency(equity.modalAkhir)}</Typography>
                                </View>
                                <View className="w-16 h-16 bg-white/20 rounded-2xl items-center justify-center border border-white/30">
                                    <Wallet size={32} color="white" />
                                </View>
                            </View>

                            <View className="pt-5 border-t border-white/20 flex-row justify-between items-center">
                                <Typography variant="caption" className="text-indigo-100">
                                    Status: <Typography variant="caption" weight="bold" className="text-white">{equity.status}</Typography>
                                </Typography>
                                {equity.isBalanced ? (
                                    <View className="bg-emerald-400/90 px-3 py-1 rounded-full">
                                        <Typography variant="caption" weight="bold" className="text-white text-[10px]">BALANCE</Typography>
                                    </View>
                                ) : (
                                    <View className="bg-amber-500 px-3 py-1 rounded-full">
                                        <Typography variant="caption" weight="bold" className="text-white text-[10px]">SELISIH</Typography>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View className="flex-row">
                            <StatCard label="MODAL AWAL" value={equity.modalAwal} icon={Building} bgColor="#334155" subLabel="Saldo Awal" />
                            <StatCard label="LABA BERSIH" value={equity.labaBersih} icon={ArrowUpRight} bgColor="#059669" subLabel="Laba Periode" />
                        </View>

                        <View className="flex-row -mt-1">
                            <StatCard label="SETORAN" value={equity.setoranKas + equity.modalNonKas + equity.investorFunding} icon={Wallet} bgColor="#4f46e5" subLabel="Kas + Non-Kas + Investor" />
                            <StatCard label="PRIVE" value={equity.prive + equity.pembayaranInvestor} icon={ArrowDownLeft} bgColor="#e11d48" subLabel="Pengambilan Modal" />
                        </View>

                        <Card className="p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm mt-2">
                            <Typography variant="body1" weight="bold" className="text-slate-900 mb-5">Rincian Perubahan Ekuitas</Typography>

                            <FinancialRow label="Modal Awal" value={equity.modalAwal} bold color="text-slate-900" />

                            <View className="mt-4 pt-4 border-t border-slate-50">
                                <Typography variant="caption" weight="bold" className="text-emerald-600 mb-2 uppercase tracking-widest">Penambahan</Typography>
                                {equity.setoranKas > 0 && (
                                    <FinancialRow label="Setoran Modal Kas" value={equity.setoranKas} color="text-emerald-700" />
                                )}
                                {equity.modalNonKas > 0 && (
                                    <FinancialRow label="Setoran Modal Non-Kas" value={equity.modalNonKas} color="text-emerald-700" />
                                )}
                                {equity.investorFunding > 0 && (
                                    <FinancialRow label="Dana Investor Mobil" value={equity.investorFunding} color="text-emerald-700" />
                                )}
                                <FinancialRow label={equity.labaBersih >= 0 ? 'Laba Bersih Periode' : 'Rugi Periode'} value={Math.abs(equity.labaBersih)} isNegative={equity.labaBersih < 0} color={equity.labaBersih >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
                            </View>

                            <View className="mt-4 pt-4 border-t border-slate-50">
                                <Typography variant="caption" weight="bold" className="text-rose-600 mb-2 uppercase tracking-widest">Pengurangan</Typography>
                                {equity.prive > 0 ? (
                                    <FinancialRow label="Prive / Pengambilan Pemilik" value={equity.prive} isNegative />
                                ) : (
                                    <FinancialRow label="Prive / Pengambilan Pemilik" value={0} />
                                )}
                                {equity.pembayaranInvestor > 0 && (
                                    <FinancialRow label="Pembayaran Investor Mobil" value={equity.pembayaranInvestor} isNegative />
                                )}
                            </View>

                            <View className="mt-4 pt-5 border-t-2 border-slate-100">
                                <FinancialRow label="Perubahan Bersih Modal" value={equity.perubahanBersih} bold color="text-slate-700" />
                                <FinancialRow label="Modal Akhir Periode (Teoritis)" value={equity.expectedModalAkhir} bold color="text-indigo-700" />
                            </View>
                        </Card>

                        {/* KESEIMBANGAN MODAL (BALANCE CHECK) */}
                        <View className={`mt-4 rounded-[28px] overflow-hidden p-6 ${equity.isBalanced ? 'bg-indigo-600' : 'bg-amber-600'} shadow-md relative w-full`}>
                            <View className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
                            <View className="absolute -bottom-10 -left-10 w-20 h-20 bg-black/5 rounded-full" />

                            <View className="flex-row items-center mb-5">
                                <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center mr-3">
                                    <Scale size={20} color="white" />
                                </View>
                                <View>
                                    <Typography variant="body1" weight="bold" className="text-white tracking-tight">Keseimbangan Ekuitas</Typography>
                                    <Typography variant="caption" className="text-white/60 uppercase tracking-widest text-[9px] mt-0.5">Capital Balance Check</Typography>
                                </View>
                            </View>

                            <View className="bg-white/10 rounded-2xl p-4 border border-white/10 mb-4 w-full">
                                <FinancialRow label="Modal Akhir (Aktual - Neraca)" value={equity.modalAkhir} isDark small />
                                <FinancialRow label="Modal Akhir (Teoritis - Aliran)" value={equity.expectedModalAkhir} isDark small />
                                <View className="h-[1px] bg-white/20 w-full my-2" />
                                <View className="flex-row justify-between items-center w-full">
                                    <Typography className="text-white/60 text-xs flex-1">Selisih Rekonsiliasi</Typography>
                                    <Typography variant="h4" weight="bold" className={equity.isBalanced ? "text-emerald-300" : "text-amber-300"}>
                                        {formatCurrency(equity.selisih)}
                                    </Typography>
                                </View>
                            </View>

                            <View className={`flex-row items-center justify-center p-3 rounded-xl w-full border ${equity.isBalanced ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                                {equity.isBalanced ? (
                                    <View className="flex-row items-center">
                                        <CheckCircle size={16} color="#6EE7B7" />
                                        <Typography weight="bold" className="text-emerald-300 ml-2 tracking-wide uppercase text-xs">MUTASI & NERACA SEIMBANG</Typography>
                                    </View>
                                ) : (
                                    <View className="flex-row items-center">
                                        <AlertTriangle size={16} color="#FDE68A" />
                                        <Typography weight="bold" className="text-amber-200 ml-2 tracking-wide uppercase text-xs">TERDAPAT SELISIH REKONSILIASI</Typography>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            <Modal visible={showExportMenu} transparent animationType="fade">
                <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setShowExportMenu(false)}>
                    <View className="bg-white rounded-t-[40px] p-8">
                        <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-8" />
                        <Typography variant="h4" weight="bold" className="text-slate-900 mb-6 text-center">Ekspor Laporan</Typography>

                        <View className="space-y-4">
                            <Pressable onPress={() => handleExportPDF('preview')} className="flex-row items-center p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                                <View className="w-12 h-12 bg-indigo-100 rounded-2xl items-center justify-center mr-4"><Eye size={22} color="#4f46e5" /></View>
                                <View className="flex-1">
                                    <Typography variant="body1" weight="bold" className="text-slate-900">Preview Laporan</Typography>
                                    <Typography variant="caption" className="text-slate-500">Lihat tampilan PDF secara instan</Typography>
                                </View>
                            </Pressable>

                            <Pressable onPress={() => handleExportPDF('print')} className="flex-row items-center p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                                <View className="w-12 h-12 bg-emerald-100 rounded-2xl items-center justify-center mr-4"><Printer size={22} color="#059669" /></View>
                                <View className="flex-1">
                                    <Typography variant="body1" weight="bold" className="text-slate-900">Cetak / Simpan PDF</Typography>
                                    <Typography variant="caption" className="text-slate-500">Kirim ke printer atau simpan ke file</Typography>
                                </View>
                            </Pressable>
                        </View>

                        <Pressable onPress={() => setShowExportMenu(false)} className="mt-8 py-5 items-center justify-center">
                            <Typography variant="body1" weight="bold" className="text-rose-500">Batalkan</Typography>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* PDF PREVIEW MODAL */}
            <Modal visible={showPdfPreview} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
                        <Pressable onPress={() => setShowPdfPreview(false)} className="p-2"><X size={24} color="#64748b" /></Pressable>
                        <Typography variant="body1" weight="bold">Pratinjau Laporan</Typography>
                        <Pressable onPress={() => handleExportPDF('print')} className="p-2"><Printer size={24} color="#4f46e5" /></Pressable>
                    </View>
                    <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
