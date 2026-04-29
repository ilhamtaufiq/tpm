import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, Wallet, Download, Eye, Share2, X, AlertTriangle, Building, Truck, Car } from 'lucide-react-native';
import { Modal } from 'react-native';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { useUIStore } from '../../store/useUIStore';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';
import { useCapitalReport } from '../../hooks/useKeuangan';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LaporanPerubahanModalScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const { themeColors } = useUIStore();

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
        if (filterType === 'daily') return format(date, 'dd MMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
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

    const { data: report, isLoading, refetch } = useCapitalReport(getDateParams());
    const [isExporting, setIsExporting] = useState(false);
    const navigation = useNavigation();

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    };

    const handleExportPDF = async (mode: 'preview' | 'download' = 'preview') => {
        if (!report) return;
        setIsExporting(true);
        try {
            const r = report;
            const modal_awal = r.modal_awal || 0;
            const setoran = r.penambahan?.setoran_modal || 0;
            const non_kas = r.penambahan?.modal_non_kas || 0;
            const laba = r.penambahan?.laba_kotor || 0;
            const tot_penambahan = r.penambahan?.total || 0;

            const gaji = r.pengurangan?.gaji || 0;
            const lembur = r.pengurangan?.lembur || 0;
            const ops_umum = r.pengurangan?.ops_umum || 0;
            const ops_bengkel = r.pengurangan?.ops_bengkel || 0;
            const ops_mobil = r.pengurangan?.ops_mobil || 0;
            const ops_ja = r.pengurangan?.ops_ja?.total || 0;
            const prive = r.pengurangan?.prive || 0;
            const pengembalian = r.pengurangan?.pengembalian_modal || 0;
            const pelunasan_h = r.penambahan?.pelunasan_hutang || 0;
            const hutang_baru = r.pengurangan?.hutang_baru || 0;
            const bayar_hutang = r.pengurangan?.pembayaran_hutang || 0;
            const tot_pengurangan = r.pengurangan?.total || 0;

            const modal_akhir = r.modal_akhir || 0;

            const info = r.info || {};
            const aset = info.aset || {};

            const html = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        body { font-family: 'Helvetica', sans-serif; font-size: 10px; color: #000; padding: 20px; }
                        .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
                        .title { font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
                        .subtitle { font-size: 11px; margin-bottom: 3px; }
                        .date { font-size: 10px; color: #666; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { padding: 8px 4px; border-bottom: 1px solid #ddd; text-align: left; }
                        .amount { text-align: right; font-family: monospace; font-size: 11px; }
                        .section-title { font-weight: bold; background-color: #f5f5f5; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                        .total-row { font-weight: bold; background-color: #eef; border-top: 1px solid #000; }
                        .sub-row { color: #444; }
                        .italic { font-style: italic; color: #666; }
                        .text-muted { color: #666; }
                        .footer { margin-top: 30px; font-size: 9px; color: #888; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">LAPORAN PERUBAHAN MODAL</div>
                        <div class="subtitle">BENGKEL TPM</div>
                        <div class="date">Periode: ${getHeaderDate()}</div>
                    </div>

                    <table>
                        <tr class="section-title">
                            <td colspan="3">A. MODAL AWAL</td>
                        </tr>
                        <tr>
                            <td>Modal Awal (1 ${getHeaderDate()})</td>
                            <td class="amount">${formatCurrency(modal_awal)}</td>
                            <td></td>
                        </tr>

                        <tr class="section-title">
                            <td colspan="3">B. PENAMBAHAN MODAL</td>
                        </tr>
                        <tr>
                            <td>Setoran Modal Tunai</td>
                            <td class="amount">${formatCurrency(setoran)}</td>
                            <td></td>
                        </tr>
                        ${non_kas > 0 ? `
                        <tr>
                            <td>Modal Non-Kas (Aset Import)</td>
                            <td class="amount">${formatCurrency(non_kas)}</td>
                            <td></td>
                        </tr>` : ''}
                        <tr>
                            <td>Laba Kotor Konsolidasi</td>
                            <td class="amount">${formatCurrency(laba)}</td>
                            <td></td>
                        </tr>
                        ${pelunasan_h > 0 ? `
                        <tr>
                            <td>Pelunasan Hutang (Adjustment)</td>
                            <td class="amount">${formatCurrency(pelunasan_h)}</td>
                            <td></td>
                        </tr>` : ''}
                        <tr class="total-row">
                            <td>TOTAL PENAMBAHAN MODAL</td>
                            <td class="amount">${formatCurrency(tot_penambahan)}</td>
                            <td></td>
                        </tr>

                        <tr class="section-title">
                            <td colspan="3">C. PENGURANGAN MODAL</td>
                        </tr>
                        <tr>
                            <td>Beban Gaji Karyawan</td>
                            <td class="amount">(${formatCurrency(gaji)})</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Beban Lembur</td>
                            <td class="amount">(${formatCurrency(lembur)})</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Beban Operasional: Umum</td>
                            <td class="amount">(${formatCurrency(ops_umum)})</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Beban Operasional: Bengkel</td>
                            <td class="amount">(${formatCurrency(ops_bengkel)})</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Beban Operasional: Jasa Angkut</td>
                            <td class="amount">(${formatCurrency(ops_ja)})</td>
                            <td></td>
                        </tr>
                        ${r.pengurangan?.ops_ja?.unit > 0 ? `
                        <tr class="sub-row">
                            <td style="padding-left: 20px;">◦ Biaya Operasional Unit Bisnis</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.ops_ja?.unit)})</td>
                            <td></td>
                        </tr>` : ''}
                        ${r.pengurangan?.ops_ja?.armada > 0 ? `
                        <tr class="sub-row">
                            <td style="padding-left: 20px;">◦ Biaya Operasional Armada</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.ops_ja?.armada)})</td>
                            <td></td>
                        </tr>` : ''}
                        ${r.pengurangan?.ops_ja?.trip > 0 ? `
                        <tr class="sub-row">
                            <td style="padding-left: 20px;">◦ Biaya Trip Muatan</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.ops_ja?.trip)})</td>
                            <td></td>
                        </tr>` : ''}
                        ${r.pengurangan?.ops_ja?.repairs > 0 ? `
                        <tr class="sub-row">
                            <td style="padding-left: 20px;">◦ Perbaikan Jasa Angkut (Internal)</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.ops_ja?.repairs)})</td>
                            <td></td>
                        </tr>` : ''}
                        <tr>
                            <td>Beban Operasional: Jual Beli Mobil</td>
                            <td class="amount">(${formatCurrency(ops_mobil)})</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Prive (Pengambilan Pribadi)</td>
                            <td class="amount">(${formatCurrency(prive)})</td>
                            <td></td>
                        </tr>
                        ${hutang_baru > 0 ? `
                        <tr>
                            <td>Hutang Baru (Funding Source)</td>
                            <td class="amount">(${formatCurrency(hutang_baru)})</td>
                            <td></td>
                        </tr>` : ''}
                        ${bayar_hutang > 0 ? `
                        <tr>
                            <td>Pembayaran Hutang (Cash Out)</td>
                            <td class="amount">(${formatCurrency(bayar_hutang)})</td>
                            <td></td>
                        </tr>` : ''}
                        ${pengembalian > 0 ? `
                        <tr>
                            <td>Pengembalian Modal / Dividen</td>
                            <td class="amount">(${formatCurrency(pengembalian)})</td>
                            <td></td>
                        </tr>` : ''}
                        <tr class="total-row">
                            <td>TOTAL PENGURANGAN MODAL</td>
                            <td class="amount">(${formatCurrency(tot_pengurangan)})</td>
                            <td></td>
                        </tr>

                        <tr class="section-title">
                            <td colspan="2" style="font-size: 12px;">MODAL AKHIR (A + B - C)</td>
                            <td class="amount" style="font-size: 12px; font-weight: bold;">${formatCurrency(modal_akhir)}</td>
                        </tr>
                    </table>

                    <div style="page-break-before: always;"></div>
                    <div class="header">
                        <div class="title">INFORMASI TAMBAHAN (INFO ONLY)</div>
                    </div>
                    
                    <table>
                        <tr class="section-title">
                            <td colspan="3">1. RINCIAN KONTRIBUSI LABA</td>
                        </tr>
                        <tr>
                            <td>Kontribusi Laba Bengkel Umum</td>
                            <td class="amount">${formatCurrency(info.laba_bengkel || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Kontribusi Laba Jual Beli Mobil</td>
                            <td class="amount">${formatCurrency(info.laba_mobil || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Kontribusi Laba Jasa Angkut</td>
                            <td class="amount">${formatCurrency(info.laba_jasa_angkut || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Pengeluaran Overhead Gabungan</td>
                            <td class="amount">(${formatCurrency(info.overhead_gaji || 0)})</td>
                            <td></td>
                        </tr>

                        <tr class="section-title">
                            <td colspan="3">2. POSISI ASET SAAT INI</td>
                        </tr>
                        <tr>
                            <td>Kas & Bank (Gabungan)</td>
                            <td class="amount">${formatCurrency(aset.kas_bank || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Persediaan Sparepart</td>
                            <td class="amount">${formatCurrency(aset.stok_part || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Stok Unit Mobil</td>
                            <td class="amount">${formatCurrency(aset.stok_mobil || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Aset Tetap (Peralatan)</td>
                            <td class="amount">${formatCurrency(aset.aset_tetap || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Total Piutang Usaha</td>
                            <td class="amount">${formatCurrency(aset.piutang?.total || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Total Hutang Usaha</td>
                            <td class="amount">${formatCurrency(aset.hutang?.total || 0)}</td>
                            <td></td>
                        </tr>

                        <tr class="section-title">
                            <td colspan="3">3. RINCIAN PIUTANG</td>
                        </tr>
                        <tr>
                            <td>Piutang Bengkel</td>
                            <td class="amount">${formatCurrency(aset.piutang?.breakdown?.bengkel || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Piutang Jasa Angkut</td>
                            <td class="amount">${formatCurrency(aset.piutang?.breakdown?.ja || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Piutang Jual Beli Mobil</td>
                            <td class="amount">${formatCurrency(aset.piutang?.breakdown?.mobil || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Piutang Kasbon Karyawan</td>
                            <td class="amount">${formatCurrency(aset.piutang?.breakdown?.kasbon || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Piutang Lainnya</td>
                            <td class="amount">${formatCurrency(aset.piutang?.breakdown?.lainnya || 0)}</td>
                            <td></td>
                        </tr>

                        <tr class="section-title">
                            <td colspan="3">4. RINCIAN HUTANG</td>
                        </tr>
                        <tr>
                            <td>Hutang Bengkel (Sparepart)</td>
                            <td class="amount">${formatCurrency(aset.hutang?.breakdown?.bengkel || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Hutang Jasa Angkut</td>
                            <td class="amount">${formatCurrency(aset.hutang?.breakdown?.ja || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Hutang Jual Beli Mobil</td>
                            <td class="amount">${formatCurrency(aset.hutang?.breakdown?.mobil || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Hutang Investor</td>
                            <td class="amount">${formatCurrency(aset.hutang?.breakdown?.investor || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Hutang Lainnya</td>
                            <td class="amount">${formatCurrency(aset.hutang?.breakdown?.lainnya || 0)}</td>
                            <td></td>
                        </tr>
                    </table>

                    <div class="footer">
                        Dokumen ini dihasilkan secara otomatis oleh Sistem TPM pada ${format(new Date(), 'dd MMM yyyy HH:mm')}.
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (mode === 'preview') {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Gagal membuat file PDF laporan');
        } finally {
            setIsExporting(false);
            setShowExportMenu(false);
        }
    };

    const Row = ({ label, value, bold = false, small = false, isNegative = false, color = "text-slate-700" }: any) => (
        <View className="flex-row justify-between items-center w-full">
            <Typography variant={small ? "caption" : "body2"} weight={bold ? "bold" : "normal"} className={"flex-1 pr-4 " + color}>
                {label}
            </Typography>
            <Typography variant={small ? "caption" : "body1"} weight="bold" className={`${isNegative ? 'text-rose-600' : 'text-slate-800'}`}>
                {isNegative ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
            </Typography>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
            <Stack.Screen options={{ headerShown: false }} />

            <View className="bg-white px-4 pt-2 pb-4 shadow-sm z-20">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                        <Pressable onPress={handleBack} className="p-2 -ml-2 rounded-full active:bg-slate-100">
                            <ChevronLeft size={24} color={themeColors.text} />
                        </Pressable>
                        <View className="ml-2">
                            <Typography variant="h3" weight="bold" className="text-slate-800">
                                Perubahan Modal
                            </Typography>
                            <Typography variant="caption" className="text-slate-500">
                                Statement of Changes in Equity
                            </Typography>
                        </View>
                    </View>
                    <Pressable
                        onPress={() => setShowExportMenu(true)}
                        disabled={isExporting || isLoading}
                        className={`w-10 h-10 rounded-full items-center justify-center ${isExporting ? 'bg-slate-100' : 'bg-primary/10'}`}
                    >
                        {isExporting ? <ActivityIndicator size="small" color={themeColors.primary} /> : <Download size={20} color={themeColors.primary} />}
                    </Pressable>
                </View>

                <View className="flex-row bg-slate-100 p-1 rounded-xl">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => setFilterType(type)}
                            className={`flex-1 py-2 items-center justify-center rounded-lg ${filterType === type ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Typography variant="caption" weight={filterType === type ? 'bold' : 'medium'} className={filterType === type ? 'text-primary' : 'text-slate-500'}>
                                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </Typography>
                        </Pressable>
                    ))}
                </View>
            </View>

            <View className="px-4 -mt-4 z-30 pt-8 pb-4">
                <View className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex-row items-center">
                    <Pressable onPress={handlePrev} className="w-12 h-12 bg-slate-50 rounded-xl items-center justify-center border border-slate-100">
                        <ChevronLeft size={20} color={themeColors.text} />
                    </Pressable>
                    <View className="flex-1 flex-row items-center justify-center">
                        <Calendar size={18} color={themeColors.primary} className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-slate-800 capitalize tracking-tight">
                            {getFormattedDate()}
                        </Typography>
                    </View>
                    <Pressable onPress={handleNext} className="w-12 h-12 bg-slate-50 rounded-xl items-center justify-center border border-slate-100">
                        <ChevronRight size={20} color={themeColors.text} />
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
                        <Typography variant="body2" className="mt-4 text-slate-500">Menyusun Laporan...</Typography>
                    </View>
                ) : !report ? (
                    <View className="py-12 items-center justify-center">
                        <AlertTriangle size={48} color="#94a3b8" className="mb-4" />
                        <Typography variant="body1" className="text-slate-500">Data laporan tidak tersedia</Typography>
                    </View>
                ) : (
                    <View className="w-full space-y-4">
                        {/* A. MODAL AWAL */}
                        <Card className="overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                            <View className="bg-slate-50 px-5 py-3 flex-row items-center border-b border-slate-100">
                                <View className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center mr-3">
                                    <Wallet size={16} className="text-slate-600" />
                                </View>
                                <Typography variant="body1" weight="bold" className="text-slate-800">A. Modal Awal</Typography>
                            </View>
                            <View className="p-4">
                                <Row label="Saldo Modal Awal" value={report.modal_awal} bold />
                            </View>
                        </Card>

                        {/* B. PENAMBAHAN MODAL */}
                        <Card className="overflow-hidden border-0 shadow-sm shadow-emerald-200/50 bg-white rounded-2xl w-full">
                            <View className="bg-emerald-50 px-5 py-3 flex-row items-center border-b border-emerald-100">
                                <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center mr-3">
                                    <ArrowUpRight size={16} className="text-emerald-600" />
                                </View>
                                <Typography variant="body1" weight="bold" className="text-emerald-900">B. Penambahan Modal</Typography>
                            </View>
                            <View className="p-4 space-y-3">
                                <Row label="Setoran Modal Tunai" value={report.penambahan?.setoran_modal} />
                                {report.penambahan?.modal_non_kas?.total > 0 && (
                                    <>
                                        <Row label="Modal Non-Kas (Aset Import)" value={report.penambahan?.modal_non_kas?.total} bold />
                                        <View className="pl-4">
                                            {report.penambahan?.modal_non_kas?.aset_tetap > 0 && (
                                                <Row label="• Modal Aset Tetap" value={report.penambahan?.modal_non_kas?.aset_tetap} />
                                            )}
                                            {report.penambahan?.modal_non_kas?.stok_part > 0 && (
                                                <Row label="• Modal Stok Sparepart" value={report.penambahan?.modal_non_kas?.stok_part} />
                                            )}
                                            {report.penambahan?.modal_non_kas?.stok_mobil > 0 && (
                                                <Row label="• Modal Stok Mobil" value={report.penambahan?.modal_non_kas?.stok_mobil} />
                                            )}
                                        </View>
                                    </>
                                )}
                                
                                <View className="space-y-1 mb-2">
                                    <Row label="Laba Kotor Konsolidasi" value={report.penambahan?.laba_kotor?.total} bold />
                                    <View className="pl-4">
                                        <Row label="• Laba Jual Beli Mobil" value={report.penambahan?.laba_kotor?.mobil} />
                                        <Row label="• Laba Jasa Angkut" value={report.penambahan?.laba_kotor?.ja} />
                                        <Row label="• Laba Bengkel" value={report.penambahan?.laba_kotor?.bengkel} />
                                    </View>
                                </View>

                                {report.penambahan?.pelunasan_hutang > 0 && (
                                    <Row label="Pelunasan Hutang (Funding Release)" value={report.penambahan?.pelunasan_hutang} />
                                )}

                                {report.penambahan?.investor_funding > 0 && (
                                    <Row label="Pendanaan Eksternal (Investor)" value={report.penambahan?.investor_funding} />
                                )}

                                {report.penambahan?.stok_mobil_baru > 0 && (
                                    <Row label="Pendanaan Stok Mobil (Funded)" value={report.penambahan?.stok_mobil_baru} small />
                                )}
                                {report.penambahan?.stok_part_baru > 0 && (
                                    <Row label="Pendanaan Stok Part (Funded)" value={report.penambahan?.stok_part_baru} small />
                                )}
                                {report.penambahan?.piutang_baru?.total > 0 && (
                                    <>
                                        <Row label="Penambahan Piutang / Kasbon (Aset)" value={report.penambahan?.piutang_baru?.total} small bold />
                                        <View className="pl-4">
                                            {report.penambahan?.piutang_baru?.kasbon > 0 && (
                                                <Row label="- Kasbon Karyawan Baru" value={report.penambahan?.piutang_baru?.kasbon} small />
                                            )}
                                            {report.penambahan?.piutang_baru?.lainnya > 0 && (
                                                <Row label="- Piutang Lainnya Baru" value={report.penambahan?.piutang_baru?.lainnya} small />
                                            )}
                                        </View>
                                    </>
                                )}
                                <View className="pt-3 border-t border-emerald-100">
                                    <Row label="Total Penambahan" value={report.penambahan?.total} bold color="text-emerald-700" />
                                </View>
                            </View>
                        </Card>

                        {/* C. PENGURANGAN MODAL */}
                        <Card className="overflow-hidden border-0 shadow-sm shadow-rose-200/50 bg-white rounded-2xl w-full">
                            <View className="bg-rose-50 px-5 py-3 flex-row items-center border-b border-rose-100">
                                <View className="w-8 h-8 rounded-full bg-rose-100 items-center justify-center mr-3">
                                    <ArrowDownLeft size={16} className="text-rose-600" />
                                </View>
                                <Typography variant="body1" weight="bold" className="text-rose-900">C. Pengurangan Modal</Typography>
                            </View>
                            <View className="p-4 space-y-3">
                                <Row label="Prive (Pengambilan Pribadi)" value={report.pengurangan?.prive} isNegative />

                                {report.pengurangan?.pengembalian_modal > 0 && (
                                    <Row label="Pengembalian Modal / Dividen" value={report.pengurangan?.pengembalian_modal} isNegative />
                                )}

                                {report.pengurangan?.investor_funding > 0 && (
                                    <Row label="Pendanaan Eksternal (Investor - Net)" value={report.pengurangan?.investor_funding} isNegative />
                                )}

                                {report.pengurangan?.pembayaran_investor > 0 && (
                                    <Row label="Pelunasan Hutang (Investor)" value={report.pengurangan?.pembayaran_investor} isNegative />
                                )}

                                {report.pengurangan?.pelunasan_hutang > 0 && (
                                    <Row label="Pelunasan Hutang Usaha" value={report.pengurangan?.pelunasan_hutang} isNegative />
                                )}

                                {report.pengurangan?.alokasi_stok > 0 && (
                                    <Row label="Alokasi Dana Stok Baru (Net)" value={report.pengurangan?.alokasi_stok} small isNegative />
                                )}
                                {report.pengurangan?.alokasi_piutang?.total > 0 && (
                                    <>
                                        <Row label="Alokasi Dana Kasbon / Piutang (Net)" value={report.pengurangan?.alokasi_piutang?.total} small isNegative bold />
                                        <View className="pl-4">
                                            {report.pengurangan?.alokasi_piutang?.kasbon > 0 && (
                                                <Row label="- Dana Kasbon Karyawan" value={report.pengurangan?.alokasi_piutang?.kasbon} small isNegative />
                                            )}
                                            {report.pengurangan?.alokasi_piutang?.lainnya > 0 && (
                                                <Row label="- Dana Piutang Lainnya" value={report.pengurangan?.alokasi_piutang?.lainnya} small isNegative />
                                            )}
                                        </View>
                                    </>
                                )}

                                {report.pengurangan?.beban_operasional?.total > 0 && (
                                    <View className="space-y-1 mb-2 pt-2 border-t border-rose-50">
                                        <Row label="Beban Operasional & Gaji" value={report.pengurangan?.beban_operasional?.total} bold isNegative />
                                        <View className="pl-4 space-y-1">
                                            {report.pengurangan?.beban_operasional?.bengkel > 0 && (
                                                <Row label="• Beban Ops Bengkel" value={report.pengurangan?.beban_operasional?.bengkel} small isNegative />
                                            )}
                                            {report.pengurangan?.beban_operasional?.mobil > 0 && (
                                                <Row label="• Beban Ops Mobil" value={report.pengurangan?.beban_operasional?.mobil} small isNegative />
                                            )}
                                            {report.pengurangan?.beban_operasional?.ja?.total > 0 && (
                                                <>
                                                    <Row label="• Beban Ops Jasa Angkut" value={report.pengurangan?.beban_operasional?.ja?.total} small isNegative bold />
                                                    <View className="pl-4">
                                                        {report.pengurangan?.beban_operasional?.ja?.unit > 0 && (
                                                            <Row label="- Dompet Unit JA" value={report.pengurangan?.beban_operasional?.ja?.unit} small isNegative />
                                                        )}
                                                        {report.pengurangan?.beban_operasional?.ja?.armada > 0 && (
                                                            <Row label="- Biaya Ops Armada" value={report.pengurangan?.beban_operasional?.ja?.armada} small isNegative />
                                                        )}
                                                        {report.pengurangan?.beban_operasional?.ja?.trip > 0 && (
                                                            <Row label="- Biaya Ops Trip" value={report.pengurangan?.beban_operasional?.ja?.trip} small isNegative />
                                                        )}
                                                        {report.pengurangan?.beban_operasional?.ja?.repairs > 0 && (
                                                            <Row label="- Perbaikan Bengkel" value={report.pengurangan?.beban_operasional?.ja?.repairs} small isNegative />
                                                        )}
                                                    </View>
                                                </>
                                            )}
                                            {report.pengurangan?.beban_operasional?.umum > 0 && (
                                                <Row label="• Beban Umum & Lainnya" value={report.pengurangan?.beban_operasional?.umum} small isNegative />
                                            )}
                                            {report.pengurangan?.beban_operasional?.gaji_lembur > 0 && (
                                                <Row label="• Beban Gaji & Lembur" value={report.pengurangan?.beban_operasional?.gaji_lembur} small isNegative />
                                            )}
                                        </View>
                                    </View>
                                )}

                                <View className="pt-3 border-t border-rose-100">
                                    <Row label="Total Pengurangan" value={report.pengurangan?.total} bold color="text-rose-700" />
                                </View>
                            </View>
                        </Card>

                        {/* MODAL AKHIR */}
                        <Card className="overflow-hidden border-0 shadow-lg shadow-blue-200/50 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl w-full mt-2">
                            <View className="p-5 flex-row justify-between items-center w-full">
                                <Typography variant="h4" weight="bold" className="text-white">MODAL AKHIR</Typography>
                                <Typography variant="h3" weight="bold" className="text-white">
                                    {formatCurrency(report.modal_akhir)}
                                </Typography>
                            </View>
                        </Card>

                        {/* VALIDASI BALANCE */}
                        {report.info?.validasi && (
                            <Card className={`overflow-hidden border border-slate-100 shadow-sm rounded-2xl w-full mt-2 ${report.info.validasi.status === 'BALANCE' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <View className="p-4">
                                    <View className="flex-row justify-between items-center mb-3">
                                        <Typography variant="caption" weight="bold" className={`${report.info.validasi.status === 'BALANCE' ? 'text-emerald-700' : 'text-rose-700'} uppercase tracking-widest`}>
                                            Validasi Laporan
                                        </Typography>
                                        <View className={`px-2 py-0.5 rounded-full ${report.info.validasi.status === 'BALANCE' ? 'bg-emerald-200' : 'bg-rose-200'}`}>
                                            <Typography variant="caption" weight="bold" className={report.info.validasi.status === 'BALANCE' ? 'text-emerald-800' : 'text-rose-800'}>
                                                {report.info.validasi.status}
                                            </Typography>
                                        </View>
                                    </View>
                                    <View className="space-y-2">
                                        <Row label="Modal Akhir (Teoritis)" value={report.info.validasi.modal_teoritis} small color={report.info.validasi.status === 'BALANCE' ? 'text-emerald-900/60' : 'text-rose-900/60'} />
                                        <Row label="Total Aset Bersih (Aktual)" value={report.info.validasi.modal_aktual} small color={report.info.validasi.status === 'BALANCE' ? 'text-emerald-900/60' : 'text-rose-900/60'} />
                                        <View className={`pt-2 border-t ${report.info.validasi.status === 'BALANCE' ? 'border-emerald-200' : 'border-rose-200'}`}>
                                            <Row label="Selisih Rekonsiliasi" value={report.info.validasi.selisih} small bold color={report.info.validasi.status === 'BALANCE' ? 'text-emerald-900' : 'text-rose-900'} />
                                        </View>
                                    </View>
                                </View>
                            </Card>
                        )}

                        <View className="my-4 flex-row items-center justify-center">
                            <View className="h-px bg-slate-200 flex-1" />
                            <Typography variant="caption" className="px-4 text-slate-400 font-bold uppercase tracking-widest">Informasi Tambahan</Typography>
                            <View className="h-px bg-slate-200 flex-1" />
                        </View>

                        {/* INFO KONTRIBUSI LABA */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-2xl w-full mb-2">
                            <View className="p-4">
                                <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest mb-3">Rincian Laba</Typography>
                                <View className="space-y-2">
                                    <Row label="Laba Bengkel Umum" value={report.info?.laba_bengkel} small />
                                    <Row label="Laba Jual Beli Mobil" value={report.info?.laba_mobil} small />
                                    {report.info?.laba_investor > 0 && (
                                        <Row label="Bagi Hasil Investor" value={report.info?.laba_investor} small isNegative />
                                    )}
                                    <Row label="Laba Jasa Angkut" value={report.info?.laba_jasa_angkut} small />
                                    <Row label="Total Beban Operasional & Gaji" value={report.info?.overhead_gaji} small isNegative bold />
                                    <View className="pl-4 space-y-1 mb-2">
                                        {report.info?.ops_bengkel > 0 && (
                                            <Row label="• Beban Ops Bengkel" value={report.info?.ops_bengkel} small isNegative />
                                        )}
                                        {report.info?.ops_mobil > 0 && (
                                            <Row label="• Beban Ops Mobil" value={report.info?.ops_mobil} small isNegative />
                                        )}
                                        {report.info?.ops_ja?.total > 0 && (
                                            <>
                                                <Row label="• Beban Ops Jasa Angkut" value={report.info?.ops_ja?.total} small isNegative bold />
                                                <View className="pl-4">
                                                    {report.info?.ops_ja?.unit > 0 && (
                                                        <Row label="- Dompet Unit JA" value={report.info?.ops_ja?.unit} small isNegative />
                                                    )}
                                                    {report.info?.ops_ja?.armada > 0 && (
                                                        <Row label="- Biaya Ops Armada" value={report.info?.ops_ja?.armada} small isNegative />
                                                    )}
                                                    {report.info?.ops_ja?.trip > 0 && (
                                                        <Row label="- Biaya Ops Trip" value={report.info?.ops_ja?.trip} small isNegative />
                                                    )}
                                                    {report.info?.ops_ja?.repairs > 0 && (
                                                        <Row label="- Perbaikan Bengkel" value={report.info?.ops_ja?.repairs} small isNegative />
                                                    )}
                                                </View>
                                            </>
                                        )}
                                        {report.info?.ops_umum > 0 && (
                                            <Row label="• Beban Umum & Lainnya" value={report.info?.ops_umum} small isNegative />
                                        )}
                                        {(report.info?.gaji > 0 || report.info?.lembur > 0) && (
                                            <Row label="• Beban Gaji & Lembur" value={(report.info?.gaji || 0) + (report.info?.lembur || 0)} small isNegative />
                                        )}
                                    </View>
                                    <View className="pt-2 border-t border-slate-50">
                                        <Row label="Laba Bersih Konsolidasi" value={report.info?.laba_bersih} small bold />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* INFO STOK MOBIL */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-2xl w-full mb-2">
                            <View className="p-4">
                                <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest mb-3">Rincian Persediaan Mobil</Typography>
                                <View className="space-y-2">
                                    <Row label="Harga Beli Unit" value={report.info?.aset?.stok_mobil?.unit_hanya} small />
                                    {report.info?.aset?.stok_mobil?.biaya_persiapan > 0 && (
                                        <Row label="Biaya Persiapan (Prep)" value={report.info?.aset?.stok_mobil?.biaya_persiapan} small />
                                    )}
                                    {report.info?.aset?.stok_mobil?.perbaikan_internal > 0 && (
                                        <Row label="Perbaikan Bengkel Internal" value={report.info?.aset?.stok_mobil?.perbaikan_internal} small />
                                    )}
                                    {report.info?.aset?.stok_mobil?.perbaikan_external > 0 && (
                                        <Row label="Perbaikan Bengkel External" value={report.info?.aset?.stok_mobil?.perbaikan_external} small />
                                    )}
                                    <View className="pt-2 border-t border-slate-50">
                                        <Row label="Total Aset Mobil" value={report.info?.aset?.stok_mobil?.total} small bold />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* INFO PIUTANG */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-2xl w-full mb-2">
                            <View className="p-4">
                                <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest mb-3">Rincian Piutang</Typography>
                                <View className="space-y-2">
                                    {report.info?.aset?.piutang?.breakdown?.bengkel > 0 && (
                                        <Row label="Piutang Bengkel" value={report.info?.aset?.piutang?.breakdown?.bengkel} small />
                                    )}
                                    {report.info?.aset?.piutang?.breakdown?.ja > 0 && (
                                        <Row label="Piutang Jasa Angkut" value={report.info?.aset?.piutang?.breakdown?.ja} small />
                                    )}
                                    {report.info?.aset?.piutang?.breakdown?.mobil > 0 && (
                                        <Row label="Piutang Jual Beli Mobil" value={report.info?.aset?.piutang?.breakdown?.mobil} small />
                                    )}
                                    {report.info?.aset?.piutang?.breakdown?.kasbon > 0 && (
                                        <Row label="Piutang Kasbon Karyawan" value={report.info?.aset?.piutang?.breakdown?.kasbon} small />
                                    )}
                                    {report.info?.aset?.piutang?.breakdown?.lainnya > 0 && (
                                        <Row label="Piutang Lainnya" value={report.info?.aset?.piutang?.breakdown?.lainnya} small />
                                    )}
                                    <View className="pt-2 border-t border-slate-50">
                                        <Row label="Total Piutang" value={report.info?.aset?.piutang?.total} small bold />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* INFO HUTANG */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-2xl w-full mb-8">
                            <View className="p-4">
                                <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-widest mb-3">Rincian Hutang</Typography>
                                <View className="space-y-2">
                                    {report.info?.aset?.hutang?.breakdown?.bengkel > 0 && (
                                        <Row label="Hutang Bengkel (Sparepart)" value={report.info?.aset?.hutang?.breakdown?.bengkel} small />
                                    )}
                                    {report.info?.aset?.hutang?.breakdown?.ja > 0 && (
                                        <Row label="Hutang Jasa Angkut" value={report.info?.aset?.hutang?.breakdown?.ja} small />
                                    )}
                                    {report.info?.aset?.hutang?.breakdown?.mobil > 0 && (
                                        <Row label="Hutang Jual Beli Mobil" value={report.info?.aset?.hutang?.breakdown?.mobil} small />
                                    )}
                                    {report.info?.aset?.hutang?.breakdown?.investor > 0 && (
                                        <Row label="Hutang Investor" value={report.info?.aset?.hutang?.breakdown?.investor} small />
                                    )}
                                    {report.info?.aset?.hutang?.breakdown?.uang_muka_penjualan > 0 && (
                                        <Row label="Uang Muka Penjualan (DP)" value={report.info?.aset?.hutang?.breakdown?.uang_muka_penjualan} small />
                                    )}
                                    {report.info?.aset?.hutang?.breakdown?.piutang_booking > 0 && (
                                        <Row label="Piutang Belum Realisasi" value={report.info?.aset?.hutang?.breakdown?.piutang_booking} small />
                                    )}
                                    {report.info?.aset?.hutang?.breakdown?.lainnya > 0 && (
                                        <Row label="Hutang Lainnya" value={report.info?.aset?.hutang?.breakdown?.lainnya} small />
                                    )}
                                    <View className="pt-2 border-t border-slate-50">
                                        <Row label="Total Hutang" value={report.info?.aset?.hutang?.total} small bold />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* SMART DEBUG REKONSILIASI (Only shows if there is a discrepancy) */}
                        {Math.abs(report.selisih || 0) > 1 && (
                            <View className="p-4 bg-red-50 rounded-2xl space-y-2 border border-red-200 border-dashed mb-8">
                                <View className="flex-row items-center mb-2">
                                    <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                                    <Typography variant="caption" weight="bold" className="text-red-600 uppercase tracking-widest">Peringatan Selisih: Debug Mode Aktif</Typography>
                                </View>
                                <Row label="Total Kas & Bank" value={report.info?.debug?.kas} small />
                                <Row label="Persediaan Part" value={report.info?.debug?.part} small />
                                <Row label="Persediaan Mobil (incl. Prep/Repair)" value={report.info?.debug?.mobil} small />
                                <Row label="Aset Tetap" value={report.info?.debug?.tetap} small />
                                <Row label="Piutang Usaha (External)" value={report.info?.debug?.piutang} small />
                                <Row label="Total Kewajiban (Hutang)" value={report.info?.debug?.hutang} small isNegative />
                                <View className="pt-2 border-t border-red-200">
                                    <Row label="Total Aset Bersih Aktual" value={(report.info?.debug?.kas || 0) + (report.info?.debug?.part || 0) + (report.info?.debug?.mobil || 0) + (report.info?.debug?.tetap || 0) + (report.info?.debug?.piutang || 0) - (report.info?.debug?.hutang || 0)} small bold />
                                </View>
                                <Typography variant="caption" className="text-red-400 mt-2 italic">* Angka di atas adalah komponen pembentuk Total Aset Aktual.</Typography>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <Modal visible={showExportMenu} transparent animationType="fade">
                <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setShowExportMenu(false)}>
                    <View className="bg-white rounded-t-3xl p-6 pb-8">
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
                        <Typography variant="h3" weight="bold" className="mb-6 text-center text-gray-800">Export Laporan</Typography>
                        <View className="flex-row justify-center space-x-6">
                            <Pressable onPress={() => handleExportPDF('preview')} className="items-center">
                                <View className="w-16 h-16 bg-blue-50 rounded-2xl items-center justify-center mb-2">
                                    <Eye size={28} color={themeColors.primary} />
                                </View>
                                <Typography variant="caption" weight="medium">Preview PDF</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
