import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl as RNRefreshControl, ActivityIndicator, StatusBar, GestureResponderEvent, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, ArrowUpRight, ArrowDownLeft, DollarSign, Wallet, Download, Eye, Share2, X, AlertTriangle } from 'lucide-react-native';
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

// Types
type FilterType = 'daily' | 'monthly' | 'yearly';

export default function LaporanPerubahanModalScreen() {
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [showExportMenu, setShowExportMenu] = useState(false);
    const { themeColors } = useUIStore();

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
            const a5 = a1 + a4 + (report.section_a.modal_persediaan || 0); // Laba & Modal Awal + HPP + Assets

            // A.6 (Gross Profit)
            const a6 = report.section_a.total_laba || 0;
            // internal_bengkel_mobil removed (no longer bilateral)
            const a7 = report.section_a.total_a || 0; // Total A from Backend
            const a_aset_persediaan = report.section_a.aset_persediaan || 0;
            const a_aset_tetap = report.section_a.aset_tetap || 0;

            // B. Piutang
            const b1 = report.section_b.piutang_lainnya || 0;
            const b2 = report.section_b.piutang_mobil || 0;
            const b3 = report.section_b.piutang_part_mobil || 0;
            const b4 = report.section_b.piutang_jasa_angkut || 0;
            const b5 = report.section_b.piutang_karyawan || 0;
            const b6 = report.section_b.piutang_usaha || 0;

            const b7 = report.section_b.total_b || 0; // Total B from Backend (including assets)
            const b8 = a7 - b7; // Intermediate balance (A.7 - B.7) - Stock assets are in both A and B, so they cancel out to find cash.
            const b_aset_persediaan = report.section_b.aset_persediaan || 0;
            const b_aset_tetap = report.section_b.aset_tetap || 0;
            const b_total_piutang = (b1 + b2 + b3 + b4 + b5 + b6);
            const b_total_aset = (b_aset_persediaan + b_aset_tetap);

            // C. Pengurang
            const c_part_cash = report.section_c.pembelian_part?.cash || 0;
            const c_part_transfer = report.section_c.pembelian_part?.transfer || 0;
            const c_part_total = report.section_c.pembelian_part?.total || 0;
            const c_mobil_cash = report.section_c.pembelian_mobil?.cash || 0;
            const c_mobil_transfer = report.section_c.pembelian_mobil?.transfer || 0;
            const c_mobil_total = report.section_c.pembelian_mobil?.total || 0;
            const c_inv_cash = report.section_c.pengembalian_investor?.cash || 0;
            const c_inv_transfer = report.section_c.pengembalian_investor?.transfer || 0;
            const c_inv_total = report.section_c.pengembalian_investor?.total || 0;
            const c_op = report.section_c.operasional || 0;
            const c_gaji = report.section_c.gaji || 0;
            const c_lembur = report.section_c.lembur || 0;
            const c_prive = report.section_c.prive || 0;
            const c_prep = report.section_c.biaya_persiapan_display || 0;
            const c_inv_termasuk_prep = report.section_c.pengembalian_investor?.termasuk_biaya_persiapan || 0;
            const c_kasbon = report.section_c.kasbon_karyawan || 0;
            const c_lainnya = report.section_c.transaksi_lainnya || 0;

            const c4 = report.section_c.total_c || 0; // Total C from Backend (includes all)

            // E. Hutang
            const e_part = report.section_e.hutang_part || 0;
            const e_mobil = report.section_e.hutang_mobil || 0;
            const e_investor = report.section_e.hutang_investor || 0;
            const e_lainnya = report.section_e.hutang_lainnya || 0;
            const e1 = report.section_e.total_e || 0;

            const c5 = report.section_d.theoretical_modal || 0; // Modal Berjalan (A - B - C + E) from Backend

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
                        .sub-row { font-size: 9px; color: #555; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">LAPORAN SISA LABA & MODAL DI TANGAN TPM</div>
                        <div class="period">PERIODE: ${format(new Date(getDateParams().tanggal_dari), 'dd MMM yyyy', { locale: localeID })} - ${format(new Date(getDateParams().tanggal_sampai), 'dd MMM yyyy', { locale: localeID }).toUpperCase()}</div>
                        <div class="period">Waktu Cetak: ${new Date().toLocaleString('id-ID')}</div>
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
                            <td>ASET PERSEDIAAN</td>
                            <td class="amount">${formatCurrency(a_aset_persediaan)}</td>
                            <td></td>
                        </tr>
                        <tr class="border-bottom">
                            <td>ASET TETAP</td>
                            <td class="amount">${formatCurrency(a_aset_tetap)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" class="amount"></td>
                            <td class="amount">${formatCurrency(a4 + (report.section_a.modal_persediaan || 0))}</td>
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
                            <td colspan="3" style="font-weight: bold; font-style: italic; background-color: #f1f5f9; padding-bottom: 8px;">B. PIUTANG & ASET:</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="font-weight: bold; padding-left: 10px; color: #475569;">B.1 PIUTANG</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 20px;">PIUTANG LAINNYA</td>
                            <td class="amount">${formatCurrency(b1)}</td>
                            <td></td>
                        </tr>
                         <tr>
                            <td style="padding-left: 20px;">PIUTANG UNIT MOBIL</td>
                            <td class="amount">${formatCurrency(b2)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="padding-left: 20px;">PIUTANG SPAREPART MOBIL</td>
                            <td class="amount">${formatCurrency(b3)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="padding-left: 20px;">PIUTANG UNIT JASA ANGKUT</td>
                            <td class="amount">${formatCurrency(b4)}</td>
                            <td></td>
                        </tr>
                         <tr>
                            <td style="padding-left: 20px;">PIUTANG KARYAWAN (KASBON)</td>
                            <td class="amount">${b5 > 0 ? formatCurrency(b5) : 'Rp 0'}</td>
                            <td></td>
                        </tr>
                         <tr class="border-bottom">
                            <td style="padding-left: 20px;">PIUTANG UNIT BENGKEL</td>
                            <td class="amount">${formatCurrency(b6)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" style="font-style: italic; padding-left: 20px;">Subtotal Piutang</td>
                            <td class="amount" style="border-top: 1px dashed #ccc;">${formatCurrency(b_total_piutang)}</td>
                        </tr>

                        <tr>
                            <td colspan="3" style="font-weight: bold; padding-left: 10px; color: #475569; padding-top: 8px;">B.2 ASET</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 20px;">ASET PERSEDIAAN</td>
                            <td class="amount">${formatCurrency(b_aset_persediaan)}</td>
                            <td></td>
                        </tr>
                        <tr class="border-bottom">
                            <td style="padding-left: 20px;">ASET TETAP</td>
                            <td class="amount">${formatCurrency(b_aset_tetap)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" style="font-style: italic; padding-left: 20px;">Subtotal Aset</td>
                            <td class="amount" style="border-top: 1px dashed #ccc;">${formatCurrency(b_total_aset)}</td>
                        </tr>

                        <tr class="total-bar">
                            <td colspan="2">TOTAL B (PIUTANG & ASET)</td>
                            <td class="amount">${formatCurrency(b7)}</td>
                        </tr>
                        <tr class="total-bar" style="background-color: #475569;">
                            <td colspan="2">LABA & MODAL BERSIH (A-B)</td>
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
                            <td><b>TOTAL PEMBELIAN PART</b></td>
                            <td class="amount"><b>${formatCurrency(c_part_total)}</b></td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">a. Cash</td>
                            <td class="amount">${formatCurrency(c_part_cash)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">b. Transfer</td>
                            <td class="amount">${formatCurrency(c_part_transfer)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row">
                            <td><b>TOTAL PEMBELIAN MOBIL</b></td>
                            <td class="amount"><b>${formatCurrency(c_mobil_total)}</b></td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">a. Cash</td>
                            <td class="amount">${formatCurrency(c_mobil_cash)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">b. Transfer</td>
                            <td class="amount">${formatCurrency(c_mobil_transfer)}</td>
                            <td></td>
                        </tr>
                         <tr class="green-row border-bottom">
                            <td><b>TOTAL ARUS KELUAR JB MOBIL</b></td>
                            <td class="amount"><b>${formatCurrency(c_inv_total)}</b></td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">a. Cash</td>
                            <td class="amount">${formatCurrency(c_inv_cash)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row border-bottom">
                            <td style="padding-left: 20px;">b. Transfer</td>
                            <td class="amount">${formatCurrency(c_inv_transfer)}</td>
                            <td></td>
                        </tr>
                        ${c_prep ? `<tr class="green-row sub-row">
                            <td style="padding-left: 20px; font-style: italic;">*termasuk Biaya Persiapan Mobil: ${formatCurrency(c_prep)}</td>
                            <td></td>
                            <td></td>
                        </tr>` : ''}
                        <tr class="green-row">
                            <td>BEBAN OPERASIONAL BENGKEL</td>
                            <td class="amount">${formatCurrency(c_op)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row">
                            <td>BEBAN GAJI KARYAWAN</td>
                            <td class="amount">${formatCurrency(c_gaji)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row">
                            <td>BEBAN LEMBUR KARYAWAN</td>
                            <td class="amount">${formatCurrency(c_lembur)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row border-bottom">
                            <td>PRIVE (PENGAMBILAN PEMILIK)</td>
                            <td class="amount">${formatCurrency(c_prive)}</td>
                            <td></td>
                        </tr>
                        ${c_kasbon ? `<tr class="green-row border-bottom">
                            <td>KASBON KARYAWAN (NET)</td>
                            <td class="amount">${formatCurrency(c_kasbon)}</td>
                            <td></td>
                        </tr>` : ''}
                        ${c_lainnya ? `<tr class="green-row border-bottom">
                            <td>TRANSAKSI LAINNYA (NET)</td>
                            <td class="amount">${formatCurrency(c_lainnya)}</td>
                            <td></td>
                        </tr>` : ''}
                         <tr>
                            <td colspan="2"></td>
                            <td class="amount">${formatCurrency(c4)}</td>
                        </tr>
                         <tr class="total-bar">
                            <td colspan="2">LABA & MODAL (A-B-C)</td>
                            <td class="amount">${formatCurrency(b8 - c4)}</td>
                        </tr>
                    </table>

                    <div style="height: 10px; background-color: #6b7280; margin-bottom: 10px;"></div>

                    <!-- SECTION E -->
                    <table cellspacing="0">
                        <tr>
                            <td colspan="3" style="font-weight: bold; font-style: italic; background-color: #fee2e2;">E. HUTANG / KEWAJIBAN:</td>
                        </tr>
                        <tr>
                            <td>HUTANG PEMBELIAN PART</td>
                            <td class="amount">${formatCurrency(e_part)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>HUTANG PEMBELIAN MOBIL</td>
                            <td class="amount">${formatCurrency(e_mobil)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>HUTANG INVESTOR</td>
                            <td class="amount">${formatCurrency(e_investor)}</td>
                            <td></td>
                        </tr>
                        <tr class="border-bottom">
                            <td>HUTANG LAINNYA</td>
                            <td class="amount">${formatCurrency(e_lainnya)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2"></td>
                            <td class="amount">${formatCurrency(e1)}</td>
                        </tr>
                        <tr class="total-bar" style="background-color: #be123c;">
                            <td colspan="2">MODAL BERJALAN (= SALDO KAS & BANK)</td>
                            <td class="amount">${formatCurrency(finalCash + finalTransfer)}</td>
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
        <View className="bg-surface border-b border-gray-100">
            {/* Rule 2: Custom Header */}
            <View className="px-6 py-4 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color={themeColors.text} />
                    </Pressable>
                    <Typography variant="h2" weight="bold">Sisa Laba & Modal Di Tangan TPM</Typography>
                </View>
                <Pressable onPress={() => setShowExportMenu(true)} disabled={isExporting}>
                    <Download size={24} color={isExporting ? themeColors.textGray : themeColors.text} />
                </Pressable>
            </View>

            {/* Rule 9: Date Filter Pattern */}
            <View className="px-6 pb-4">
                {/* Tabs */}
                <View className="flex-row bg-gray-100 p-1 rounded-xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => setFilterType(type)}
                            className={`flex-1 py-2 items-center rounded-lg ${filterType === type ? 'bg-surface shadow-sm' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight={filterType === type ? 'bold' : 'medium'}
                                className={filterType === type ? 'text-primary' : 'text-gray-500'}
                            >
                                {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </Typography>
                        </Pressable>
                    ))}
                </View>

                {/* Navigator */}
                <View className="flex-row justify-between items-center bg-background px-4 py-3 rounded-xl border border-gray-100">
                    <Pressable onPress={handlePrev} className="p-1">
                        <ChevronLeft size={20} color="#64748B" />
                    </Pressable>
                    <View className="flex-row items-center">
                        <Calendar size={18} color="#64748B" className="mr-2" />
                        <Typography weight="semibold" className="text-gray-700">
                            {getFormattedDate()}
                        </Typography>
                    </View>
                    <Pressable onPress={handleNext} className="p-1">
                        <ChevronRight size={20} color="#64748B" />
                    </Pressable>
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
                    <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                        <ArrowUpRight size={18} color={themeColors.primary} />
                    </View>
                    <Typography variant="h4" weight="bold">A. Laba dan Modal Awal</Typography>
                </View>

                <View className="space-y-3">
                    <Row label="Setoran Modal" value={data.setoran_modal} />
                    <Row label="HPP / Modal Bengkel" value={data.hpp_bengkel} />
                    <Row label="HPP / Modal Jual Beli Mobil" value={data.hpp_mobil} />
                    <Row label="Aset Persediaan" value={data.aset_persediaan} />
                    <Row label="Aset Tetap" value={data.aset_tetap} />

                    <View className="ml-4 pl-4 border-l-2 border-primary/20 my-2 bg-background p-3 rounded-r-xl">
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
                    <Row label="Total Laba dan Modal" value={data.total_a} bold large color="text-primary" />
                </View>
            </Card>
        );
    };

    const renderSectionB = () => {
        const data = report?.section_b || {};
        return (
            <Card className="mb-6 p-4">
                <View className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-full bg-secondary/10 items-center justify-center mr-3">
                        <Wallet size={18} color={themeColors.secondary} />
                    </View>
                    <Typography variant="h4" weight="bold">B. PIUTANG & ASET</Typography>
                </View>

                <View className="space-y-3">
                    <View className="mb-2">
                        <Typography variant="body2" weight="bold" className="text-secondary/70 mb-2 uppercase tracking-wider">B.1 PIUTANG</Typography>
                        <View className="ml-2 space-y-3 border-l-2 border-secondary/10 pl-3">
                            <Row label="PIUTANG LAINNYA" value={data.piutang_lainnya} small />
                            <Row label="PIUTANG UNIT MOBIL" value={data.piutang_mobil} small />
                            <Row label="PIUTANG SPAREPART MOBIL" value={data.piutang_part_mobil} small />
                            <Row label="PIUTANG UNIT JASA ANGKUT" value={data.piutang_jasa_angkut} small />
                            <Row label="PIUTANG KARYAWAN (KASBON)" value={data.piutang_karyawan} small />
                            <Row label="PIUTANG UNIT BENGKEL" value={data.piutang_usaha} small />
                        </View>
                    </View>

                    <View className="mb-2 mt-4">
                        <Typography variant="body2" weight="bold" className="text-secondary/70 mb-2 uppercase tracking-wider">B.2 ASET</Typography>
                        <View className="ml-2 space-y-3 border-l-2 border-secondary/10 pl-3">
                            <Row label="ASET PERSEDIAAN" value={data.aset_persediaan} small />
                            <Row label="ASET TETAP" value={data.aset_tetap} small />
                        </View>
                    </View>

                    <View className="h-[1px] bg-gray-100 my-2" />
                    <Row label="Total B (Piutang & Aset)" value={data.total_b} bold large color="text-secondary" />
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
                        <Row label="Total Arus Keluar JB Mobil" value={data.pengembalian_investor?.total} bold />
                        <View className="ml-4 mt-1 space-y-1">
                            <Row label="Cash" value={data.pengembalian_investor?.cash} small />
                            <Row label="Transfer" value={data.pengembalian_investor?.transfer} small />
                            {data.pengembalian_investor?.accrued > 0 && (
                                <Row label="Penyesuaian Kewajiban (Hutang)" value={data.pengembalian_investor?.accrued} small color="text-rose-500" />
                            )}
                            {data.pengembalian_investor?.termasuk_biaya_persiapan > 0 && (
                                <Typography variant="caption" className="text-textGray italic text-[10px] mt-0.5 px-1">
                                    *termasuk Biaya Persiapan Mobil: {formatCurrency(data.pengembalian_investor.termasuk_biaya_persiapan)}
                                </Typography>
                            )}
                        </View>
                    </View>

                    <Row label="Beban Operasional Bengkel" value={data.operasional} isNegative />
                    <Row label="Beban Gaji Karyawan" value={data.gaji} isNegative />
                    <Row label="Beban Lembur Karyawan" value={data.lembur} isNegative />
                    <Row label="Prive (Pengambilan Pemilik)" value={data.prive} isNegative />
                    {data.kasbon_karyawan ? <Row label="Kasbon Karyawan (Net)" value={data.kasbon_karyawan} isNegative /> : null}
                    {data.transaksi_lainnya ? <Row label="Transaksi Lainnya (Net)" value={data.transaksi_lainnya} isNegative /> : null}

                    <View className="h-[1px] bg-gray-200 my-2" />
                    <Row label="Total Pengurangan" value={data.total_c} bold large color="text-red-600" />
                </View>
            </Card>
        );
    };

    const renderSectionE = () => {
        const data = report?.section_e || {};
        return (
            <Card className="mb-6 p-4 border-rose-100 bg-rose-50/10">
                <View className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-full bg-rose-100 items-center justify-center mr-3">
                        <AlertTriangle size={18} className="text-rose-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-rose-900">E. HUTANG / KEWAJIBAN</Typography>
                </View>

                <View className="space-y-3">
                    <Row label="Hutang Pembelian Part" value={data.hutang_part} />
                    <Row label="Hutang Pembelian Mobil" value={data.hutang_mobil} />
                    <Row label="Hutang Investor" value={data.hutang_investor} />
                    <Row label="Hutang Lainnya" value={data.hutang_lainnya} />

                    <View className="h-[1px] bg-rose-200 my-2" />
                    <Row label="Total Hutang Belum Lunas" value={data.total_e} color="text-rose-600" bold large />

                    <View className="mt-2 pt-2 border-t border-dashed border-rose-200">
                        <Typography variant="caption" className="text-rose-400 italic text-xs">
                            *Hutang adalah kewajiban yang belum dibayar tunai, sehingga uang kas masih ada di tangan (POSISI KREDIT MENAMBAH KAS).
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderSectionD = () => {
        const data = report?.section_d || {};
        return (
            <Card className="mb-24 p-5 bg-primary border-0 shadow-2xl relative overflow-hidden">
                {/* Decorative element */}
                <View className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />

                <View className="flex-row items-center mb-6">
                    <View className="w-10 h-10 rounded-2xl bg-white/20 items-center justify-center mr-4">
                        <DollarSign size={20} color="white" />
                    </View>
                    <View>
                        <Typography variant="h4" weight="bold" className="text-white">F. Sisa Laba dan Modal</Typography>
                        <Typography variant="caption" className="text-white/60">Posisi Kas & Rekonsiliasi Akhir</Typography>
                    </View>
                </View>

                <View className="space-y-4">
                    <Row label="Saldo Kas (Tunai)" value={data.cash} small isDark themeColors={themeColors} />
                    <Row label="Saldo Transfer / Bank" value={data.transfer} small isDark themeColors={themeColors} />

                    <View className="h-[1px] bg-white/10 my-2" />

                    <View className="flex-row justify-between items-center px-1">
                        <Typography className="text-white/60" variant="body2">Total Saldo Kas & Bank</Typography>
                        <Typography weight="bold" className="text-white" variant="h4">{formatCurrency(data.total_d || 0)}</Typography>
                    </View>

                    <View className="mt-4 p-4 bg-black/10 rounded-2xl border border-white/10">
                        <View className="flex-row items-center mb-3">
                            <View className="w-1.5 h-4 bg-secondary rounded-full mr-2" />
                            <Typography variant="caption" weight="bold" className="text-white/80 uppercase tracking-widest">Rekonsiliasi Modal</Typography>
                        </View>

                        <Row label="Modal Berjalan (= Saldo Kas & Bank)" value={data.theoretical_modal} bold large color="text-white" isDark themeColors={themeColors} />

                        {(!data.penyesuaian || Math.abs(data.penyesuaian) < 1) ? (
                            <View className="mt-2 flex-row items-center justify-center">
                                <Typography className="text-emerald-300 text-xs font-bold">✓ REKONSILIASI SEIMBANG</Typography>
                            </View>
                        ) : (
                            <View className="mt-2 flex-row items-center justify-center">
                                <Typography className="text-amber-300 text-xs font-bold">⚠ REKONSILIASI MEMERLUKAN PENYESUAIAN</Typography>
                            </View>
                        )}

                        {data.penyesuaian !== undefined && Math.abs(data.penyesuaian) >= 1 && (
                            <View className="mt-3 pt-3 border-t border-white/10 space-y-1">
                                <Row label="Modal Komponen (A - B - C + E)" value={data.modal_komponen} small color="text-white/50" isDark themeColors={themeColors} />
                                <Row label="Penyesuaian" value={data.penyesuaian} small color="text-amber-300/80" isDark themeColors={themeColors} />
                                <Typography variant="caption" className="text-white/30 italic leading-4 mt-1 px-1">
                                    *Penyesuaian = selisih antara perhitungan komponen dan saldo aktual kas. Bisa terjadi dari rounding, transaksi lintas periode, atau arus kas yang belum tercatat di laporan ini.
                                </Typography>
                            </View>
                        )}

                        <View className="mt-3 pt-3 border-t border-white/5">
                            <Typography variant="caption" className="text-white/40 italic leading-4">
                                *Modal Berjalan diturunkan langsung dari Saldo Kas & Bank aktual, sama seperti pendekatan Neraca (Aktiva = Hutang + Modal).
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
                        <ActivityIndicator size="large" color={themeColors.primary} />
                    </View>
                ) : (
                    <>
                        {renderSectionA()}
                        {renderSectionB()}
                        {renderSectionC()}
                        {renderSectionE()}
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
                            </Pressable>

                            <Pressable
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
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
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
    isDark,
    themeColors
}: {
    label: string,
    value: number,
    bold?: boolean,
    small?: boolean,
    large?: boolean,
    color?: string,
    isNegative?: boolean,
    isDark?: boolean,
    themeColors?: any
}) => (
    <View className="flex-row justify-between items-center">
        <Typography
            variant={small ? 'caption' : 'body2'}
            className={`${isDark ? 'text-white/60' : small ? 'text-textGray' : 'text-text'}`}
        >
            {label}
        </Typography>
        <Typography
            variant={large ? 'h3' : small ? 'caption' : 'body2'}
            weight={bold ? 'bold' : 'medium'}
            className={color || (isDark ? 'text-white' : 'text-text')}
        >
            {isNegative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value || 0)}
        </Typography>
    </View>
);

