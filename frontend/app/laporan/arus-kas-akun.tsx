import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { ArrowRightLeft, TrendingUp, TrendingDown, Wallet, Info, X, Printer, Download } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { formatCurrency, formatCurrencyDisplay } from '../../utils/format';
import { useLabaRugiReport, useCapitalReport } from '../../hooks/useKeuangan';
import { LabaRugiReport, CapitalReport } from '../../types/reports';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { buildArusKasAkunExportHtml } from '../../utils/reportTemplates';
import { appAlert } from '../../utils/appAlert';
import {
    ReportPageHeader,
    ReportDateControls,
    ReportExportSheet,
    ReportFilterType,
    KasArusJenisBreakdown,
    KasJenisBreakdown,
} from '../../components/laporan';

export default function ArusKasAkunScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const navigation = useNavigation();
    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

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

    const reportParams = useMemo(() => {
        const start = filterType === 'daily' ? date : (filterType === 'monthly' ? startOfMonth(date) : startOfYear(date));
        const end = filterType === 'daily' ? date : (filterType === 'monthly' ? endOfMonth(date) : endOfYear(date));
        return {
            tanggal_dari: format(start, 'yyyy-MM-dd'),
            tanggal_sampai: format(end, 'yyyy-MM-dd')
        };
    }, [date, filterType]);

    const { data, isLoading, refetch: fetchData } = useLabaRugiReport(reportParams);
    const { data: capitalData, refetch: fetchCapital } = useCapitalReport(reportParams);
    const reportData = data as LabaRugiReport | undefined;

    const flows = reportData?.kas_per_jenis || [];

    const totals = useMemo(() => {
        let totalMasuk = 0;
        let totalKeluar = 0;
        for (const item of flows) {
            totalMasuk += item.masuk || 0;
            totalKeluar += item.keluar || 0;
        }
        return {
            masuk: totalMasuk,
            keluar: totalKeluar,
            net: totalMasuk - totalKeluar,
        };
    }, [flows]);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            router.replace('/laporan');
        }
    }, [navigation, router]);

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
        if (!reportData) return;
        setIsExporting(true);
        try {
            const html = buildArusKasAkunExportHtml(reportData, capitalData as CapitalReport | undefined, date, filterType);

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
                    link.download = `ArusKasAkun_${formattedDate.replace(/ /g, '_')}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Laporan Arus Kas per Akun',
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
                title="Arus Kas per Akun"
                subtitle="Mutasi Uang Masuk & Keluar"
                onBack={handleBack}
                onExport={() => setShowExportMenu(true)}
                isExporting={isExporting}
            />

            <ScrollView
                className="flex-1 px-6 pt-4"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor="#0D9488" />
                }
            >
                <ReportDateControls
                    filterType={filterType}
                    onFilterTypeChange={setFilterType}
                    formattedDate={formattedDate}
                    onPrev={handlePrev}
                    onNext={handleNext}
                />

                {isLoading ? (
                    <View className="py-20 items-center justify-center">
                        <ActivityIndicator size="large" color="#0D9488" />
                        <Typography className="text-gray-400 text-xs font-bold mt-4 uppercase tracking-widest">
                            Memuat Data Arus Kas...
                        </Typography>
                    </View>
                ) : (
                    <>
                        {/* Summary Header Card (Matches Neraca Header Card Layout with Dynamic Colors) */}
                        {(() => {
                            const isPositive = totals.net >= 0;
                            const badgeBg = isPositive ? 'bg-teal-500/20 border-teal-500/20' : 'bg-rose-500/20 border-rose-500/20';
                            const badgeText = isPositive ? 'text-teal-400' : 'text-rose-400';
                            const statusNetText = isPositive ? 'text-emerald-400' : 'text-rose-400';
                            const statusIconColor = isPositive ? '#34D399' : '#F87171';
                            const cardBorder = isPositive ? 'border-slate-800' : 'border-rose-900/40';

                            return (
                                <View className={`bg-slate-900 p-6 rounded-[32px] shadow-xl shadow-slate-900/20 mb-8 mt-2 w-full border ${cardBorder}`}>
                                    <View className="flex-row justify-between items-center mb-6">
                                        <View className={`${badgeBg} px-3 py-1.5 rounded-full border`}>
                                            <Typography className={`${badgeText} text-[10px] font-bold uppercase tracking-widest`}>
                                                {isPositive ? 'Realisasi Surplus' : 'Realisasi Defisit'}
                                            </Typography>
                                        </View>
                                        <View className="flex-row items-center">
                                            <ArrowRightLeft size={14} color={statusIconColor} />
                                            <Typography className={`${statusNetText} text-[10px] font-bold ml-1.5`}>
                                                NET: {isPositive ? '+ ' : ''}{formatCurrencyDisplay(totals.net)}
                                            </Typography>
                                        </View>
                                    </View>
                                    <View className="flex-row justify-between pt-1">
                                        <View className="flex-1">
                                            <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Uang Masuk</Typography>
                                            <Typography weight="bold" className="text-emerald-400">{formatCurrencyDisplay(totals.masuk)}</Typography>
                                        </View>
                                        <View className="w-[1px] bg-slate-700/50 mx-4" />
                                        <View className="flex-1 items-end">
                                            <Typography className="text-slate-400 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Uang Keluar</Typography>
                                            <Typography weight="bold" className="text-rose-400">{formatCurrencyDisplay(totals.keluar)}</Typography>
                                        </View>
                                    </View>
                                </View>
                            );
                        })()}

                        {/* Section Header Indicator */}
                        <View className="flex-row items-center mb-4 px-2 mt-2">
                            <View className="w-2 h-8 bg-teal-500 rounded-full mr-3" />
                            <View>
                                <Typography variant="h3" weight="bold" className="text-text tracking-tight">MUTASI & POSISI KAS</Typography>
                                <Typography variant="caption" className="text-textGray">Rincian Per Akun Keuangan</Typography>
                            </View>
                        </View>

                        {/* Breakdown per Account Card */}
                        <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                            <View className="bg-teal-50/70 px-5 py-4 flex-row justify-between items-center border-b border-teal-100/50 w-full">
                                <View className="flex-row items-center">
                                    <View className="w-10 h-10 rounded-full bg-teal-100/80 items-center justify-center mr-3">
                                        <ArrowRightLeft size={20} color="#0D9488" />
                                    </View>
                                    <View>
                                        <Typography variant="h4" weight="bold" className="text-teal-900 tracking-tight">Rincian Mutasi Arus Kas</Typography>
                                        <Typography variant="caption" className="text-teal-700/60 uppercase text-[10px] tracking-wider mt-0.5">Cash Flow Breakdown</Typography>
                                    </View>
                                </View>
                                <View className="bg-teal-100/50 px-3 py-1.5 rounded-full border border-teal-200/30">
                                    <Typography variant="body2" weight="bold" className="text-teal-800">{flows.length} Akun</Typography>
                                </View>
                            </View>

                            <View className="p-5 w-full">
                                <Typography variant="caption" className="text-slate-400 text-[11px] mb-4">
                                    Rincian mutasi fisik arus kas per rekening/dompet selama periode {formattedDate}.
                                </Typography>
                                {flows.length === 0 ? (
                                    <View className="py-8 items-center justify-center">
                                        <Typography className="text-gray-400 font-medium">Tidak ada mutasi kas pada periode ini.</Typography>
                                    </View>
                                ) : (
                                    <KasArusJenisBreakdown flows={flows} />
                                )}
                            </View>
                        </Card>

                        {/* Ending Cash Position per Account */}
                        {(() => {
                            const details = (capitalData as any)?.info?.aset?.kas_jenis_details || [];
                            if (details.length === 0) return null;
                            const totalSaldoKas = details.reduce((acc: number, item: any) => acc + Number(item.saldo || 0), 0);

                            return (
                                <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                                    <View className="bg-indigo-50/70 px-5 py-4 flex-row justify-between items-center border-b border-indigo-100/50 w-full">
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 rounded-full bg-indigo-100/80 items-center justify-center mr-3">
                                                <Wallet size={20} color="#4F46E5" />
                                            </View>
                                            <View>
                                                <Typography variant="h4" weight="bold" className="text-indigo-900 tracking-tight">Posisi Saldo Kas per Akun</Typography>
                                                <Typography variant="caption" className="text-indigo-700/60 uppercase text-[10px] tracking-wider mt-0.5">Ending Cash Position</Typography>
                                            </View>
                                        </View>
                                        <View className="bg-indigo-100/50 px-3 py-1.5 rounded-full border border-indigo-200/30">
                                            <Typography variant="body2" weight="bold" className="text-indigo-800">
                                                {formatCurrencyDisplay(totalSaldoKas)}
                                            </Typography>
                                        </View>
                                    </View>

                                    <View className="p-5 w-full">
                                        <Typography variant="caption" className="text-slate-400 text-[11px] mb-3">
                                            Saldo posisi kas & bank per akun pada akhir periode {formattedDate}.
                                        </Typography>
                                        <KasJenisBreakdown details={details} />
                                    </View>
                                </Card>
                            );
                        })()}
                    </>
                )}
            </ScrollView>

            <ReportExportSheet
                visible={showExportMenu}
                onClose={() => setShowExportMenu(false)}
                subtitle="Pilih metode ekspor dokumen PDF"
                onPreview={() => handleExportPDF('preview')}
                onPrint={() => handleExportPDF('print')}
                onDownload={() => handleExportPDF('download')}
            />

            {/* PDF PREVIEW MODAL */}
            {showPdfPreview && (
                <Modal visible={showPdfPreview} animationType="slide">
                    <SafeAreaView className="flex-1 bg-white">
                        <View className="flex-row items-center justify-between p-4 border-b border-slate-100 bg-white">
                            <Pressable onPress={() => setShowPdfPreview(false)} className="p-2">
                                <X size={24} color="#64748b" />
                            </Pressable>
                            <Typography variant="body1" weight="bold">Pratinjau Laporan Arus Kas</Typography>
                            <Pressable onPress={() => handleExportPDF('print')} className="p-2">
                                <Printer size={24} color="#0D9488" />
                            </Pressable>
                        </View>
                        <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />
                    </SafeAreaView>
                </Modal>
            )}
        </SafeAreaView>
    );
}
