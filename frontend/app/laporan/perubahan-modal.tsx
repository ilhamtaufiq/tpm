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

    const getHeaderDate = () => {
        if (filterType === 'daily') return format(date, 'dd MMM yyyy', { locale: localeID });
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
            // Asset stock from Section A
            const a_stok_part = report.section_a.persediaan_part || 0;
            const a_stok_mobil = report.section_a.persediaan_mobil || 0;
            const a_aset_tetap = report.section_a.aset_tetap || 0;
            const a5 = a1 + a4 + a_stok_part + a_stok_mobil + a_aset_tetap; // Capital + HPP + Stock + Assets

            // A.6 (Gross Profit)
            const a6 = report.section_a.total_laba || 0;
            const a7 = report.section_a.total_a || 0; 

            // B. Piutang
            const b1 = report.section_b.piutang_lainnya || 0;
            const b2 = report.section_b.piutang_mobil || 0;
            const b3 = report.section_b.piutang_part_mobil || 0;
            const b4 = report.section_b.piutang_jasa_angkut || 0;
            const b5 = report.section_b.piutang_karyawan || 0;
            const b6 = report.section_b.piutang_usaha || 0;

            const b7 = report.section_b.total_b || 0; 
            const b8 = a7 - b7; 
            const b_stok_part = report.section_b.stok_part || 0;
            const b_stok_mobil = report.section_b.stok_mobil || 0;
            const b_aset_tetap = report.section_b.aset_tetap || 0;
            const b_total_piutang = (b1 + b2 + b3 + b4 + b5 + b6);
            const b_total_aset = (b_stok_part + b_stok_mobil + b_aset_tetap);

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
            const c_op_umum = report.section_c.operasional_unit_details?.umum || 0;
            const c_op_bengkel = report.section_c.operasional_unit_details?.bengkel || 0;
            const c_op_mobil = report.section_c.operasional_unit_details?.mobil || 0;
            const c_op_ja = report.section_c.operasional_unit_details?.jasa_angkut || 0;
            const c_jtb_mobil_bengkel = report.section_c.operasional_unit_details?.mobil_bengkel || 0;
            const c_jtb_mobil_prep = report.section_c.operasional_unit_details?.mobil_prep || 0;
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
                            <td>PERSEDIAAN SPAREPART</td>
                            <td class="amount">${formatCurrency(report.section_a.persediaan_part || 0)}</td>
                            <td></td>
                        </tr>
                        <tr class="border-bottom">
                            <td>PERSEDIAAN UNIT MOBIL</td>
                            <td class="amount">${formatCurrency(report.section_a.persediaan_mobil || 0)}</td>
                            <td></td>
                        </tr>
                        <tr class="border-bottom">
                            <td>ASET TETAP</td>
                            <td class="amount">${formatCurrency(report.section_a.aset_tetap || 0)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" class="amount">Subtotal Modal & Inventaris</td>
                            <td class="amount">${formatCurrency(a5)}</td>
                        </tr>
                        <tr>
                            <td colspan="2">TOTAL LABA BENGKEL</td>
                            <td class="amount">${formatCurrency(report.section_a.details?.laba_bengkel || 0)}</td>
                        </tr>
                        <tr>
                            <td colspan="2">TOTAL LABA MOBIL</td>
                            <td class="amount">${formatCurrency(report.section_a.details?.laba_kotor_mobil || 0)}</td>
                        </tr>
                        <tr>
                            <td colspan="2">TOTAL LABA JASA ANGKUT</td>
                            <td class="amount">${formatCurrency(report.section_a.details?.laba_jasa_angkut || 0)}</td>
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
                            <td style="padding-left: 20px;">PIUTANG SPAREPART / SERVIS MOBIL</td>
                            <td class="amount">${formatCurrency(b3)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="padding-left: 20px;">PIUTANG UNIT JASA ANGKUT</td>
                            <td class="amount">${formatCurrency(b4)}</td>
                            <td></td>
                        </tr>
                         <tr>
                            <td style="padding-left: 20px;">PIUTANG KARYAWAN</td>
                            <td class="amount">${formatCurrency(b5)}</td>
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
                            <td style="padding-left: 20px;">PERSEDIAAN SPAREPART</td>
                            <td class="amount">${formatCurrency(b_stok_part)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td style="padding-left: 20px;">PERSEDIAAN UNIT MOBIL</td>
                            <td class="amount">${formatCurrency(b_stok_mobil)}</td>
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
                            <td class="amount">${formatCurrency(report.section_c.pembelian_part?.cash)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">b. Transfer</td>
                            <td class="amount">${formatCurrency(report.section_c.pembelian_part?.transfer)}</td>
                            <td></td>
                        </tr>
                        ${report.section_c.pembelian_part?.accrued > 0 ? `
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px; color: #991b1b;">c. Kredit / Hutang</td>
                            <td class="amount" style="color: #991b1b;">${formatCurrency(report.section_c.pembelian_part.accrued)}</td>
                            <td></td>
                        </tr>` : ''}
                        <tr class="green-row">
                            <td><b>TOTAL PEMBELIAN MOBIL</b></td>
                            <td class="amount"><b>${formatCurrency(report.section_c.pembelian_mobil?.total)}</b></td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">a. Cash</td>
                            <td class="amount">${formatCurrency(report.section_c.pembelian_mobil?.cash)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">b. Transfer</td>
                            <td class="amount">${formatCurrency(report.section_c.pembelian_mobil?.transfer)}</td>
                            <td></td>
                        </tr>
                        ${report.section_c.pembelian_mobil?.accrued > 0 ? `
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px; color: #991b1b;">c. Kredit / Hutang</td>
                            <td class="amount" style="color: #991b1b;">${formatCurrency(report.section_c.pembelian_mobil.accrued)}</td>
                            <td></td>
                        </tr>` : ''}
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
                            <td><b>TOTAL BEBAN OPERASIONAL</b></td>
                            <td class="amount"><b>${formatCurrency(c_op_umum + c_op_bengkel + c_op_mobil + c_op_ja)}</b></td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">- Operasional Umum</td>
                            <td class="amount">${formatCurrency(c_op_umum)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">- Operasional Unit Bisnis Bengkel</td>
                            <td class="amount">${formatCurrency(c_op_bengkel)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">- Operasional Unit Bisnis Mobil</td>
                            <td class="amount">${formatCurrency(c_op_mobil)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">- Operasional Unit Bisnis Jasa Angkut</td>
                            <td class="amount">${formatCurrency(c_op_ja)}</td>
                            <td></td>
                        </tr>
                        ${report.section_c.operasional_unit_details?.jasa_angkut_bengkel > 0 ? `
                        <tr class="green-row">
                            <td style="color: #991b1b;"><b>BIAYA OPERASIONAL JASA ANGKUT (PER ARMADA)</b></td>
                            <td class="amount" style="color: #991b1b;"><b>${formatCurrency(report.section_c.operasional_unit_details.jasa_angkut_bengkel)}</b></td>
                            <td></td>
                        </tr>
                        ${Object.entries(report.section_c.operasional_unit_details.jasa_angkut_detailed_breakdown || {}).map(([name, detail]: [string, any]) => `
                            <tr class="green-row sub-row" style="font-weight: bold; background-color: #fff1f2;">
                                <td style="padding-left: 20px;">• ${name}</td>
                                <td class="amount">${formatCurrency(detail.total)}</td>
                                <td></td>
                            </tr>
                            ${detail.bengkel > 0 ? `
                            <tr class="green-row sub-row" style="font-size: 0.85em; opacity: 0.8;">
                                <td style="padding-left: 40px;">- Biaya Bengkel</td>
                                <td class="amount">${formatCurrency(detail.bengkel)}</td>
                                <td></td>
                            </tr>` : ''}
                            ${detail.ops > 0 ? `
                            <tr class="green-row sub-row" style="font-size: 0.85em; opacity: 0.8;">
                                <td style="padding-left: 40px;">- Biaya Ops</td>
                                <td class="amount">${formatCurrency(detail.ops)}</td>
                                <td></td>
                            </tr>` : ''}
                        `).join('')}
                        ` : ''}
                        <tr class="green-row">
                            <td><b>BEBAN BIAYA JUAL BELI MOBIL</b></td>
                            <td class="amount"><b>${formatCurrency(c_mobil_total + c_jtb_mobil_prep)}</b></td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">- Pembelian Unit Mobil</td>
                            <td class="amount">${formatCurrency(c_mobil_total)}</td>
                            <td></td>
                        </tr>
                        <tr class="green-row sub-row">
                            <td style="padding-left: 20px;">- Biaya Persiapan (Pajak, BBN, dll)</td>
                            <td class="amount">${formatCurrency(c_jtb_mobil_prep)}</td>
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
        <>
            {/* Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl z-20">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Laba & Modal</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Laporan Komprehensif TPM</Typography>
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
                            {isExporting ? <ActivityIndicator size="small" color="white" /> : <Download size={22} color="white" />}
                        </Pressable>
                    </View>
                </View>

                {/* Filter Tabs */}
                <View className="flex-row bg-black/20 p-1.5 rounded-2xl border border-white/5">
                    {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => setFilterType(type)}
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
            <View className="px-6 -mt-6 z-30">
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
        </>
    );

    const renderSectionA = () => {
        const data = report?.section_a || {};
        const details = data.details || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-blue-50/70 px-5 py-4 flex-row items-center border-b border-blue-100/50 w-full">
                    <View className="w-8 h-8 rounded-full bg-blue-100/80 items-center justify-center mr-3">
                        <ArrowUpRight size={18} className="text-blue-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-blue-900 tracking-tight">A. Laba dan Modal Awal</Typography>
                </View>
                <View className="p-5 space-y-4 w-full">
                    <View className="space-y-1">
                        <Row label="Total Setoran Modal" value={data.setoran_modal} bold />
                    </View>

                    <View className="bg-slate-50 rounded-xl p-4 border border-slate-100 w-full shadow-sm shadow-slate-100/50">
                        <Typography variant="caption" weight="bold" className="mb-3 text-slate-500 uppercase tracking-widest text-[10px]">Rincian Laba Operasional</Typography>

                        <View className="space-y-1">
                            <View className="mb-2">
                                <Row label="1. Laba Bengkel" value={details.laba_bengkel} small />
                                {details.hpp_bengkel > 0 && (
                                    <View className="pl-4">
                                        <Typography variant="caption" className="text-slate-400 italic text-[9px]">Termasuk HPP Bengkel: {formatCurrency(details.hpp_bengkel)}</Typography>
                                    </View>
                                )}
                            </View>

                            <View className="mt-2 pt-2 border-t border-slate-200/60 mb-2">
                                <Row label="2. Laba Mobil" value={details.laba_kotor_mobil} small />
                                <View className="pl-4">
                                    <Typography variant="caption" className="text-slate-400 italic text-[9px]">Berdasarkan HPP/Modal Mobil: {formatCurrency(details.hpp_mobil)}</Typography>
                                </View>
                            </View>

                            <View className="mt-2 pt-2 border-t border-slate-200/60 mb-2">
                                <Row label="3. Laba Jasa Angkut" value={details.laba_jasa_angkut} small />
                            </View>
                        </View>

                        <View className="h-px bg-blue-200/60 my-3" />
                        <Row label="Total Laba Kotor (Unit)" value={data.total_laba} bold color="text-blue-700" />
                    </View>

                    <View className="bg-blue-50/40 rounded-xl p-4 border border-blue-100/60 w-full">
                        <Typography variant="caption" weight="bold" className="mb-3 text-blue-700/70 uppercase tracking-widest text-[10px]">Komponen Persediaan & Aset</Typography>
                        <View className="space-y-1">
                            <Row label="Persediaan Sparepart" value={data.persediaan_part || 0} small />
                            <Row label="Persediaan Unit Mobil" value={data.persediaan_mobil || 0} small />
                            <Row label="Aset Tetap" value={data.aset_tetap || 0} small />
                        </View>
                    </View>

                    <View className="pt-3 border-t-2 border-dashed border-slate-200">
                        <Row label="TOTAL A (Laba dan Modal)" value={data.total_a} bold large color="text-slate-800" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderSectionB = () => {
        const data = report?.section_b || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-emerald-50/70 px-5 py-4 flex-row items-center border-b border-emerald-100/50 w-full">
                    <View className="w-8 h-8 rounded-full bg-emerald-100/80 items-center justify-center mr-3">
                        <Wallet size={18} className="text-emerald-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-emerald-900 tracking-tight">B. Piutang & Aset Persediaan</Typography>
                </View>

                <View className="p-5 space-y-5 w-full">
                    <View className="mb-2">
                        <Typography variant="caption" weight="bold" className="text-emerald-700/70 mb-2 uppercase tracking-widest pl-1 text-[10px]">B.1 Piutang Tersebar</Typography>
                        <View className="space-y-1 bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50">
                            <Row label="Piutang Usaha (Bengkel Umum)" value={data.piutang_usaha} small />
                            <Row label="Piutang Pembelian Mobil (Unit)" value={data.piutang_mobil} small />
                            <Row label="Piutang Sparepart / Servis Mobil" value={data.piutang_part_mobil} small />
                            <Row label="Piutang Jasa Angkut" value={data.piutang_jasa_angkut} small />
                            <Row label="Piutang Karyawan" value={data.piutang_karyawan || 0} small />
                            <Row label="Piutang Lainnya" value={data.piutang_lainnya} small />
                        </View>
                    </View>

                    <View>
                        <Typography variant="caption" weight="bold" className="text-emerald-700/70 mb-2 uppercase tracking-widest pl-1 text-[10px]">B.2 Persediaan & Aset Fisik</Typography>
                        <View className="space-y-1 bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50">
                            <Row label="Persediaan Sparepart (Stok Sparepart)" value={data.stok_part} small />
                            <Row label="Persediaan Unit Mobil (Stok Mobil)" value={data.stok_mobil} small />
                            <Row label="Aset Tetap (Kantor/Alat)" value={data.aset_tetap} small />
                        </View>
                    </View>

                    <View className="pt-3 border-t-2 border-dashed border-emerald-200/70">
                        <Row label="TOTAL B (Piutang & Aset)" value={data.total_b} bold large color="text-emerald-700" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderSectionC = () => {
        const data = report?.section_c || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-rose-50/70 px-5 py-4 flex-row items-center border-b border-rose-100/50 w-full">
                    <View className="w-8 h-8 rounded-full bg-rose-100/80 items-center justify-center mr-3">
                        <ArrowDownLeft size={18} className="text-rose-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-rose-900 tracking-tight">C. Pengurangan Modal</Typography>
                </View>

                <View className="p-5 space-y-4 w-full">
                    {data.pembelian_part?.total > 0 && (
                        <View className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            <Row label="Total Pembelian Part" value={data.pembelian_part?.total} bold />
                            <View className="mt-2 pt-2 border-t border-slate-200/60 space-y-1">
                                <Row label="Pembayaran Cash" value={data.pembelian_part?.cash} small />
                                <Row label="Pembayaran Transfer" value={data.pembelian_part?.transfer} small />
                                {data.pembelian_part?.accrued > 0 && (
                                    <Row label="Kredit atau Hutang" value={data.pembelian_part?.accrued} small color="text-rose-500" />
                                )}
                            </View>
                        </View>
                    )}



                    {data.pengembalian_investor?.total > 0 && (
                        <View className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            <Row label="Bagi Hasil / Payout Investor" value={data.pengembalian_investor?.total} bold />
                            <View className="mt-2 pt-2 border-t border-slate-200/60 space-y-1">
                                <Row label="Pembayaran Cash" value={data.pengembalian_investor?.cash} small />
                                <Row label="Pembayaran Transfer" value={data.pengembalian_investor?.transfer} small />
                                {data.pengembalian_investor?.accrued > 0 && (
                                    <Row label="Penyesuaian Kewajiban (Hutang)" value={data.pengembalian_investor?.accrued} small color="text-rose-500" />
                                )}
                            </View>
                        </View>
                    )}

                    <View className="bg-orange-50/40 p-3.5 rounded-xl border border-orange-100/50 w-full">
                        <Row label="Total Beban Operasional" value={(data.operasional_unit_details?.umum || 0) + (data.operasional_unit_details?.bengkel || 0) + (data.operasional_unit_details?.mobil || 0) + (data.operasional_unit_details?.jasa_angkut || 0)} bold color="text-orange-800" />
                        <View className="mt-3 pt-3 border-t border-orange-200/50 space-y-1.5">
                            <Row label="Operasional Umum" value={data.operasional_unit_details?.umum} small isNegative color="text-slate-600" />
                            <Row label="Operasional Unit Bisnis Bengkel" value={data.operasional_unit_details?.bengkel} small isNegative color="text-slate-600" />
                            <Row label="Operasional Unit Bisnis Mobil" value={data.operasional_unit_details?.mobil} small isNegative color="text-slate-600" />
                            <Row label="Operasional Unit Bisnis Jasa Angkut" value={data.operasional_unit_details?.jasa_angkut} small isNegative color="text-slate-600" />
                        </View>
                        
                        {Object.keys(data.operasional_unit_details?.jasa_angkut_detailed_breakdown || {}).length > 0 && (
                            <View className="mt-4 pt-3 border-t border-orange-200/50 w-full">
                                <Typography variant="caption" weight="bold" className="text-rose-800/60 uppercase tracking-widest text-[9px] mb-2">Operasional Jasa Angkut (Per Armada)</Typography>
                                <View className="space-y-2">
                                    {Object.entries(data.operasional_unit_details.jasa_angkut_detailed_breakdown || {}).map(([name, detail]: [string, any]) => (
                                        <View key={name} className="bg-white/40 p-2 rounded-lg border border-orange-100/50 shadow-sm">
                                            <Typography variant="body2" className="text-slate-900 mb-2">{`• ${name}`}</Typography>
                                            <View className="flex flex-col gap-1 pl-4 mt-1 border-l border-slate-200">
                                                {detail.bengkel > 0 && <Row label="Biaya Bengkel" value={detail.bengkel} small isNegative color="text-slate-500" />}
                                                {detail.ops > 0 && <Row label="Biaya Ops" value={detail.ops} small isNegative color="text-slate-500" />}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Beban Biaya Jual Beli Mobil */}
                    <View className="mt-4 pt-3 border-t border-orange-200/50 space-y-1.5">
                        <Typography variant="caption" weight="bold" className="text-orange-800/60 uppercase tracking-widest text-[9px] mb-1">Beban Biaya Jual Beli Mobil</Typography>
                        <Row label="Total Pembelian Unit" value={data.pembelian_mobil?.total} small isNegative color="text-orange-900" bold />
                        <View className="pl-4 border-l border-orange-200 space-y-1 mt-1">
                            <Row label="Bayar Cash" value={data.pembelian_mobil?.cash} small color="text-slate-500" />
                            <Row label="Bayar Transfer" value={data.pembelian_mobil?.transfer} small color="text-slate-500" />
                            {data.pembelian_mobil?.accrued > 0 && (
                                <Row label="Kredit / Hutang Unit" value={data.pembelian_mobil?.accrued} small color="text-rose-500" />
                            )}
                        </View>
                        <Row label="Biaya Persiapan (Pajak, BBN, dll)" value={data.operasional_unit_details?.mobil_prep} small isNegative color="text-slate-600" />
                    </View>

                    <View className="space-y-2 px-1 pt-2 w-full">
                        <Row label="Beban Gaji Karyawan" value={data.gaji} isNegative />
                        <Row label="Beban Lembur Karyawan" value={data.lembur} isNegative />
                        <Row label="Prive (Pengambilan Pemilik)" value={data.prive} isNegative />
                        {data.kasbon_karyawan > 0 && <Row label="Kasbon Karyawan (Net)" value={data.kasbon_karyawan} isNegative />}
                        {data.transaksi_lainnya > 0 && <Row label="Transaksi Lainnya (Net)" value={data.transaksi_lainnya} isNegative />}
                    </View>

                    <View className="pt-4 mt-2 border-t-2 border-dashed border-rose-200/70">
                        <Row label="TOTAL C (Pengurangan Modal)" value={data.total_c} bold large color="text-rose-600" />
                    </View>
                </View>
            </Card>
        );
    };

    const renderSectionE = () => {
        const data = report?.section_e || {};
        return (
            <Card className="mb-4 overflow-hidden border-0 shadow-sm shadow-slate-200/50 bg-white rounded-2xl w-full">
                <View className="bg-amber-50/70 px-5 py-4 flex-row items-center border-b border-amber-100/50 w-full">
                    <View className="w-8 h-8 rounded-full bg-amber-100/80 items-center justify-center mr-3">
                        <AlertTriangle size={18} className="text-amber-600" />
                    </View>
                    <Typography variant="h4" weight="bold" className="text-amber-900 tracking-tight">E. Hutang / Kewajiban</Typography>
                </View>

                <View className="p-5 space-y-2.5 w-full">
                    <Row label="Hutang Pembelian Part" value={data.hutang_part} />
                    <Row label="Hutang Pembelian Mobil" value={data.hutang_mobil} />
                    <Row label="Hutang Investor" value={data.hutang_investor} />
                    <Row label="Hutang Lainnya" value={data.hutang_lainnya} />

                    <View className="pt-3 mt-1 border-t-2 border-dashed border-amber-200/70 w-full">
                        <Row label="TOTAL E (Hutang Belum Lunas)" value={data.total_e} color="text-amber-600" bold large />
                    </View>

                    <View className="mt-4 bg-amber-50/80 rounded-xl p-3 border border-amber-100/50">
                        <Typography variant="caption" className="text-amber-700/80 leading-snug">
                            Hutang memposisikan kewajiban yang belum dibayar tunai. Nilai positif ini ditambahkan kembali dalam rekonsiliasi karena merepresentasikan kas yang secara fisik masih ada dalam kendali.
                        </Typography>
                    </View>
                </View>
            </Card>
        );
    };

    const renderSectionD = () => {
        const data = report?.section_d || {};
        return (
            <Card className="mb-10 overflow-hidden border-0 shadow-lg shadow-indigo-900/10 bg-indigo-600 rounded-3xl w-full relative">
                <View className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full opacity-40" />
                <View className="absolute -bottom-16 -left-16 w-40 h-40 bg-indigo-700 rounded-full opacity-40" />

                <View className="p-6 relative z-10 w-full">
                    <View className="flex-row items-center mb-6">
                        <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center mr-4 backdrop-blur-md border border-white/10">
                            <Wallet size={24} color="white" />
                        </View>
                        <View className="flex-1">
                            <Typography variant="h3" weight="bold" className="text-white tracking-tight">F. Total Modal & Kas</Typography>
                            <Typography variant="caption" className="text-indigo-200 mt-1">Keselarasan Sistem dan Laporan</Typography>
                        </View>
                    </View>

                    <View className="bg-white/10 rounded-2xl p-5 border border-white/10 backdrop-blur-md mb-6 w-full shadow-inner">
                        <View className="space-y-3 w-full">
                            <Row label="Kas Tunai (Tunai & Brankas Unit)" value={data.cash} isDark />

                            {data.unit_details && Object.keys(data.unit_details).length > 0 && (
                                <View className="bg-black/20 rounded-xl p-3.5 space-y-2 mt-1 border border-white/5">
                                    {Object.entries(data.unit_details).map(([unit, val]) => (
                                        <Row
                                            key={unit}
                                            label={unit.replace('kas_unit_', '').replace(/_/g, ' ').toUpperCase()}
                                            value={val as number}
                                            small
                                            isDark
                                        />
                                    ))}
                                </View>
                            )}

                            <Row className="mt-1" label="Kas Bank / Transfer" value={data.transfer} isDark />
                        </View>

                        <View className="h-px bg-white/20 my-4" />

                        <View className="flex-row justify-between items-center w-full">
                            <Typography className="text-indigo-100" variant="body1" weight="medium">Total Saldo Riil</Typography>
                            <Typography weight="bold" className="text-white text-3xl tracking-tighter">{formatCurrency(data.total_d || 0)}</Typography>
                        </View>
                    </View>

                    <View className="bg-slate-900/40 rounded-2xl p-5 border border-white/10 backdrop-blur-xl w-full">
                        <View className="flex-row items-center mb-5">
                            <View className="w-1.5 h-4 bg-indigo-400 rounded-full mr-2.5" />
                            <Typography variant="caption" weight="bold" className="text-indigo-100 uppercase tracking-widest text-[10px]">Rekonsiliasi Modal Teoritis</Typography>
                        </View>

                        <Row label="Modal Berdasarkan Sistem" value={data.theoretical_modal} bold large color="text-white" isDark />

                        {data.penyesuaian !== undefined && Math.abs(data.penyesuaian) >= 1 ? (
                            <View className="mt-5 pt-5 border-t border-white/10 w-full space-y-3">
                                <View className="flex-row items-center bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/30 self-start mb-1">
                                    <AlertTriangle size={14} color="#FDA4AF" className="mr-1.5" />
                                    <Typography className="text-rose-200 text-xs font-bold">BUTUH PENYESUAIAN</Typography>
                                </View>

                                <View className="space-y-1.5">
                                    <Row label="Modal Teoritis [ (A-B) - C + E ]" value={data.modal_komponen} small color="text-indigo-200" isDark />
                                    <Row label="Selisih / Penyesuaian" value={data.penyesuaian} small bold color="text-rose-300" isDark />
                                </View>

                                <Typography variant="caption" className="text-indigo-200/60 leading-normal mt-1 text-[10px]">
                                    *Selisih terjadi karena perbedaan perhitungan teoritis komponen dengan total saldo riil.
                                </Typography>
                            </View>
                        ) : (
                            <View className="mt-5 pt-5 border-t border-white/10">
                                <View className="flex-row items-center bg-emerald-500/20 px-4 py-2.5 rounded-xl border border-emerald-500/30 w-full justify-center">
                                    <View className="w-6 h-6 rounded-full bg-emerald-500/40 items-center justify-center mr-2.5">
                                        <Typography className="text-emerald-100 text-xs font-bold">✓</Typography>
                                    </View>
                                    <Typography className="text-emerald-100/90 text-sm font-bold tracking-wide">REKONSILIASI SEIMBANG</Typography>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {renderHeader()}

            <ScrollView
                className="flex-1 px-4 pt-5"
                contentContainerStyle={{ paddingBottom: 40 }}
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
                    className="flex-1 bg-slate-900/40 justify-end backdrop-blur-sm"
                    onPress={() => setShowExportMenu(false)}
                >
                    <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-6 w-full">
                            <View>
                                <Typography variant="h3" weight="bold" className="text-slate-800">Ekspor Laporan</Typography>
                                <Typography variant="caption" className="text-slate-500">Pilih metode ekspor PDF</Typography>
                            </View>
                            <Pressable onPress={() => setShowExportMenu(false)} className="bg-slate-100 p-2.5 rounded-full active:bg-slate-200">
                                <X size={20} className="text-slate-600" />
                            </Pressable>
                        </View>

                        <View className="flex-row gap-4 w-full">
                            <Pressable
                                onPress={() => {
                                    setShowExportMenu(false);
                                    setTimeout(() => handleExportPDF('preview'), 100);
                                }}
                                className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200 items-center active:bg-slate-50"
                            >
                                <View className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl items-center justify-center mb-3">
                                    <Eye size={28} className="text-blue-600" />
                                </View>
                                <Typography weight="bold" className="text-slate-700">Tampilkan</Typography>
                                <Typography variant="caption" className="text-slate-500 text-center mt-1">Pratinjau PDF</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setShowExportMenu(false);
                                    setTimeout(() => handleExportPDF('download'), 100);
                                }}
                                className="flex-1 bg-primary p-5 rounded-2xl shadow-md shadow-primary/30 items-center active:bg-primary-dark"
                            >
                                <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center mb-3">
                                    <Download size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-white">Download</Typography>
                                <Typography variant="caption" className="text-primary-100 text-center mt-1">Simpan File</Typography>
                            </Pressable>
                        </View>
                    </Pressable>
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
    themeColors,
    className
}: {
    label: string,
    value: number,
    bold?: boolean,
    small?: boolean,
    large?: boolean,
    color?: string,
    isNegative?: boolean,
    isDark?: boolean,
    themeColors?: any,
    className?: string
}) => (
    <View className={`flex-row justify-between items-center py-[2px] w-full ${className || ''}`}>
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

