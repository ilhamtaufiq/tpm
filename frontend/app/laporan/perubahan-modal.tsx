import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, GestureResponderEvent, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, DollarSign, Wallet, Download, Eye, Share2, X } from 'lucide-react-native';
import { Modal } from 'react-native';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { id as localeID } from 'date-fns/locale';

import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';
import { useCapitalReport } from '../../hooks/useKeuangan';

// Types
type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LaporanPerubahanModalScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Date Navigation helpers
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

    // calculate date params
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
            // A. Data Mapping
            const a1 = report.section_a.setoran_modal || 0;
            const a2 = report.section_a.hpp_bengkel || 0;
            const a3 = report.section_a.hpp_mobil || 0;
            const a4 = a2 + a3;
            const a5 = a1 + a4; // Laba & Modal Awal + HPP

            // A.6 (Gross Profit)
            const a6 = report.section_a.total_laba || 0;
            const a7 = report.section_a.total_a || 0; // Total A from Backend

            // B. Piutang
            const b1 = report.section_b.piutang_lainnya || 0;
            const b2 = report.section_b.piutang_mobil || 0;
            const b3 = report.section_b.piutang_bengkel || 0;
            const b4 = report.section_b.piutang_jasa_angkut || 0;
            const b5 = report.section_b.piutang_karyawan || 0;
            const b6 = 0; // Piutang Usaha

            const b7 = report.section_b.total_b || 0; // Total B from Backend
            const b8 = a7 - b7; // Intermediate balance

            // C. Pengurang
            const c1 = report.section_c.pembelian_part?.total || 0;
            const c2 = report.section_c.pembelian_mobil?.total || 0;
            const c3 = report.section_c.pengembalian_investor?.total || 0;
            const c_op = report.section_c.operasional || 0;
            const c_gaji = report.section_c.gaji || 0;

            const c4 = report.section_c.total_c || 0; // Total C from Backend (includes all)
            const c5 = report.section_d.theoretical_modal || 0; // Modal Berjalan (A - B - C) from Backend

            // Final Balances
            const finalCash = report.section_d.cash || 0;
            const finalTransfer = report.section_d.transfer || 0;

            const html = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        body { font-family: 'Helvetica', sans-serif; font-size: 10px; color: #000; padding: 20px; }
                        .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
                        .title { font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
                        .period { font-size: 10px; margin-top: 2px; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        td { padding: 4px 6px; }
                        .amount { text-align: right; }
                        
                        .section-head { background-color: #93c5fd; font-weight: bold; border: 1px solid #fff; }
                        .total-bar { background-color: #3b82f6; color: white; font-weight: bold; }
                        .green-row { background-color: #bbf7d0; }
                        .pink-box { background-color: #fca5a5; font-weight: bold; }
                        
                        .border-bottom { border-bottom: 1px solid #000; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">LAPORAN SISA LABA & MODAL DI TANGAN TPM</div>
                        <div class="period">PERIODE: ${format(new Date(getDateParams().tanggal_dari), 'dd MMM yyyy', { locale: localeID })} - ${format(new Date(getDateParams().tanggal_sampai), 'dd MMM yyyy', { locale: localeID }).toUpperCase()}</div>
                    </div>

                    <!-- SECTION A -->
                    <table cellspacing="0">
                        <tr class="section-head">
                            <td colspan="2">LABA & MODAL AWAL</td>
                            <td class="amount">${formatCurrency(a1)}</td>
                        </tr>
                        <tr>
                            <td>HPP/ MODAL PART & LAYANAN BENGKEL</td>
                            <td class="amount">${formatCurrency(a2)}</td>
                            <td></td>
                        </tr>
                        <tr class="border-bottom">
                            <td>HPP/ MODAL JUAL BELI MOBIL</td>
                            <td class="amount">${formatCurrency(a3)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" class="amount"></td>
                            <td class="amount">${formatCurrency(a4)}</td>
                        </tr>
                        <tr class="border-bottom">
                            <td colspan="2" class="amount"></td>
                            <td class="amount">${formatCurrency(a5)}</td>
                        </tr>
                        <tr>
                            <td colspan="2">TOTAL LABA KOTOR (UNIT)</td>
                            <td class="amount">${formatCurrency(a6)}</td>
                        </tr>
                        <tr class="total-bar">
                            <td colspan="2">LABA & MODAL</td>
                            <td class="amount">${formatCurrency(a7)}</td>
                        </tr>
                    </table>

                    <div style="height: 10px; background-color: #6b7280; margin-bottom: 10px;"></div>

                    <!-- SECTION B -->
                    <table cellspacing="0">
                        <tr>
                            <td colspan="3" style="font-weight: bold; font-style: italic;">UANG DILUAR:</td>
                        </tr>
                        <tr>
                            <td>PIUTANG LAINNYA</td>
                            <td class="amount">${formatCurrency(b1)}</td>
                            <td></td>
                        </tr>
                         <tr>
                            <td>PIUTANG JB MOBIL</td>
                            <td class="amount">${formatCurrency(b2)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>PIUTANG PART JB MOBIL</td>
                            <td class="amount">${formatCurrency(b3)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>PIUTANG SUPIR JASA ANGKUT</td>
                            <td class="amount">${formatCurrency(b4)}</td>
                            <td></td>
                        </tr>
                         <tr>
                            <td>PIUTANG KARYAWAN</td>
                            <td class="amount">${formatCurrency(b5)}</td>
                            <td></td>
                        </tr>
                         <tr class="border-bottom">
                            <td>PIUTANG USAHA</td>
                            <td class="amount">${formatCurrency(b6)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2"></td>
                            <td class="amount">${formatCurrency(b7)}</td>
                        </tr>
                        <tr class="total-bar">
                            <td colspan="2">LABA & MODAL</td>
                            <td class="amount">${formatCurrency(b8)}</td>
                        </tr>
                    </table>

                    <div style="height: 10px; background-color: #6b7280; margin-bottom: 10px;"></div>

                    <!-- SECTION C -->
                    <table cellspacing="0">
                        <tr>
                            <td colspan="3" style="font-weight: bold; font-style: italic;">PENGURANG LABA & MODAL:</td>
                        </tr>
                        <tr class="green-row">
                            <td>TOTAL PEMBELIAN PART CASH</td>
                            <td class="amount">${formatCurrency(c1)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row">
                            <td>TOTAL PEMBELIAN MOBIL CASH</td>
                            <td class="amount">${formatCurrency(c2)}</td>
                            <td></td>
                        </tr>
                         <tr class="green-row border-bottom">
                            <td>TOTAL PENGEMBALIAN MODAL INVESTOR JB MOBIL</td>
                            <td class="amount">${formatCurrency(c3)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row">
                            <td>BEBAN OPERASIONAL BENGKEL</td>
                            <td class="amount">${formatCurrency(c_op)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row border-bottom">
                            <td>BEBAN GAJI KARYAWAN</td>
                            <td class="amount">${formatCurrency(c_gaji)}</td>
                            <td></td>
                        </tr>
                         <tr>
                            <td colspan="2"></td>
                            <td class="amount">${formatCurrency(c4)}</td>
                        </tr>
                         <tr class="total-bar">
                            <td colspan="2">LABA & MODAL</td>
                            <td class="amount">${formatCurrency(c5)}</td>
                        </tr>
                    </table>

                    <div style="height: 10px; background-color: #6b7280; margin-bottom: 10px;"></div>

                    <!-- SECTION D -->
                     <table cellspacing="0" class="pink-box">
                        <tr>
                            <td rowspan="2" style="vertical-align: middle; text-align: center; font-weight: bold; width: 40%">SISA LABA & MODAL DI TANGAN AKHIR</td>
                            <td class="amount border-bottom" style="width: 30%">${formatCurrency(finalCash)}</td>
                            <td style="font-style: italic; font-size: 8px; width: 30%">*UANG CASH</td>
                        </tr>
                        <tr>
                            <td class="amount">${formatCurrency(finalTransfer)}</td>
                            <td style="font-style: italic; font-size: 8px;">*UANG DI BANK</td>
                        </tr>
                    </table>

                </body>
                </html>
            `;

            if (Platform.OS === 'web') {
                if (mode === 'preview') {
                    const printWindow = (window as any).open('', '_blank');
                    if (printWindow) {
                        printWindow.document.write(html);
                        printWindow.document.close();
                        printWindow.focus();
                    } else {
                        alert("Popup diblokir. Izinkan popup untuk mencetak PDF.");
                    }
                } else {
                    // Direct Download for Web using html2pdf.js
                    try {
                        const html2pdf = require('html2pdf.js');
                        const element = document.createElement('div');
                        element.innerHTML = html;
                        element.style.padding = '20px';

                        const opt = {
                            margin: 0,
                            filename: `Laporan_Perubahan_Modal_${format(new Date(), 'yyyyMMdd')}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2, useCORS: true, logging: false },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };

                        await html2pdf().from(element).set(opt).save();
                    } catch (err) {
                        console.error("Direct download failed, falling back:", err);
                        // Fallback to basic print to file which might open dialog
                        const { uri } = await Print.printToFileAsync({ html });
                        const link = document.createElement('a');
                        link.href = uri;
                        link.download = `Laporan_Perubahan_Modal_${format(new Date(), 'yyyyMMdd')}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                }
            } else {
                // Native Platform
                if (mode === 'preview') {
                    await Print.printAsync({ html });
                } else {
                    const { uri } = await Print.printToFileAsync({ html });
                    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                }
            }
        } catch (error) {
            console.error(error);
            alert(`Gagal membuat PDF: ${error}`);
        } finally {
            setIsExporting(false);
        }
    };

    const renderHeader = () => (
        <View className="bg-white border-b border-gray-100">
            {/* Rule 2: Custom Header */}
            <View className="px-6 py-4 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </TouchableOpacity>
                    <Typography variant="h2" weight="bold">Sisa Laba & Modal Di Tangan TPM</Typography>
                </View>
                <TouchableOpacity onPress={() => setShowExportMenu(true)} disabled={isExporting}>
                    <Download size={24} color={isExporting ? "#9ca3af" : "#0F172A"} />
                </TouchableOpacity>
            </View>

            {/* Rule 9: Date Filter Pattern */}
            <View className="px-6 pb-4">
                {/* Tabs */}
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setFilterType(type)}
                            className={`flex-1 py-2 items-center rounded-lg ${filterType === type ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight={filterType === type ? 'bold' : 'medium'}
                                className={filterType === type ? 'text-primary' : 'text-gray-500'}
                            >
                                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Navigator */}
                <View className="flex-row justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <TouchableOpacity onPress={handlePrev} className="p-1">
                        <ChevronLeft size={20} color="#64748B" />
                    </TouchableOpacity>
                    <View className="flex-row items-center">
                        <Calendar size={18} color="#64748B" className="mr-2" />
                        <Typography weight="semibold" className="text-gray-700">
                            {getFormattedDate()}
                        </Typography>
                    </View>
                    <TouchableOpacity onPress={handleNext} className="p-1">
                        <ChevronRight size={20} color="#64748B" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderSectionA = () => {
        const data = report?.section_a || {};
        const details = data.details || {};
        return (
            <Card className="mb-6 p-4">
                <View className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-3">
                        <ArrowUpRight size={18} className="text-green-600" />
                    </View>
                    <Typography variant="h4" weight="bold">A. Laba dan Modal Awal</Typography>
                </View>

                <View className="space-y-3">
                    <Row label="Setoran Modal" value={data.setoran_modal} />
                    <Row label="HPP / Modal Bengkel" value={data.hpp_bengkel} />
                    <Row label="HPP / Modal Jual Beli Mobil" value={data.hpp_mobil} />

                    <View className="ml-4 pl-4 border-l-2 border-primary/20 my-2 bg-gray-50/50 p-3 rounded-r-xl">
                        <Typography variant="caption" weight="bold" className="mb-2 text-primary uppercase tracking-tighter">Rincian Laba Unit</Typography>
                        <Row label="1. Laba Bengkel" value={details.laba_bengkel} small />

                        <View className="mt-2 mb-1">
                            <Row label="2. Laba Jual Beli Mobil (Kotor)" value={details.laba_kotor_mobil} small />
                            <Row label="   - Porsi Investor" value={details.laba_investor_mobil} small isNegative />
                            <Row label="   = Laba TPM Mobil" value={details.laba_mobil} small bold />
                        </View>

                        <Row label="3. Laba Jasa Angkut" value={details.laba_jasa_angkut} small />

                        <View className="h-[1px] bg-gray-200 my-2" />
                        <Row label="TOTAL LABA KOTOR (UNIT)" value={data.total_laba} bold color="text-primary" />
                    </View>

                    <View className="h-[1px] bg-gray-200 my-2" />
                    <Row label="Total Laba dan Modal" value={data.total_a} bold large color="text-green-600" />
                </View>
            </Card>
        );
    };

    const renderSectionB = () => {
        const data = report?.section_b || {};
        return (
            <Card className="mb-6 p-4">
                <View className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                        <Wallet size={18} className="text-blue-600" />
                    </View>
                    <Typography variant="h4" weight="bold">B. Piutang</Typography>
                </View>

                <View className="space-y-3">
                    <Row label="Piutang Lainnya" value={data.piutang_lainnya} />
                    <Row label="Piutang Jual Beli Mobil" value={data.piutang_mobil} />
                    <Row label="Piutang Sparepart & Servis" value={data.piutang_bengkel} />
                    <Row label="Piutang Jasa Angkut" value={data.piutang_jasa_angkut} />
                    <Row label="Piutang Karyawan" value={data.piutang_karyawan} />

                    <View className="h-[1px] bg-gray-200 my-2" />
                    <Row label="Total Piutang" value={data.total_b} bold large color="text-blue-600" />
                </View>
            </Card>
        );
    };

    const renderSectionC = () => {
        const data = report?.section_c || {};
        return (
            <Card className="mb-6 p-4">
                <View className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center mr-3">
                        <ArrowDownLeft size={18} className="text-red-600" />
                    </View>
                    <Typography variant="h4" weight="bold">C. Pengurangan Laba & Modal</Typography>
                </View>

                <View className="space-y-4">
                    <View>
                        <Row label="Total Pembelian Part" value={data.pembelian_part?.total} bold />
                        <View className="ml-4 mt-1 space-y-1">
                            <Row label="Cash" value={data.pembelian_part?.cash} small />
                            <Row label="Transfer" value={data.pembelian_part?.transfer} small />
                        </View>
                    </View>

                    <View>
                        <Row label="Total Pembelian Mobil" value={data.pembelian_mobil?.total} bold />
                        <View className="ml-4 mt-1 space-y-1">
                            <Row label="Cash" value={data.pembelian_mobil?.cash} small />
                            <Row label="Transfer" value={data.pembelian_mobil?.transfer} small />
                        </View>
                    </View>

                    <View>
                        <Row label="Total Pengembalian Investor" value={data.pengembalian_investor?.total} bold />
                        <View className="ml-4 mt-1 space-y-1">
                            <Row label="Cash" value={data.pengembalian_investor?.cash} small />
                            <Row label="Transfer" value={data.pengembalian_investor?.transfer} small />
                        </View>
                    </View>

                    <Row label="Beban Operasional Bengkel" value={data.operasional} isNegative />
                    <Row label="Beban Gaji Karyawan" value={data.gaji} isNegative />

                    <View className="h-[1px] bg-gray-200 my-2" />
                    <Row label="Total Pengurangan" value={data.total_c} bold large color="text-red-600" />
                </View>
            </Card>
        );
    };

    const renderSectionD = () => {
        const data = report?.section_d || {};
        return (
            <Card className="mb-24 p-5 bg-green-900 border-0 shadow-2xl relative overflow-hidden">
                {/* Decorative element */}
                <View className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/5 rounded-full" />

                <View className="flex-row items-center mb-6">
                    <View className="w-10 h-10 rounded-2xl bg-yellow-400/20 items-center justify-center mr-4">
                        <DollarSign size={20} className="text-yellow-400" />
                    </View>
                    <View>
                        <Typography variant="h4" weight="bold" className="text-white">D. Sisa Laba dan Modal</Typography>
                        <Typography variant="caption" className="text-slate-400">Posisi Kas & Rekonsiliasi Akhir</Typography>
                    </View>
                </View>

                <View className="space-y-4">
                    <Row label="Saldo Kas (Tunai)" value={data.cash} small isDark />
                    <Row label="Saldo Transfer / Bank" value={data.transfer} small isDark />

                    <View className="h-[1px] bg-slate-800 my-2" />

                    <View className="flex-row justify-between items-center px-1">
                        <Typography className="text-slate-400" variant="body2">Total Saldo Kas & Bank</Typography>
                        <Typography weight="bold" className="text-white" variant="h4">{formatCurrency(data.total_d || 0)}</Typography>
                    </View>

                    <View className="mt-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <View className="flex-row items-center mb-3">
                            <View className="w-1.5 h-4 bg-yellow-400 rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-slate-300 uppercase tracking-widest">Rekonsiliasi Modal</Typography>
                        </View>

                        <Row label="Modal Berjalan (A - C)" value={data.theoretical_modal} bold large color="text-yellow-400" isDark />

                        <View className="mt-3 pt-3 border-t border-slate-700/50">
                            <Typography variant="caption" className="text-slate-500 italic leading-4">
                                *Angka ini merupakan akumulasi Laba Kotor dikurangi Biaya & Pengembalian Modal. Idealnya saldo Kas + Piutang mendekati angka ini.
                            </Typography>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {renderHeader()}

            <ScrollView
                className="flex-1 px-4 pt-4"
                refreshControl={<RNRefreshControl refreshing={isLoading} onRefresh={refetch} />}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color="#0F172A" />
                    </View>
                ) : (
                    <>
                        {renderSectionA()}
                        {renderSectionB()}
                        {renderSectionC()}
                        {renderSectionD()}
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
                    <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-8">
                            <View>
                                <Typography variant="h3" weight="bold">Ekspor Laporan</Typography>
                                <Typography variant="caption" className="text-gray-500">Pilih metode ekspor dokumen PDF</Typography>
                            </View>
                            <TouchableOpacity onPress={() => setShowExportMenu(false)} className="bg-gray-100 p-2 rounded-full">
                                <X size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => {
                                    setShowExportMenu(false);
                                    setTimeout(() => handleExportPDF('preview'), 100);
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
                                onPress={() => {
                                    setShowExportMenu(false);
                                    setTimeout(() => handleExportPDF('download'), 100);
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

// Helper Row Component
const Row = ({
    label,
    value,
    bold,
    small,
    large,
    color,
    isNegative,
    isDark
}: {
    label: string,
    value: number,
    bold?: boolean,
    small?: boolean,
    large?: boolean,
    color?: string,
    isNegative?: boolean,
    isDark?: boolean
}) => (
    <View className="flex-row justify-between items-center">
        <Typography
            variant={small ? 'caption' : 'body2'}
            className={`${isDark ? 'text-slate-400' : small ? 'text-gray-500' : 'text-gray-700'}`}
        >
            {label}
        </Typography>
        <Typography
            variant={large ? 'h3' : small ? 'caption' : 'body2'}
            weight={bold ? 'bold' : 'medium'}
            className={color || (isDark ? 'text-white' : 'text-gray-900')}
        >
            {isNegative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value || 0)}
        </Typography>
    </View>
);

