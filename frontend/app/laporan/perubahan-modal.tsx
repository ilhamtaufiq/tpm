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

    const handleExportPDF = async (mode: 'preview' | 'download' | 'print' = 'preview') => {
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
                        body { font-family: 'Helvetica', sans-serif; font-size: 10.5px; color: #1e293b; padding: 40px 35px; line-height: 1.4; background-color: #fff; }
                        .header { text-align: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 20px; margin-bottom: 25px; }
                        .title { font-size: 20px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
                        .subtitle { font-size: 13px; color: #4f46e5; font-weight: 600; margin-bottom: 3px; }
                        .date { font-size: 11px; color: #64748b; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                        
                        .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11.5px; }
                        .section-title { background-color: #f8fafc; font-weight: 800; color: #4f46e5; text-transform: uppercase; font-size: 10px; letter-spacing: 1.5px; border-top: 1.5px solid #e2e8f0; }
                        .total-row { font-weight: 800; background-color: #f1f5f9; color: #1e293b; border-top: 2px solid #cbd5e1; }
                        .grand-total { font-weight: 800; background-color: #4f46e5; color: #ffffff; font-size: 13px; }
                        .grand-total td { border-bottom: none; }
                        
                        .sub-item { color: #64748b; padding-left: 25px; font-size: 9.5px; font-style: italic; }
                        .indent-2 { padding-left: 40px; color: #94a3b8; font-size: 9px; }
                        .negative { color: #e11d48; }
                        .positive { color: #059669; }
                        
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
                        .info-card { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px; background-color: #fafafa; }
                        .info-card-title { font-weight: 800; font-size: 9.5px; color: #475569; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; letter-spacing: 1px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }
                        
                        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #f1f5f9; font-size: 9px; color: #94a3b8; text-align: center; font-style: italic; }
                        
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">Laporan Perubahan Modal</div>
                        <div class="subtitle">BENGKEL TPM - LAPORAN KONSOLIDASI</div>
                        <div class="date">Periode Laporan: ${getHeaderDate()}</div>
                    </div>

                    <table>
                        <!-- SECTION A: MODAL AWAL -->
                        <tr class="section-title">
                            <td colspan="2">A. MODAL AWAL</td>
                        </tr>
                        <tr>
                            <td>Saldo Modal Awal Periode</td>
                            <td class="amount">${formatCurrency(modal_awal)}</td>
                        </tr>

                        <!-- SECTION B: PENAMBAHAN MODAL -->
                        <tr class="section-title">
                            <td colspan="2">B. PENAMBAHAN MODAL</td>
                        </tr>
                        <tr>
                            <td>Setoran Modal Tunai</td>
                            <td class="amount">${formatCurrency(setoran)}</td>
                        </tr>
                        ${r.penambahan?.modal_non_kas?.total > 0 ? `
                        <tr>
                            <td>Modal Non-Kas (Aset Import)</td>
                            <td class="amount">${formatCurrency(r.penambahan?.modal_non_kas?.total)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Aset Tetap & Peralatan</td>
                            <td class="amount">${formatCurrency(r.penambahan?.modal_non_kas?.aset_tetap || 0)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Persediaan Sparepart</td>
                            <td class="amount">${formatCurrency(r.penambahan?.modal_non_kas?.stok_part || 0)}</td>
                        </tr>` : ''}
                        
                        <tr>
                            <td>Laba Kotor Konsolidasi (Operational Profit)</td>
                            <td class="amount positive">${formatCurrency(laba)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Kontribusi Laba Jual Beli Mobil</td>
                            <td class="amount">${formatCurrency(r.penambahan?.laba_kotor?.mobil || 0)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Kontribusi Laba Jasa Angkut</td>
                            <td class="amount">${formatCurrency(r.penambahan?.laba_kotor?.ja || 0)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Kontribusi Laba Bengkel Umum</td>
                            <td class="amount">${formatCurrency(r.penambahan?.laba_kotor?.bengkel || 0)}</td>
                        </tr>


                        ${r.penambahan?.stok_mobil_baru?.total > 0 ? `
                        <tr>
                            <td>Penambahan Stok Unit Mobil</td>
                            <td class="amount">${formatCurrency(r.penambahan?.stok_mobil_baru?.total)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Harga Beli Unit</td>
                            <td class="amount">${formatCurrency(r.penambahan?.stok_mobil_baru?.harga_beli || 0)}</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Biaya Persiapan (Prep)</td>
                            <td class="amount">${formatCurrency(r.penambahan?.stok_mobil_baru?.prep || 0)}</td>
                        </tr>
                        ${r.penambahan?.stok_mobil_baru?.workshop > 0 ? `
                        <tr class="sub-item">
                            <td>◦ Perbaikan Bengkel</td>
                            <td class="amount">${formatCurrency(r.penambahan?.stok_mobil_baru?.workshop || 0)}</td>
                        </tr>` : ''}
                        ` : ''}
                        
                        ${r.penambahan?.stok_part_baru > 0 ? `
                        <tr>
                            <td>Penambahan Stok Sparepart</td>
                            <td class="amount">${formatCurrency(r.penambahan?.stok_part_baru)}</td>
                        </tr>` : ''}
                        
                        ${r.penambahan?.piutang_baru?.total > 0 ? `
                        <tr>
                            <td>Penambahan Piutang / Kasbon</td>
                            <td class="amount">${formatCurrency(r.penambahan?.piutang_baru?.total)}</td>
                        </tr>` : ''}

                        ${r.penambahan?.penyesuaian > 0 ? `
                        <tr class="sub-item">
                            <td>Penyesuaian Rekonsiliasi</td>
                            <td class="amount">${formatCurrency(r.penambahan?.penyesuaian)}</td>
                        </tr>` : ''}
                        
                        <tr class="total-row">
                            <td>TOTAL PENAMBAHAN MODAL (B)</td>
                            <td class="amount">${formatCurrency(tot_penambahan)}</td>
                        </tr>

                        <!-- SECTION C: PENGURANGAN MODAL -->
                        <tr class="section-title">
                            <td colspan="2">C. PENGURANGAN MODAL</td>
                        </tr>
                        <tr>
                            <td>Prive & Penarikan Modal Pemilik</td>
                            <td class="amount negative">(${formatCurrency(prive)})</td>
                        </tr>
                        
                        <tr>
                            <td>Beban Operasional & Gaji (Overhead Gabungan)</td>
                            <td class="amount negative">(${formatCurrency(r.pengurangan?.beban_operasional?.total || 0)})</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Operasional Bengkel & Mobil</td>
                            <td class="amount">(${formatCurrency((r.pengurangan?.beban_operasional?.bengkel || 0) + (r.pengurangan?.beban_operasional?.mobil || 0))})</td>
                        </tr>
                        
                        <!-- DETAIL JASA ANGKUT EXPENSES -->
                        ${r.pengurangan?.beban_operasional?.ja?.total > 0 ? `
                        <tr class="sub-item">
                            <td>◦ Operasional Jasa Angkut (Detailed)</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.beban_operasional?.ja?.total)})</td>
                        </tr>
                        <tr class="indent-2">
                            <td>- Biaya Armada & Trip Muatan</td>
                            <td class="amount">(${formatCurrency((r.pengurangan?.beban_operasional?.ja?.armada || 0) + (r.pengurangan?.beban_operasional?.ja?.trip || 0))})</td>
                        </tr>
                        <tr class="indent-2">
                            <td>- Biaya Unit Bisnis & Perbaikan</td>
                            <td class="amount">(${formatCurrency((r.pengurangan?.beban_operasional?.ja?.unit || 0) + (r.pengurangan?.beban_operasional?.ja?.repairs || 0))})</td>
                        </tr>` : ''}
                        
                        <tr class="sub-item">
                            <td>◦ Gaji, Lembur & Biaya Umum</td>
                            <td class="amount">(${formatCurrency((r.pengurangan?.beban_operasional?.gaji_lembur || 0) + (r.pengurangan?.beban_operasional?.umum || 0))})</td>
                        </tr>

                        ${r.pengurangan?.alokasi_piutang?.total > 0 ? `
                        <tr>
                            <td>Alokasi Dana Piutang Baru (Cash to Receivable)</td>
                            <td class="amount negative">(${formatCurrency(r.pengurangan?.alokasi_piutang?.total)})</td>
                        </tr>` : ''}
                        
                        ${r.pengurangan?.alokasi_stok?.total > 0 ? `
                        <tr>
                            <td>Alokasi Dana Stok Mobil (Cash Out)</td>
                            <td class="amount negative">(${formatCurrency(r.pengurangan?.alokasi_stok?.total)})</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Harga Beli Unit</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.alokasi_stok?.harga_beli || 0)})</td>
                        </tr>
                        <tr class="sub-item">
                            <td>◦ Biaya Persiapan (Prep)</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.alokasi_stok?.prep || 0)})</td>
                        </tr>
                        ${r.pengurangan?.alokasi_stok?.workshop > 0 ? `
                        <tr class="sub-item">
                            <td>◦ Perbaikan Bengkel</td>
                            <td class="amount">(${formatCurrency(r.pengurangan?.alokasi_stok?.workshop || 0)})</td>
                        </tr>` : ''}
                        ` : ''}



                        ${r.pengurangan?.penyesuaian > 0 ? `
                        <tr class="sub-item">
                            <td>Penyesuaian Rekonsiliasi</td>
                            <td class="amount negative">(${formatCurrency(r.pengurangan?.penyesuaian)})</td>
                        </tr>` : ''}
                        
                        <tr class="total-row">
                            <td>TOTAL PENGURANGAN MODAL (C)</td>
                            <td class="amount negative">(${formatCurrency(tot_pengurangan)})</td>
                        </tr>

                        <!-- FINAL CALCULATION -->
                        <tr style="height: 15px;"></tr>
                        <tr class="grand-total">
                            <td>MODAL AKHIR KONSOLIDASI (A + B - C)</td>
                            <td class="amount">${formatCurrency(modal_akhir)}</td>
                        </tr>
                    </table>

                    <!-- ANALYTICAL BREAKDOWNS -->
                    <div class="info-grid">
                        <div class="info-card">
                            <div class="info-card-title">Rincian Laba Bersih Unit</div>
                            <div class="info-row">
                                <span>Bengkel Umum:</span>
                                <b>${formatCurrency(info.laba_bengkel || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Jual Beli Mobil:</span>
                                <b>${formatCurrency(info.laba_mobil || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Jasa Angkut:</span>
                                <b>${formatCurrency(info.laba_jasa_angkut || 0)}</b>
                            </div>
                            <div class="info-row" style="margin-top: 5px; border-top: 1px dashed #ddd; padding-top: 3px;">
                                <span>Total Laba Bersih:</span>
                                <b class="positive">${formatCurrency(info.laba_bersih || 0)}</b>
                            </div>
                        </div>
                        
                        <div class="info-card">
                            <div class="info-card-title">Rincian Persediaan Mobil</div>
                            <div class="info-row">
                                <span>Persediaan Sparepart</span>
                                <span class="amount">${formatCurrency(r.info?.aset?.stok_part || 0)}</span>
                            </div>
                            <div class="info-row">
                                <span>Harga Beli Unit Mobil</span>
                                <span class="amount">${formatCurrency(aset.stok_mobil?.unit_hanya)}</span>
                            </div>
                            <div class="info-row">
                                <span>Biaya Persiapan (Prep)</span>
                                <span class="amount">${formatCurrency(aset.stok_mobil?.biaya_persiapan)}</span>
                            </div>
                            <div class="info-row">
                                <span>Perbaikan Bengkel (External)</span>
                                <span class="amount">${formatCurrency(aset.stok_mobil?.perbaikan_external || 0)}</span>
                            </div>
                            <div class="info-row" style="margin-top: 5px; border-top: 1px solid #eee; padding-top: 3px; font-weight: 800;">
                                <span>Total Aset Persediaan</span>
                                <span class="amount">${formatCurrency(aset.stok_mobil?.total)}</span>
                            </div>
                        </div>

                        <div class="info-card">
                            <div class="info-card-title">Detail Piutang Aktif</div>
                            <div class="info-row">
                                <span>Piutang Bengkel Umum</span>
                                <b>${formatCurrency(aset.piutang?.breakdown?.bengkel || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Piutang Jasa Angkut</span>
                                <b>${formatCurrency(aset.piutang?.breakdown?.ja || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Piutang Jual Beli Mobil</span>
                                <b>${formatCurrency(aset.piutang?.breakdown?.mobil || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Kasbon & Piutang Lainnya</span>
                                <b>${formatCurrency((aset.piutang?.breakdown?.kasbon || 0) + (aset.piutang?.breakdown?.lainnya || 0))}</b>
                            </div>
                            <div class="info-row" style="margin-top: 5px; border-top: 1px dashed #ddd; padding-top: 3px;">
                                <span>Total Seluruh Piutang</span>
                                <b style="color: #4f46e5;">${formatCurrency(aset.piutang?.total || 0)}</b>
                            </div>
                        </div>

                        <div class="info-card">
                            <div class="info-card-title">Detail Hutang & Kewajiban</div>
                            <div class="info-row">
                                <span>Hutang Unit Bengkel</span>
                                <b>${formatCurrency(aset.hutang?.breakdown?.bengkel || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Hutang Unit Jasa Angkut</span>
                                <b>${formatCurrency(aset.hutang?.breakdown?.ja || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Hutang Unit Mobil</span>
                                <b>${formatCurrency(aset.hutang?.breakdown?.mobil || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Hutang Investor</span>
                                <b>${formatCurrency(aset.hutang?.breakdown?.investor || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>DP & Titipan Sales</span>
                                <b>${formatCurrency((aset.hutang?.breakdown?.uang_muka_penjualan || 0) + (aset.hutang?.breakdown?.piutang_booking || 0))}</b>
                            </div>
                            <div class="info-row" style="margin-top: 5px; border-top: 1px dashed #ddd; padding-top: 3px;">
                                <span>Total Kewajiban Usaha</span>
                                <b style="color: #be123c;">${formatCurrency(aset.hutang?.total || 0)}</b>
                            </div>
                        </div>

                        <div class="info-card">
                            <div class="info-card-title">Posisi Aset Kas & Stok</div>
                            <div class="info-row">
                                <span>Total Kas & Bank:</span>
                                <b>${formatCurrency(aset.kas_bank || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Stok Sparepart:</span>
                                <b>${formatCurrency(aset.stok_part || 0)}</b>
                            </div>
                            <div class="info-row">
                                <span>Persediaan Unit Mobil:</span>
                                <b>${formatCurrency(aset.stok_mobil?.total || 0)}</b>
                            </div>
                            <div class="info-row" style="margin-top: 5px; border-top: 1px dashed #ddd; padding-top: 3px;">
                                <span>Status Rekonsiliasi:</span>
                                <b style="color: ${info.validasi?.status === 'BALANCE' ? '#059669' : '#e11d48'}">${info.validasi?.status || 'UNVERIFIED'}</b>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        Laporan ini dihasilkan secara resmi oleh Sistem Keuangan TPM.<br/>
                        Dicetak pada ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeID })} - Verified by TPM Finance System
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
            alert('Gagal membuat file PDF laporan');
        } finally {
            setIsExporting(false);
            setShowExportMenu(false);
        }
    };

    const Row = ({ label, value, bold = false, small = false, isNegative = false, color = "text-slate-700", icon: Icon }: any) => (
        <View className="flex-row justify-between items-center w-full py-1.5">
            <View className="flex-row items-center flex-1 pr-4">
                {Icon && (
                    <View className="w-5 h-5 items-center justify-center mr-2 opacity-60">
                        <Icon size={14} color="#64748b" />
                    </View>
                )}
                <Typography
                    variant={small ? "caption" : "body2"}
                    weight={bold ? "bold" : "medium"}
                    className={color}
                >
                    {label}
                </Typography>
            </View>
            <Typography
                variant={small ? "caption" : "body1"}
                weight="bold"
                className={`${isNegative ? 'text-rose-500' : 'text-slate-900'}`}
            >
                {isNegative ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
            </Typography>
        </View>
    );

    const StatCard = ({ label, value, icon: Icon, color, subLabel, bgColor }: any) => (
        <View
            className="flex-1 p-5 rounded-[28px] shadow-sm border border-white/10 mr-2"
            style={{ backgroundColor: bgColor || '#1e293b' }}
        >
            <View className="flex-row justify-between items-start mb-3">
                <View className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
                    <Icon size={18} color="white" />
                </View>
            </View>
            <Typography variant="caption" weight="bold" className="text-white/70 mb-1 uppercase tracking-wider">{label}</Typography>
            <Typography variant="h4" weight="bold" className="text-white mb-1">{formatCurrency(value)}</Typography>
            {subLabel && (
                <Typography variant="caption" className="text-white/50 text-[10px] italic leading-tight">{subLabel}</Typography>
            )}
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
                            <Typography variant="h4" weight="bold" className="text-slate-900">
                                Perubahan Modal
                            </Typography>
                            <Typography variant="caption" weight="medium" className="text-slate-400">
                                Capital Equity Statement
                            </Typography>
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
                            <Typography variant="caption" weight={filterType === type ? 'bold' : 'bold'} className={filterType === type ? 'text-indigo-600' : 'text-slate-400'}>
                                {type === 'daily' ? 'HARIAN' : type === 'monthly' ? 'BULANAN' : 'TAHUNAN'}
                            </Typography>
                        </Pressable>
                    ))}
                </View>

                <View className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 flex-row items-center">
                    <Pressable onPress={handlePrev} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100 active:scale-95">
                        <ChevronLeft size={18} color={themeColors.text} />
                    </Pressable>
                    <View className="flex-1 flex-row items-center justify-center">
                        <Calendar size={16} color={themeColors.primary} className="mr-2" />
                        <Typography variant="body2" weight="bold" className="text-slate-800 capitalize tracking-tight">
                            {getFormattedDate()}
                        </Typography>
                    </View>
                    <Pressable onPress={handleNext} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100 active:scale-95">
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
                        <Typography variant="body2" className="mt-4 text-slate-500">Menyusun Laporan...</Typography>
                    </View>
                ) : !report ? (
                    <View className="py-12 items-center justify-center">
                        <AlertTriangle size={48} color="#94a3b8" className="mb-4" />
                        <Typography variant="body1" className="text-slate-500">Data laporan tidak tersedia</Typography>
                    </View>
                ) : (
                    <View className="w-full space-y-5">
                        {/* HERO SECTION: MODAL AKHIR */}
                        <View
                            className="w-full rounded-[36px] p-7 shadow-2xl overflow-hidden relative"
                            style={{ backgroundColor: '#4f46e5' }} // Explicit Indigo 600
                        >
                            {/* Modern Decorative Background */}
                            <View className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full" />
                            <View className="absolute top-20 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full" />

                            <View className="flex-row items-start justify-between mb-6">
                                <View className="flex-1 pr-4">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-2 h-2 rounded-full bg-indigo-300 mr-2" />
                                        <Typography variant="caption" weight="bold" className="text-indigo-100 uppercase tracking-[2.5px]">Modal Akhir Konsolidasi</Typography>
                                    </View>
                                    <Typography variant="h1" weight="bold" className="text-white tracking-tighter" style={{ fontSize: 32 }}>
                                        {formatCurrency(report.modal_akhir)}
                                    </Typography>
                                </View>
                                <View className="w-16 h-16 bg-white/20 rounded-[22px] items-center justify-center border border-white/30">
                                    <Wallet size={32} color="white" />
                                </View>
                            </View>

                            <View className="flex-row justify-between items-center pt-5 border-t border-white/20">
                                <View className="flex-row items-center">
                                    <Calendar size={14} color="#c7d2fe" className="mr-2" />
                                    <Typography variant="caption" weight="medium" className="text-indigo-100">
                                        Status Realisasi: <Typography variant="caption" weight="bold" className="text-white">{format(new Date(), 'dd MMM yyyy', { locale: localeID })}</Typography>
                                    </Typography>
                                </View>

                                {report.info?.validasi?.status === 'BALANCE' && (
                                    <View className="bg-emerald-400/90 px-4 py-1.5 rounded-full flex-row items-center">
                                        <View className="w-1.5 h-1.5 rounded-full bg-white mr-2" />
                                        <Typography variant="caption" weight="bold" className="text-white text-[10px]">VERIFIED BALANCE</Typography>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* QUICK STATS CARDS */}
                        <View className="flex-row">
                            <StatCard
                                label="MODAL AWAL"
                                value={report.modal_awal}
                                icon={Building}
                                bgColor="#334155" // Slate 700
                                subLabel="Saldo Awal Periode"
                            />
                            <StatCard
                                label="DANA MASUK"
                                value={report.penambahan?.total}
                                icon={ArrowUpRight}
                                bgColor="#059669" // Emerald 600
                                subLabel="Penambahan Modal"
                            />
                        </View>

                        <View className="flex-row -mt-1">
                            <StatCard
                                label="DANA KELUAR"
                                value={report.pengurangan?.total}
                                icon={ArrowDownLeft}
                                bgColor="#e11d48" // Rose 600
                                subLabel="Pengurangan Modal"
                            />
                            <StatCard
                                label="LABA BERSIH"
                                value={report.info?.laba_bersih}
                                icon={Wallet}
                                bgColor="#d97706" // Amber 600
                                subLabel="Net Income Konsolidasi"
                            />
                        </View>

                        <View className="h-4" />

                        {/* B. PENAMBAHAN MODAL */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-[24px] w-full">
                            <View className="bg-emerald-50 px-5 py-4 flex-row items-center justify-between border-b border-emerald-100/50">
                                <View className="flex-row items-center">
                                    <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center mr-3">
                                        <ArrowUpRight size={18} className="text-emerald-600" />
                                    </View>
                                    <View>
                                        <Typography variant="body1" weight="bold" className="text-emerald-900">B. Penambahan Modal</Typography>
                                        <Typography variant="caption" className="text-emerald-600/70">Sumber Pertumbuhan Aset</Typography>
                                    </View>
                                </View>
                            </View>
                            <View className="p-5 space-y-1">
                                <Row label="Setoran Modal Tunai" value={report.penambahan?.setoran_modal} />

                                {report.penambahan?.modal_non_kas?.total > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Modal Non-Kas (Aset Import)" value={report.penambahan?.modal_non_kas?.total} bold />
                                        <View className="ml-5 border-l-2 border-slate-100 pl-3">
                                            {report.penambahan?.modal_non_kas?.aset_tetap > 0 && (
                                                <Row label="Aset Tetap / Peralatan" value={report.penambahan?.modal_non_kas?.aset_tetap} small icon={Building} />
                                            )}
                                            {report.penambahan?.modal_non_kas?.stok_part > 0 && (
                                                <Row label="Stok Sparepart" value={report.penambahan?.modal_non_kas?.stok_part} small icon={Truck} />
                                            )}

                                        </View>
                                    </View>
                                )}

                                <View className="mt-2 pt-2 border-t border-slate-50">
                                    <Row label="Laba Kotor Konsolidasi" value={report.penambahan?.laba_kotor?.total} bold color="text-indigo-700" />
                                    <View className="ml-5 border-l-2 border-indigo-50 pl-3">
                                        <Row label="Profit Jual Beli Mobil" value={report.penambahan?.laba_kotor?.mobil} small icon={Car} />
                                        <Row label="Profit Jasa Angkut" value={report.penambahan?.laba_kotor?.ja} small icon={Truck} />
                                        <Row label="Profit Bengkel Umum" value={report.penambahan?.laba_kotor?.bengkel} small icon={Building} />

                                    </View>
                                </View>

                                {report.penambahan?.piutang_baru?.total > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Penambahan Piutang / Kasbon" value={report.penambahan?.piutang_baru?.total} bold small />
                                        <View className="ml-5 border-l-2 border-slate-50 pl-3">
                                            {report.penambahan?.piutang_baru?.kasbon > 0 && (
                                                <Row label="Kasbon Karyawan" value={report.penambahan?.piutang_baru?.kasbon} small />
                                            )}
                                            {report.penambahan?.piutang_baru?.lainnya > 0 && (
                                                <Row label="Piutang Lainnya" value={report.penambahan?.piutang_baru?.lainnya} small />
                                            )}
                                        </View>
                                    </View>
                                )}

                                {report.penambahan?.stok_mobil_baru?.total > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Stok Mobil" value={report.penambahan?.stok_mobil_baru?.total} bold color="text-amber-700" />
                                        <View className="ml-5 border-l-2 border-amber-50 pl-3">
                                            <Row label="Harga Beli Unit" value={report.penambahan?.stok_mobil_baru?.harga_beli} small />
                                            <Row label="Biaya Persiapan (Prep)" value={report.penambahan?.stok_mobil_baru?.prep} small />
                                             {report.penambahan?.stok_mobil_baru?.workshop > 0 && (
                                                <Row label="Perbaikan Bengkel" value={report.penambahan?.stok_mobil_baru?.workshop} small />
                                             )}
                                        </View>
                                    </View>
                                )}

                                <View className="flex-row flex-wrap mt-3 gap-2">
                                    {report.penambahan?.investor_funding > 0 && (
                                        <View className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                            <Typography variant="caption" weight="bold" className="text-blue-700">Investor: {formatCurrency(report.penambahan?.investor_funding)}</Typography>
                                        </View>
                                    )}
                                </View>

                                {report.penambahan?.penyesuaian > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Penyesuaian Rekonsiliasi" value={report.penambahan?.penyesuaian} small color="text-slate-500" />
                                    </View>
                                )}



                                <View className="pt-4 mt-2 border-t border-emerald-100">
                                    <Row label="TOTAL PENAMBAHAN" value={report.penambahan?.total} bold color="text-emerald-700" />
                                </View>
                            </View>
                        </Card>

                        {/* C. PENGURANGAN MODAL */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-[24px] w-full">
                            <View className="bg-rose-50 px-5 py-4 flex-row items-center justify-between border-b border-rose-100/50">
                                <View className="flex-row items-center">
                                    <View className="w-9 h-9 rounded-xl bg-rose-100 items-center justify-center mr-3">
                                        <ArrowDownLeft size={18} className="text-rose-600" />
                                    </View>
                                    <View>
                                        <Typography variant="body1" weight="bold" className="text-rose-900">C. Pengurangan Modal</Typography>
                                        <Typography variant="caption" className="text-rose-600/70">Alokasi Dana & Biaya</Typography>
                                    </View>
                                </View>
                            </View>
                            <View className="p-5 space-y-1">
                                <Row label="Prive (Pengambilan Pribadi)" value={report.pengurangan?.prive} isNegative />

                                {report.pengurangan?.beban_operasional?.total > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Beban Operasional & Gaji" value={report.pengurangan?.beban_operasional?.total} bold isNegative color="text-rose-800" />
                                        <View className="ml-5 border-l-2 border-rose-50 pl-3">
                                            <Row label="Operasional Bengkel" value={report.pengurangan?.beban_operasional?.bengkel} small isNegative />
                                            <Row label="Operasional Mobil" value={report.pengurangan?.beban_operasional?.mobil} small isNegative />

                                            {report.pengurangan?.beban_operasional?.ja?.total > 0 && (
                                                <View className="mt-1">
                                                    <Row label="Operasional Jasa Angkut" value={report.pengurangan?.beban_operasional?.ja?.total} small bold isNegative />
                                                    <View className="ml-4 border-l border-slate-100 pl-2">
                                                        <Row label="Armada & Trip" value={(report.pengurangan?.beban_operasional?.ja?.armada || 0) + (report.pengurangan?.beban_operasional?.ja?.trip || 0)} small isNegative />
                                                        <Row label="Unit & Repairs" value={(report.pengurangan?.beban_operasional?.ja?.unit || 0) + (report.pengurangan?.beban_operasional?.ja?.repairs || 0)} small isNegative />
                                                    </View>
                                                </View>
                                            )}

                                            <Row label="Gaji, Lembur & Umum" value={(report.pengurangan?.beban_operasional?.gaji_lembur || 0) + (report.pengurangan?.beban_operasional?.umum || 0)} small isNegative />
                                        </View>
                                    </View>
                                )}

                                {report.pengurangan?.alokasi_piutang?.total > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Alokasi Dana Piutang (Net)" value={report.pengurangan?.alokasi_piutang?.total} small isNegative />
                                    </View>
                                )}

                                {report.pengurangan?.alokasi_stok?.total > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Stok Mobil" value={report.pengurangan?.alokasi_stok?.total} bold isNegative color="text-rose-800" />
                                        <View className="ml-5 border-l-2 border-rose-50 pl-3">
                                            <Row label="Harga Beli Unit" value={report.pengurangan?.alokasi_stok?.harga_beli} small isNegative />
                                            <Row label="Biaya Persiapan (Prep)" value={report.pengurangan?.alokasi_stok?.prep} small isNegative />
                                            <Row label="Perbaikan Bengkel" value={report.pengurangan?.alokasi_stok?.workshop} small isNegative />
                                        </View>
                                    </View>
                                )}

                                <View className="flex-row flex-wrap mt-3 gap-2">
                                    {report.pengurangan?.pelunasan_hutang > 0 && (
                                        <View className="bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                                            <Typography variant="caption" weight="bold" className="text-rose-700">Bayar Hutang: {formatCurrency(report.pengurangan?.pelunasan_hutang)}</Typography>
                                        </View>
                                    )}
                                </View>

                                {report.pengurangan?.penyesuaian > 0 && (
                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Penyesuaian Rekonsiliasi" value={report.pengurangan?.penyesuaian} isNegative small color="text-slate-500" />
                                    </View>
                                )}


                                <View className="pt-4 mt-2 border-t border-rose-100">
                                    <Row label="TOTAL PENGURANGAN" value={report.pengurangan?.total} bold color="text-rose-700" />
                                </View>
                            </View>
                        </Card>

                        {/* VALIDASI BALANCE BANNER */}
                        {report.info?.validasi && (
                            <View className={`w-full rounded-[24px] p-5 shadow-sm border ${report.info.validasi.status === 'BALANCE' ? 'bg-emerald-500 border-emerald-400' : 'bg-rose-600 border-rose-500'}`}>
                                <View className="flex-row justify-between items-center mb-3">
                                    <View className="flex-row items-center">
                                        <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center mr-3">
                                            {report.info.validasi.status === 'BALANCE' ? <Eye size={16} color="white" /> : <AlertTriangle size={16} color="white" />}
                                        </View>
                                        <Typography variant="body1" weight="bold" className="text-white">Validasi Rekonsiliasi</Typography>
                                    </View>
                                    <View className="bg-white/20 px-3 py-1 rounded-full">
                                        <Typography variant="caption" weight="bold" className="text-white">{report.info.validasi.status}</Typography>
                                    </View>
                                </View>

                                <View className="flex-row justify-between pt-3 border-t border-white/20">
                                    <View>
                                        <Typography variant="caption" className="text-white/70">Selisih Aktual</Typography>
                                        <Typography variant="h4" weight="bold" className="text-white">{formatCurrency(report.info.validasi.selisih)}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography variant="caption" className="text-white/70 text-right">Keakuratan Data</Typography>
                                        <Typography variant="body2" weight="bold" className="text-white">
                                            {report.info.validasi.status === 'BALANCE' ? '100% Akurat' : 'Perlu Audit'}
                                        </Typography>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View className="my-4 flex-row items-center justify-center">
                            <View className="h-px bg-slate-200 flex-1" />
                            <Typography variant="caption" className="px-4 text-slate-400 font-bold uppercase tracking-widest">Informasi Tambahan</Typography>
                            <View className="h-px bg-slate-200 flex-1" />
                        </View>

                        {/* INFO KONTRIBUSI LABA */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-[24px] w-full mb-2">
                            <View className="p-5">
                                <View className="flex-row items-center mb-4">
                                    <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center mr-3">
                                        <Wallet size={16} className="text-indigo-600" />
                                    </View>
                                    <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-[1.5px]">Rincian Kontribusi Laba</Typography>
                                </View>

                                <View className="space-y-1">
                                    <Row label="Laba Bengkel Umum" value={report.info?.laba_bengkel} small icon={Building} />
                                    <Row label="Laba Jual Beli Mobil" value={report.info?.laba_mobil} small icon={Car} />
                                    {report.info?.laba_investor > 0 && (
                                        <Row label="Bagi Hasil Investor" value={report.info?.laba_investor} small isNegative />
                                    )}
                                    <Row label="Laba Jasa Angkut" value={report.info?.laba_jasa_angkut} small icon={Truck} />

                                    <View className="mt-2 pt-2 border-t border-slate-50">
                                        <Row label="Beban Operasional & Gaji" value={report.info?.overhead_gaji} small isNegative bold color="text-rose-600" />
                                        <View className="ml-5 border-l border-slate-100 pl-3">
                                            {report.info?.ops_ja?.total > 0 && (
                                                <Row label="Ops Jasa Angkut" value={report.info?.ops_ja?.total} small isNegative />
                                            )}
                                            <Row label="Gaji & Ops Lainnya" value={(report.info?.overhead_gaji || 0) - (report.info?.ops_ja?.total || 0)} small isNegative />
                                        </View>
                                    </View>

                                    <View className="pt-3 mt-2 border-t border-indigo-100/50">
                                        <Row label="Laba Bersih Konsolidasi" value={report.info?.laba_bersih} bold color="text-indigo-700" />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* INFO STOK MOBIL */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-[24px] w-full mb-2">
                            <View className="p-5">
                                <View className="flex-row items-center mb-4">
                                    <View className="w-8 h-8 rounded-lg bg-amber-50 items-center justify-center mr-3">
                                        <Car size={16} className="text-amber-600" />
                                    </View>
                                    <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-[1.5px]">Rincian Persediaan Mobil</Typography>
                                </View>

                                <View className="space-y-1">
                                    <Row label="Persediaan Sparepart" value={report.info?.aset?.stok_part} small />
                                    <Row label="Harga Beli Unit Mobil" value={report.info?.aset?.stok_mobil?.unit_hanya} small />
                                    <Row label="Biaya Persiapan (Prep)" value={report.info?.aset?.stok_mobil?.biaya_persiapan} small />
                                    <Row label="Perbaikan Bengkel" value={(report.info?.aset?.stok_mobil?.perbaikan_external || 0) + (report.info?.aset?.stok_mobil?.perbaikan_internal || 0)} small />

                                    <View className="pt-3 mt-2 border-t border-amber-100/50">
                                        <Row label="Total Aset Persediaan" value={report.info?.aset?.stok_mobil?.total} bold color="text-amber-700" />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* INFO PIUTANG */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-[24px] w-full mb-10">
                            <View className="p-5">
                                <View className="flex-row items-center mb-4">
                                    <View className="w-8 h-8 rounded-lg bg-blue-50 items-center justify-center mr-3">
                                        <ArrowUpRight size={16} className="text-blue-600" />
                                    </View>
                                    <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-[1.5px]">Posisi Piutang Aktif</Typography>
                                </View>

                                <View className="space-y-1">
                                    <Row label="Piutang Bengkel Umum" value={report.info?.aset?.piutang?.breakdown?.bengkel} small />
                                    <Row label="Piutang Jasa Angkut" value={report.info?.aset?.piutang?.breakdown?.ja} small />
                                    <Row label="Piutang Jual Beli Mobil" value={report.info?.aset?.piutang?.breakdown?.mobil} small />
                                    <Row label="Kasbon & Piutang Lainnya" value={(report.info?.aset?.piutang?.breakdown?.kasbon || 0) + (report.info?.aset?.piutang?.breakdown?.lainnya || 0)} small />

                                    <View className="pt-3 mt-2 border-t border-blue-100/50">
                                        <Row label="Total Piutang Usaha" value={report.info?.aset?.piutang?.total} bold color="text-blue-700" />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* INFO HUTANG */}
                        <Card className="overflow-hidden border border-slate-100 shadow-sm bg-white rounded-[24px] w-full mb-8">
                            <View className="p-5">
                                <View className="flex-row items-center mb-4">
                                    <View className="w-8 h-8 rounded-lg bg-rose-50 items-center justify-center mr-3">
                                        <ArrowDownLeft size={16} className="text-rose-600" />
                                    </View>
                                    <Typography variant="caption" weight="bold" className="text-slate-500 uppercase tracking-[1.5px]">Rincian Hutang & Kewajiban</Typography>
                                </View>

                                <View className="space-y-1">
                                    <Row label="Hutang Unit Bengkel" value={report.info?.aset?.hutang?.breakdown?.bengkel} small />
                                    <Row label="Hutang Unit Jasa Angkut" value={report.info?.aset?.hutang?.breakdown?.ja} small />
                                    <Row label="Hutang Unit Mobil" value={report.info?.aset?.hutang?.breakdown?.mobil} small />
                                    <Row label="Hutang Investor" value={report.info?.aset?.hutang?.breakdown?.investor} small />
                                    <Row label="DP & Booking Sales" value={(report.info?.aset?.hutang?.breakdown?.uang_muka_penjualan || 0) + (report.info?.aset?.hutang?.breakdown?.piutang_booking || 0)} small />

                                    <View className="pt-3 mt-2 border-t border-rose-100/50">
                                        <Row label="Total Kewajiban Usaha" value={report.info?.aset?.hutang?.total} bold color="text-rose-700" />
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
                            <Pressable
                                onPress={() => handleExportPDF('preview')}
                                className="flex-1 bg-indigo-50 p-6 rounded-[32px] border border-indigo-100 items-center"
                            >
                                <View className="w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-indigo-200">
                                    <Eye size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-indigo-900 text-[11px]">Preview</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => handleExportPDF('print')}
                                className="flex-1 bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 items-center"
                            >
                                <View className="w-14 h-14 bg-emerald-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-emerald-200">
                                    <Printer size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-emerald-900 text-[11px]">Cetak</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => handleExportPDF('download')}
                                className="flex-1 bg-amber-50 p-6 rounded-[32px] border border-amber-100 items-center"
                            >
                                <View className="w-14 h-14 bg-amber-500 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-amber-200">
                                    <Download size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-amber-900 text-[11px]">Simpan</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>


            {/* FULL SCREEN PDF PREVIEW MODAL */}
            <Modal visible={showPdfPreview} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                        <Pressable
                            onPress={() => setShowPdfPreview(false)}
                            className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
                        >
                            <X size={20} color={themeColors.text} />
                        </Pressable>
                        <Typography variant="body1" weight="bold" className="text-slate-900">Preview Laporan</Typography>
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
                            className="flex-row items-center px-4 py-2 rounded-xl shadow-sm shadow-indigo-200"
                            style={{ backgroundColor: '#4f46e5' }}
                        >
                            <Download size={16} color="white" className="mr-2" />
                            <Typography variant="caption" weight="bold" className="text-white">CETAK</Typography>
                        </Pressable>
                    </View>

                    <View className="flex-1 bg-slate-100">
                        {Platform.OS === 'web' ? (
                            <iframe
                                srcDoc={previewHtml}
                                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
                                title="PDF Preview"
                            />
                        ) : (
                            <WebView
                                originWhitelist={['*']}
                                source={{ html: previewHtml }}
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
