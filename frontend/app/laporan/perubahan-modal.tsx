import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, Wallet, Download, Eye, Share2, X, AlertTriangle, Building, Truck, Car, Printer } from 'lucide-react-native';
import { Modal } from 'react-native';
import { WebView } from 'react-native-webview';
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
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
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

    const calculateSimplifiedTotals = () => {
        if (!report) return { laba_bersih: 0, setoran: 0, prive: 0, adjustment: 0 };
        const r = report;
        
        // Use Net Income from backend as the primary profit figure
        const laba_bersih = r.info?.laba_bersih || 0;
        
        // Contributions are Fresh Cash + Non-Cash Assets given to company
        const setoran = (r.penambahan?.setoran_modal || 0) + 
                        (r.penambahan?.modal_non_kas?.total || 0) + 
                        (r.penambahan?.investor_funding || 0);
        
        // Drawings (Prive)
        const prive = (r.pengurangan?.prive || 0) + (r.pengurangan?.pengembalian_modal || 0);
        
        // The Gap: Since the system uses snapshot reconciliation, any difference 
        // between (Awal + Profit + Contributions - Drawings) and (Actual Balance) 
        // is the accounting adjustment (usually from internal eliminations or asset revaluations).
        const theoretical = r.modal_awal + laba_bersih + setoran - prive;
        const adjustment = r.modal_akhir - theoretical;
        
        return { laba_bersih, setoran, prive, adjustment };
    };

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!report) return;
        setIsExporting(true);
        try {
            const r = report;
            const simple = calculateSimplifiedTotals();
            
            const html = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        body { font-family: 'Helvetica', sans-serif; font-size: 11px; color: #1e293b; padding: 40px; line-height: 1.5; background-color: #fff; }
                        .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
                        .title { font-size: 22px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 5px; }
                        .subtitle { font-size: 14px; color: #4f46e5; font-weight: 600; }
                        .date { font-size: 11px; color: #64748b; margin-top: 5px; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                        th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                        
                        .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
                        .section-title { background-color: #f8fafc; font-weight: 800; color: #4f46e5; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
                        .total-row { font-weight: 800; background-color: #f1f5f9; border-top: 2px solid #cbd5e1; }
                        .grand-total { font-weight: 800; background-color: #4f46e5; color: #ffffff; font-size: 14px; }
                        
                        .sub-item { color: #64748b; padding-left: 25px; font-size: 10px; }
                        .negative { color: #e11d48; }
                        .positive { color: #059669; }
                        
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
                        .info-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #fafafa; }
                        .info-card-title { font-weight: 800; font-size: 10px; color: #475569; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                        
                        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #94a3b8; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">Laporan Perubahan Ekuitas</div>
                        <div class="subtitle">BENGKEL TPM - KONSOLIDASI</div>
                        <div class="date">Periode: ${getHeaderDate()}</div>
                    </div>

                    <table>
                        <tr class="section-title"><td colspan="2">A. MODAL AWAL</td></tr>
                        <tr>
                            <td>Saldo Modal Awal</td>
                            <td class="amount">${formatCurrency(r.modal_awal)}</td>
                        </tr>

                        <tr class="section-title"><td colspan="2">B. PENAMBAHAN MODAL</td></tr>
                        ${simple.laba_bersih > 0 ? `
                        <tr>
                            <td>Laba Bersih Konsolidasi</td>
                            <td class="amount positive">${formatCurrency(simple.laba_bersih)}</td>
                        </tr>` : ''}
                        ${r.penambahan?.setoran_modal > 0 ? `
                        <tr>
                            <td>Setoran Modal Pemilik (Tunai)</td>
                            <td class="amount">${formatCurrency(r.penambahan.setoran_modal)}</td>
                        </tr>` : ''}
                        ${r.penambahan?.modal_non_kas?.total > 0 ? `
                        <tr>
                            <td>Setoran Modal Non-Kas (Aset)</td>
                            <td class="amount">${formatCurrency(r.penambahan.modal_non_kas.total)}</td>
                        </tr>` : ''}
                        ${simple.adjustment > 0 ? `
                        <tr class="sub-item">
                            <td>Penyesuaian Saldo (+)</td>
                            <td class="amount">${formatCurrency(simple.adjustment)}</td>
                        </tr>` : ''}

                        <tr class="section-title"><td colspan="2">C. PENGURANGAN MODAL</td></tr>
                        ${simple.laba_bersih < 0 ? `
                        <tr>
                            <td>Rugi Bersih Konsolidasi</td>
                            <td class="amount negative">(${formatCurrency(Math.abs(simple.laba_bersih))})</td>
                        </tr>` : ''}
                        ${simple.prive > 0 ? `
                        <tr>
                            <td>Prive & Penarikan Modal</td>
                            <td class="amount negative">(${formatCurrency(simple.prive)})</td>
                        </tr>` : ''}
                        ${simple.adjustment < 0 ? `
                        <tr class="sub-item">
                            <td>Penyesuaian Saldo (-)</td>
                            <td class="amount negative">(${formatCurrency(Math.abs(simple.adjustment))})</td>
                        </tr>` : ''}

                        <tr class="grand-total">
                            <td>MODAL AKHIR PERIODE</td>
                            <td class="amount">${formatCurrency(r.modal_akhir)}</td>
                        </tr>
                    </table>

                    <div class="info-grid">
                        <div class="info-card">
                            <div class="info-card-title">Profitabilitas Unit Usaha</div>
                            <div class="info-row"><span>Bengkel & Sparepart</span><b>${formatCurrency(r.info?.laba_bengkel || 0)}</b></div>
                            <div class="info-row"><span>Jual Beli Mobil</span><b>${formatCurrency(r.info?.laba_mobil || 0)}</b></div>
                            <div class="info-row"><span>Jasa Angkut (JA)</span><b>${formatCurrency(r.info?.laba_jasa_angkut || 0)}</b></div>
                        </div>
                        <div class="info-card">
                            <div class="info-card-title">Posisi Aset Bersih</div>
                            <div class="info-row"><span>Kas & Bank Aktif</span><b>${formatCurrency(r.info?.aset?.kas_bank || 0)}</b></div>
                            <div class="info-row"><span>Persediaan Unit Mobil</span><b>${formatCurrency(r.info?.aset?.stok_mobil?.total || 0)}</b></div>
                            <div class="info-row"><span>Total Kewajiban</span><b class="negative">${formatCurrency(r.info?.aset?.hutang?.total || 0)}</b></div>
                        </div>
                    </div>

                    <div class="footer">
                        Laporan ini dihasilkan otomatis oleh Sistem Keuangan TPM.<br/>
                        Waktu Cetak: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: localeID })}
                    </div>
                </body>
                </html>
            `;

            if (mode === 'preview') {
                setPreviewHtml(html);
                setShowPdfPreview(true);
            } else {
                await Print.printAsync({ html });
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Gagal membuat laporan PDF');
        } finally {
            setIsExporting(false);
            setShowExportMenu(false);
        }
    };

    const Row = ({ label, value, bold = false, small = false, isNegative = false, color = "text-slate-700", icon: Icon }: any) => (
        <View className="flex-row justify-between items-center w-full py-2.5">
            <View className="flex-row items-center flex-1 pr-4">
                {Icon && (
                    <View className="w-5 h-5 items-center justify-center mr-2 opacity-60">
                        <Icon size={14} color="#64748b" />
                    </View>
                )}
                <Typography variant={small ? "caption" : "body2"} weight={bold ? "bold" : "medium"} className={color}>
                    {label}
                </Typography>
            </View>
            <Typography variant={small ? "caption" : "body1"} weight="bold" className={isNegative ? 'text-rose-500' : 'text-slate-900'}>
                {isNegative ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
            </Typography>
        </View>
    );

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

    const simple = calculateSimplifiedTotals();

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
                            {getFormattedDate()}
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
                        {/* HERO: TOTAL MODAL AKHIR */}
                        <View className="w-full rounded-[36px] p-7 shadow-2xl overflow-hidden relative" style={{ backgroundColor: '#4f46e5' }}>
                            <View className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full" />
                            <View className="absolute top-20 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full" />
                            
                            <View className="flex-row items-start justify-between mb-6">
                                <View className="flex-1 pr-4">
                                    <Typography variant="caption" weight="bold" className="text-indigo-100 uppercase tracking-[2.5px]">Modal Akhir Periode</Typography>
                                    <Typography variant="h1" weight="bold" className="text-white mt-1" style={{ fontSize: 32 }}>{formatCurrency(report.modal_akhir)}</Typography>
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

                        {/* STATS OVERVIEW */}
                        <View className="flex-row">
                            <StatCard label="MODAL AWAL" value={report.modal_awal} icon={Building} bgColor="#334155" subLabel="Saldo Awal" />
                            <StatCard label="LABA BERSIH" value={simple.laba_bersih} icon={ArrowUpRight} bgColor="#059669" subLabel="Net Income" />
                        </View>

                        <View className="flex-row -mt-1">
                            <StatCard label="SETORAN" value={simple.setoran} icon={Wallet} bgColor="#4f46e5" subLabel="Tambahan Modal" />
                            <StatCard label="PRIVE" value={simple.prive} icon={ArrowDownLeft} bgColor="#e11d48" subLabel="Drawings" />
                        </View>

                        {/* MAIN CAPITAL STATEMENT TABLE */}
                        <Card className="p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm mt-2">
                            <Typography variant="body1" weight="bold" className="text-slate-900 mb-5">Rincian Perubahan Ekuitas</Typography>
                            
                            <Row label="Modal Awal" value={report.modal_awal} bold color="text-slate-900" />
                            
                            <View className="mt-4 pt-4 border-t border-slate-50">
                                <Typography variant="caption" weight="bold" className="text-emerald-600 mb-2 uppercase tracking-widest">Penambahan</Typography>
                                {simple.laba_bersih > 0 && (
                                    <Row label="Laba Bersih Konsolidasi" value={simple.laba_bersih} icon={ArrowUpRight} color="text-emerald-700" />
                                )}
                                {report.penambahan?.setoran_modal > 0 && (
                                    <Row label="Setoran Modal Pemilik (Tunai)" value={report.penambahan.setoran_modal} icon={Wallet} />
                                )}
                                {report.penambahan?.modal_non_kas?.total > 0 && (
                                    <Row label="Setoran Modal Non-Kas (Aset)" value={report.penambahan.modal_non_kas.total} icon={Building} />
                                )}
                                {simple.adjustment > 0 && (
                                    <Row label="Penyesuaian Saldo (+)" value={simple.adjustment} small color="text-slate-400" />
                                )}
                            </View>

                            <View className="mt-4 pt-4 border-t border-slate-50">
                                <Typography variant="caption" weight="bold" className="text-rose-600 mb-2 uppercase tracking-widest">Pengurangan</Typography>
                                {simple.laba_bersih < 0 && (
                                    <Row label="Rugi Bersih Konsolidasi" value={Math.abs(simple.laba_bersih)} isNegative icon={ArrowDownLeft} color="text-rose-700" />
                                )}
                                {simple.prive > 0 && (
                                    <Row label="Prive & Penarikan Modal" value={simple.prive} isNegative icon={ArrowDownLeft} />
                                )}
                                {simple.adjustment < 0 && (
                                    <Row label="Penyesuaian Saldo (-)" value={Math.abs(simple.adjustment)} isNegative small color="text-slate-400" />
                                )}
                            </View>

                            <View className="mt-4 pt-5 border-t-2 border-slate-100">
                                <Row label="Modal Akhir Periode" value={report.modal_akhir} bold color="text-indigo-700" />
                            </View>
                        </Card>

                        {/* ANALYTICAL BREAKDOWNS */}
                        <Typography variant="body2" weight="bold" className="text-slate-900 px-1 mt-4">Analisis Operasional & Aset</Typography>
                        
                        <View className="space-y-4">
                            {/* PROFIT BY UNIT */}
                            <Card className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm">
                                <Typography variant="caption" weight="bold" className="text-slate-400 mb-4 uppercase tracking-widest">Performansi Laba Per Unit</Typography>
                                <Row label="Bengkel & Sparepart" value={report.info?.laba_bengkel} small icon={Building} />
                                <Row label="Jual Beli Mobil" value={report.info?.laba_mobil} small icon={Car} />
                                <Row label="Jasa Angkut (JA)" value={report.info?.laba_jasa_angkut} small icon={Truck} />
                                <View className="my-2 border-t border-slate-50" />
                                <Row label="Total Laba Bersih" value={report.info?.laba_bersih} bold color="text-emerald-700" />
                            </Card>

                            {/* ASSETS SNAPSHOT */}
                            <Card className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm">
                                <Typography variant="caption" weight="bold" className="text-slate-400 mb-4 uppercase tracking-widest">Posisi Aset Bersih Terakhir</Typography>
                                <Row label="Total Kas & Saldo Bank" value={report.info?.aset?.kas_bank} small icon={Wallet} />
                                <Row label="Persediaan Unit Mobil" value={report.info?.aset?.stok_mobil?.total} small icon={Car} />
                                <Row label="Persediaan Sparepart" value={report.info?.aset?.stok_part} small icon={Truck} />
                                <Row label="Total Piutang Aktif" value={report.info?.aset?.piutang?.total} small icon={ArrowUpRight} />
                                <Row label="Total Kewajiban (Hutang)" value={report.info?.aset?.hutang?.total} small isNegative icon={ArrowDownLeft} />
                                <View className="my-2 border-t border-slate-50" />
                                <Row label="Total Ekuitas (Net Asset)" value={report.modal_akhir} bold color="text-indigo-700" />
                            </Card>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* EXPORT OPTIONS MODAL */}
            <Modal visible={showExportMenu} transparent animationType="fade">
                <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setShowExportMenu(false)}>
                    <View className="bg-white rounded-t-[40px] p-8">
                        <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-8" />
                        <Typography variant="h4" weight="bold" className="text-slate-900 mb-6 text-center">Ekspor Laporan</Typography>
                        
                        <View className="space-y-4">
                            <Pressable 
                                onPress={() => handleExportPDF('preview')}
                                className="flex-row items-center p-5 bg-slate-50 rounded-3xl border border-slate-100 active:bg-slate-100 shadow-sm"
                            >
                                <View className="w-12 h-12 bg-indigo-100 rounded-2xl items-center justify-center mr-4">
                                    <Eye size={22} color="#4f46e5" />
                                </View>
                                <View className="flex-1">
                                    <Typography variant="body1" weight="bold" className="text-slate-900">Preview Laporan</Typography>
                                    <Typography variant="caption" className="text-slate-500">Lihat tampilan PDF secara instan</Typography>
                                </View>
                            </Pressable>

                            <Pressable 
                                onPress={() => handleExportPDF('print')}
                                className="flex-row items-center p-5 bg-slate-50 rounded-3xl border border-slate-100 active:bg-slate-100 shadow-sm"
                            >
                                <View className="w-12 h-12 bg-emerald-100 rounded-2xl items-center justify-center mr-4">
                                    <Printer size={22} color="#059669" />
                                </View>
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
            <Modal visible={showPdfPreview} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
                        <Pressable onPress={() => setShowPdfPreview(false)} className="p-2">
                            <X size={24} color="#64748b" />
                        </Pressable>
                        <Typography variant="body1" weight="bold">Pratinjau Laporan</Typography>
                        <Pressable onPress={() => handleExportPDF('print')} className="p-2">
                            <Printer size={24} color="#4f46e5" />
                        </Pressable>
                    </View>
                    <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />
                </View>
            </Modal>
        </SafeAreaView>
    );
}
