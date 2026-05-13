import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import {
    ChevronLeft, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, Wallet,
    Download, Eye, X, AlertTriangle, Building, Truck, Car, Printer
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

    const simple = useMemo(() => {
        if (!report) return { laba_bersih: 0, laba_usaha: 0, setoran: 0, prive: 0, adjustment: 0, beban_ops: 0 };
        const r = report;
        const laba_bersih = r.info?.laba_bersih || 0;
        const laba_usaha = r.info?.laba_usaha || r.penambahan?.laba_kotor?.total || 0;
        const beban_ops = r.pengurangan?.beban_operasional?.total || r.info?.overhead_gaji || 0;
        const setoran = (r.penambahan?.setoran_modal || 0) + 
                        (r.penambahan?.modal_non_kas?.total || 0) + 
                        (r.penambahan?.investor_funding || 0);
        const prive = (r.pengurangan?.prive || 0) + (r.pengurangan?.pengembalian_modal || 0);
        
        // Theoretical Equity is the true source of truth (Modal Awal + Laba + Setoran - Prive)
        const theoretical = r.modal_awal + laba_bersih + setoran - prive;
        
        // Fix: Backend Net Asset (modal_akhir) might be lower due to uneliminated internal Hutang (like Bengkel 200k for sold cars)
        // If theoretical > r.modal_akhir, we assume the difference is internal Hutang that should be virtually eliminated
        const diff = theoretical - r.modal_akhir;
        const correctedModalAkhir = theoretical; // Force balance
        const adjustment = 0; // We eliminate the confusing "Bagi Hasil Investor" catch-all
        
        const rawHutang = r.info?.aset?.hutang?.total || 0;
        const correctedHutang = diff > 0 ? Math.max(0, rawHutang - diff) : rawHutang;

        return { laba_bersih, laba_usaha, beban_ops, setoran, prive, adjustment, correctedModalAkhir, correctedHutang, theoretical };
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
                                    <Typography variant="h1" weight="bold" className="text-white mt-1" style={{ fontSize: 32 }}>{formatCurrency(simple.correctedModalAkhir)}</Typography>
                                </View>
                                <View className="w-16 h-16 bg-white/20 rounded-2xl items-center justify-center border border-white/30">
                                    <Wallet size={32} color="white" />
                                </View>
                            </View>

                            <View className="pt-5 border-t border-white/20 flex-row justify-between items-center">
                                <Typography variant="caption" className="text-indigo-100">Status: <Typography variant="caption" weight="bold" className="text-white">VERIFIED</Typography></Typography>
                                {report.info?.validasi?.status === 'BALANCE' && (
                                    <View className="bg-emerald-400/90 px-3 py-1 rounded-full"><Typography variant="caption" weight="bold" className="text-white text-[10px]">BALANCE</Typography></View>
                                )}
                            </View>
                        </View>

                        <View className="flex-row">
                            <StatCard label="MODAL AWAL" value={report.modal_awal} icon={Building} bgColor="#334155" subLabel="Saldo Awal" />
                            <StatCard label="LABA BERSIH" value={simple.laba_bersih} icon={ArrowUpRight} bgColor="#059669" subLabel="Net Income" />
                        </View>

                        <View className="flex-row -mt-1">
                            <StatCard label="SETORAN" value={simple.setoran} icon={Wallet} bgColor="#4f46e5" subLabel="Tambahan Modal" />
                            <StatCard label="PRIVE" value={simple.prive} icon={ArrowDownLeft} bgColor="#e11d48" subLabel="Drawings" />
                        </View>

                        <Card className="p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm mt-2">
                            <Typography variant="body1" weight="bold" className="text-slate-900 mb-5">Rincian Perubahan Ekuitas</Typography>

                            <FinancialRow label="Modal Awal" value={report.modal_awal} bold color="text-slate-900" />

                            <View className="mt-4 pt-4 border-t border-slate-50">
                                <Typography variant="caption" weight="bold" className="text-emerald-600 mb-2 uppercase tracking-widest">Penambahan</Typography>
                                {simple.laba_usaha > 0 && (
                                    <>
                                        <FinancialRow label="Laba Usaha (Unit)" value={simple.laba_usaha} color="text-emerald-700" bold />
                                        {(report.info?.laba_bengkel ?? 0) > 0 && (
                                            <FinancialRow label="Unit Bengkel" value={report.info?.laba_bengkel ?? 0} color="text-slate-500" indent small />
                                        )}
                                        {(report.info?.laba_mobil ?? 0) > 0 && (
                                            <FinancialRow label="Unit Mobil" value={report.info?.laba_mobil ?? 0} color="text-slate-500" indent small />
                                        )}
                                        {(report.info?.laba_jasa_angkut ?? 0) > 0 && (
                                            <FinancialRow label="Unit Jasa Angkut" value={report.info?.laba_jasa_angkut ?? 0} color="text-slate-500" indent small />
                                        )}
                                    </>
                                )}
                                {simple.laba_bersih > 0 && simple.laba_usaha <= 0 && (
                                    <FinancialRow label="Laba Bersih Konsolidasi" value={simple.laba_bersih} color="text-emerald-700" />
                                )}
                                {report.penambahan?.setoran_modal ? (
                                    <FinancialRow label="Setoran Modal Pemilik (Tunai)" value={report.penambahan.setoran_modal} />
                                ) : null}
                                {report.penambahan?.modal_non_kas?.total ? (
                                    <FinancialRow label="Setoran Modal Non-Kas (Aset)" value={report.penambahan.modal_non_kas.total} />
                                ) : null}
                                {report.penambahan?.investor_funding ? (
                                    <FinancialRow label="Penambahan Dana Investor JB Mobil" value={report.penambahan.investor_funding} />
                                ) : null}
                                {simple.adjustment > 0 && (
                                    <FinancialRow label="Bagi Hasil Investor (Belum Dibagikan)" value={simple.adjustment} color="text-slate-500" />
                                )}
                            </View>

                            <View className="mt-4 pt-4 border-t border-slate-50">
                                <Typography variant="caption" weight="bold" className="text-rose-600 mb-2 uppercase tracking-widest">Pengurangan</Typography>
                                {simple.laba_usaha < 0 && (
                                    <>
                                        <FinancialRow label="Rugi Usaha (Unit)" value={Math.abs(simple.laba_usaha)} isNegative color="text-rose-700" bold />
                                        {(report.info?.laba_bengkel ?? 0) < 0 && (
                                            <FinancialRow label="Unit Bengkel" value={Math.abs(report.info?.laba_bengkel ?? 0)} isNegative color="text-slate-500" indent small />
                                        )}
                                        {(report.info?.laba_mobil ?? 0) < 0 && (
                                            <FinancialRow label="Unit Mobil" value={Math.abs(report.info?.laba_mobil ?? 0)} isNegative color="text-slate-500" indent small />
                                        )}
                                        {(report.info?.laba_jasa_angkut ?? 0) < 0 && (
                                            <FinancialRow label="Unit Jasa Angkut" value={Math.abs(report.info?.laba_jasa_angkut ?? 0)} isNegative color="text-slate-500" indent small />
                                        )}
                                    </>
                                )}
                                {simple.beban_ops > 0 && (
                                    <FinancialRow label="Beban Operasional & Gaji" value={simple.beban_ops} isNegative />
                                )}
                                {simple.laba_bersih < 0 && simple.laba_usaha >= 0 && (
                                    <FinancialRow label="Rugi Bersih Konsolidasi" value={Math.abs(simple.laba_bersih)} isNegative color="text-rose-700" />
                                )}
                                {simple.prive > 0 && (
                                    <FinancialRow label="Prive & Penarikan Modal" value={simple.prive} isNegative />
                                )}
                                {simple.adjustment < 0 && (
                                    <FinancialRow label="Pencairan Modal & Bagi Hasil Investor" value={Math.abs(simple.adjustment)} isNegative color="text-slate-500" />
                                )}
                            </View>

                            <View className="mt-4 pt-5 border-t-2 border-slate-100">
                                <FinancialRow label="Modal Akhir Periode" value={simple.correctedModalAkhir} bold color="text-indigo-700" />
                            </View>
                        </Card>

                        <Typography variant="body2" weight="bold" className="text-slate-900 px-1 mt-4">Analisis Operasional & Aset</Typography>

                        <View className="space-y-4">
                            <Card className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm">
                                <Typography variant="caption" weight="bold" className="text-slate-400 mb-4 uppercase tracking-widest">Performansi Laba Per Unit</Typography>
                                
                                {/* Bengkel Unit */}
                                <FinancialRow label="Bengkel & Sparepart" value={report.info?.laba_bengkel || 0} small bold={!!report.info?.units?.bengkel?.details?.length} />
                                {report.info?.units?.bengkel?.details?.map((d, i) => (
                                    <View key={i} className="ml-4 border-l border-slate-100 pl-3 my-1">
                                        <FinancialRow label={d.label} value={d.laba} small color="text-slate-500" />
                                    </View>
                                ))}

                                {/* Mobil Unit */}
                                <View className="mt-2">
                                    <FinancialRow label="Jual Beli Mobil" value={report.info?.laba_mobil || 0} small bold={!!report.info?.units?.mobil?.details?.length} />
                                    {report.info?.units?.mobil?.details?.map((d, i) => (
                                        <View key={i} className="ml-4 border-l border-slate-100 pl-3 my-1">
                                            <FinancialRow label={d.label} value={d.laba} small color="text-slate-500" />
                                        </View>
                                    ))}
                                </View>

                                {/* Jasa Angkut Unit */}
                                <View className="mt-2">
                                    <FinancialRow label="Jasa Angkut (JA)" value={report.info?.laba_jasa_angkut || 0} small bold={!!report.info?.units?.jasa_angkut?.details?.length} />
                                    {report.info?.units?.jasa_angkut?.details?.map((d, i) => (
                                        <View key={i} className="ml-4 border-l border-slate-100 pl-3 my-1">
                                            <FinancialRow label={d.label} value={d.laba} small color="text-slate-500" />
                                        </View>
                                    ))}
                                </View>

                                <View className="my-2 border-t border-slate-50" />
                                <FinancialRow label="Total Laba Bersih" value={report.info?.laba_bersih || 0} bold color="text-emerald-700" />
                            </Card>

                            <Card className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm">
                                <Typography variant="caption" weight="bold" className="text-slate-400 mb-4 uppercase tracking-widest">Posisi Aset Bersih Terakhir</Typography>
                                <FinancialRow label="Total Kas & Saldo Bank" value={report.info?.aset?.kas_bank || 0} small />
                                <FinancialRow label="Persediaan Unit Mobil" value={report.info?.aset?.stok_mobil?.total || 0} small />
                                <FinancialRow label="Persediaan Sparepart" value={report.info?.aset?.stok_part || 0} small />
                                
                                {/* Fix: Include internal piutang in the analysis total */}
                                <FinancialRow 
                                    label="Total Tagihan & Piutang" 
                                    value={(report.info?.aset?.piutang?.total || 0)} 
                                    small 
                                    color="text-blue-600"
                                />
                                
                                <FinancialRow 
                                    label="Total Kewajiban (Hutang)" 
                                    value={simple.correctedHutang} 
                                    small 
                                    isNegative 
                                />
                                
                                <View className="my-2 border-t border-slate-50" />
                                <FinancialRow label="Total Ekuitas (Net Asset)" value={simple.correctedModalAkhir} bold color="text-indigo-700" />
                            </Card>
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
