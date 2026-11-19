import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { addMonths } from 'date-fns/addMonths';
import { subMonths } from 'date-fns/subMonths';
import { addYears } from 'date-fns/addYears';
import { subYears } from 'date-fns/subYears';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { startOfYear } from 'date-fns/startOfYear';
import { endOfYear } from 'date-fns/endOfYear';
import { id as localeID } from 'date-fns/locale/id';
import Percent from 'lucide-react-native/dist/esm/icons/percent.js';
import Receipt from 'lucide-react-native/dist/esm/icons/receipt.js';
import TrendingDown from 'lucide-react-native/dist/esm/icons/trending-down.js';
import X from 'lucide-react-native/dist/esm/icons/x.js';
import Download from 'lucide-react-native/dist/esm/icons/download.js';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { bengkelService } from '../../services/bengkel';
import { formatCurrency, tanggalLokal } from '../../utils/format';
import { unduhPdfLaporanWeb } from '../../utils/unduhPdfLaporan';
import { appAlert } from '../../utils/appAlert';
import {
    ReportPageHeader,
    ReportStatsBento,
    ReportDateControls,
    ReportSectionHeader,
    ReportExportSheet,
    ReportFilterType,
} from '../../components/laporan';
import { useUIStore } from '../../store/useUIStore';
import { BottomSheetContainer, BoundedSheetScrollView } from '../../components/ui/BottomSheetContainer';

// Kategori transaksi bengkel. Kosong = semua kategori.
const KATEGORI_FILTER: { value: string; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'umum', label: 'Bengkel' },
    { value: 'jual_beli_mobil', label: 'Jual Beli Mobil' },
    { value: 'jasa_angkut', label: 'Jasa Angkut' },
];

const LABEL_KATEGORI: Record<string, string> = Object.fromEntries(
    KATEGORI_FILTER.filter(k => k.value).map(k => [k.value, k.label]),
);

const STATUS_LABEL: Record<string, string> = {
    LUNAS: 'LUNAS',
    BELUM_LUNAS: 'BELUM LUNAS',
    SEBAGIAN: 'SEBAGIAN',
    INTERNAL: 'INTERNAL',
    BATAL: 'BATAL',
};

const escapeHtml = (str: any) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function DiskonReportScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [filterType, setFilterType] = useState<ReportFilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [kategori, setKategori] = useState('');
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);

    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

    const range = useMemo(() => {
        if (filterType === 'daily') {
            const d = format(date, 'yyyy-MM-dd');
            return { dari: d, sampai: d };
        }
        if (filterType === 'monthly') {
            return { dari: format(startOfMonth(date), 'yyyy-MM-dd'), sampai: format(endOfMonth(date), 'yyyy-MM-dd') };
        }
        return { dari: format(startOfYear(date), 'yyyy-MM-dd'), sampai: format(endOfYear(date), 'yyyy-MM-dd') };
    }, [filterType, date]);

    const formattedDate = useMemo(() => {
        if (filterType === 'daily') return format(date, 'dd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    }, [filterType, date]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await bengkelService.getLaporanDiskon({
                tanggal_dari: range.dari,
                tanggal_sampai: range.sampai,
                kategori: kategori || undefined,
            });
            setData(res);
        } catch (error) {
            console.error('Error fetching discount report:', error);
            setData(null);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [range, kategori]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openDetail = async (item: any) => {
        setSelectedTransaction(item);
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const detail = await bengkelService.getDetailTransaksi(item.id);
            setSelectedTransaction(detail);
        } catch (error) {
            console.error('Gagal memuat detail transaksi:', error);
            appAlert('Error', 'Gagal memuat detail transaksi');
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const handlePrev = () => {
        if (filterType === 'daily') setDate(d => subDays(d, 1));
        else if (filterType === 'monthly') setDate(d => subMonths(d, 1));
        else setDate(d => subYears(d, 1));
    };
    const handleNext = () => {
        if (filterType === 'daily') setDate(d => addDays(d, 1));
        else if (filterType === 'monthly') setDate(d => addMonths(d, 1));
        else setDate(d => addYears(d, 1));
    };

    const rows = useMemo(() => {
        const list: any[] = data?.rows || [];
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter(r =>
            `${r.nomor_transaksi} ${r.nama} ${r.nomor_plat || ''}`.toLowerCase().includes(q),
        );
    }, [data, search]);

    const summary = data?.summary || { jumlah_transaksi: 0, total_diskon: 0, total_subtotal: 0, persen_rata: 0, rata_per_transaksi: 0 };

    const stats = [
        { label: 'Total Diskon', value: formatCurrency(summary.total_diskon), icon: TrendingDown, color: '#F43F5E', bg: 'bg-rose-50', sub: `${summary.persen_rata}% dari subtotal` },
        { label: 'Transaksi', value: String(summary.jumlah_transaksi), icon: Receipt, color: themeColors.primary, bg: 'bg-primary/10', sub: 'yang memakai diskon' },
        { label: 'Rata-rata', value: formatCurrency(summary.rata_per_transaksi), icon: Percent, color: '#D97706', bg: 'bg-amber-50', sub: 'per transaksi' },
    ];

    const periodeLabel = `${formattedDate}${kategori ? ` • ${LABEL_KATEGORI[kategori]}` : ''}`;

    const buildExportHtml = useCallback(() => {
        const perKategori = (data?.per_kategori || []).map((k: any) => `
            <div class="row-item">
                <span>${escapeHtml(LABEL_KATEGORI[k.kategori] || k.kategori)} (${k.jumlah_transaksi} transaksi)</span>
                <span class="text-danger font-bold">-${formatCurrency(k.total_diskon || 0)}</span>
            </div>`).join('');
        const baris = rows.map((r: any) => `
            <tr style="font-size: 10px; border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px;">
                    ${r.tanggal ? format(tanggalLokal(r.tanggal), 'dd/MM/yy', { locale: localeID }) : '-'}<br/>
                    <span style="color: #64748b; font-size: 8px;">${escapeHtml(r.nomor_transaksi)}</span>
                </td>
                <td style="padding: 8px;">
                    <span style="font-weight: bold;">${escapeHtml(r.nama)}</span><br/>
                    <span style="color: #64748b; font-size: 9px;">${escapeHtml(LABEL_KATEGORI[r.kategori] || r.kategori)}</span>
                </td>
                <td style="padding: 8px;">${formatCurrency(r.subtotal || 0)}</td>
                <td style="padding: 8px; color: #e11d48; font-weight: bold;">-${formatCurrency(r.diskon || 0)} (${r.persen}%)</td>
                <td style="padding: 8px; font-weight: bold;">${formatCurrency(r.grand_total || 0)}</td>
            </tr>`).join('');
        return `
            <div class="section-header">RINGKASAN DISKON</div>
            <div class="row-item">
                <span>Total Diskon</span>
                <span class="text-danger font-bold">-${formatCurrency(summary.total_diskon || 0)}</span>
            </div>
            <div class="row-item">
                <span>Persentase dari subtotal</span>
                <span>${summary.persen_rata || 0}%</span>
            </div>
            <div class="row-item">
                <span>Jumlah transaksi berdiskon</span>
                <span>${summary.jumlah_transaksi || 0}</span>
            </div>
            <div class="row-item">
                <span>Rata-rata diskon per transaksi</span>
                <span>${formatCurrency(summary.rata_per_transaksi || 0)}</span>
            </div>
            ${perKategori ? `<div class="section-header" style="margin-top:20px;">PER KATEGORI</div>${perKategori}` : ''}
            <div class="section-header" style="margin-top:30px;">TRANSAKSI BERDISKON (${rows.length})</div>
            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                <thead>
                    <tr style="background-color: #f8fafc; text-align: left; font-size: 10px;">
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Tanggal/Nota</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Customer / Kategori</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Subtotal</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Diskon</th>
                        <th style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Total</th>
                    </tr>
                </thead>
                <tbody>${baris}</tbody>
            </table>`;
    }, [data, rows, summary]);

    const buatHtmlLengkap = (isi: string) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @page { margin: 20mm; size: A4; }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 0 16px; }
                .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #023C69; padding-bottom: 16px; }
                .header h1 { margin: 0; font-size: 18px; color: #023C69; }
                .header p { margin: 4px 0 0; font-size: 11px; color: #64748b; }
                .section-header { font-size: 12px; font-weight: bold; color: #023C69; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; }
                .row-item { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
                .font-bold { font-weight: bold; }
                .text-danger { color: #e11d48; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Laporan Diskon Bengkel</h1>
                <p>Periode: ${escapeHtml(periodeLabel)}</p>
            </div>
            ${isi}
        </body>
        </html>`;

    const handleExportPreview = () => {
        setShowExportMenu(false);
        if (!data) return;
        setPreviewHtml(buatHtmlLengkap(buildExportHtml()));
        setShowPdfPreview(true);
    };

    const handleCetak = async () => {
        if (!data) return;
        const html = buatHtmlLengkap(buildExportHtml());
        setShowExportMenu(false);
        try {
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
        } catch {
            appAlert('Error', 'Gagal mencetak laporan');
        }
    };

    const handleExportDownload = async () => {
        setShowExportMenu(false);
        if (!data) return;
        setIsExporting(true);
        try {
            const html = buatHtmlLengkap(buildExportHtml());
            const namaFile = `Diskon_Bengkel_${format(date, 'yyyy-MM')}`;
            if (Platform.OS === 'web') {
                await unduhPdfLaporanWeb(html, `${namaFile}.pdf`);
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Laporan Diskon Bengkel', UTI: 'com.adobe.pdf' });
                }
            }
        } catch {
            appAlert('Error', 'Gagal membuat PDF');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <ReportPageHeader
                title="Diskon"
                subtitle="Laporan Bengkel"
                onBack={() => { if (router.canGoBack()) router.back(); }}
                onExport={() => setShowExportMenu(true)}
                isExporting={isExporting}
            />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={themeColors.primary} />
                }
            >
                <View className="px-6 pt-4">
                    <ReportStatsBento stats={stats as any} />

                    <ReportDateControls
                        filterType={filterType}
                        onFilterTypeChange={(type) => {
                            setFilterType(type);
                            setDate(new Date());
                        }}
                        formattedDate={formattedDate}
                        onPrev={handlePrev}
                        onNext={handleNext}
                        search={search}
                        onSearchChange={setSearch}
                        searchPlaceholder="Cari nopol, nomor nota, atau customer..."
                    />

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-4 -mx-6 px-6" style={{ flexGrow: 0 }}>
                        {KATEGORI_FILTER.map(k => {
                            const aktif = kategori === k.value;
                            return (
                                <Pressable
                                    key={k.value || 'semua'}
                                    onPress={() => setKategori(k.value)}
                                    className={`px-3 py-2 rounded-full border ${aktif ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                                >
                                    <Typography weight="bold" className={`text-xs ${aktif ? 'text-white' : 'text-textGray'}`}>{k.label}</Typography>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    {data?.per_kategori?.length > 0 && (
                        <>
                            <ReportSectionHeader title="Per Kategori" />
                            <View className="bg-background rounded-3xl p-4 mb-4 border border-border">
                                {data.per_kategori.map((k: any) => (
                                    <View key={k.kategori} className="flex-row items-center justify-between py-2">
                                        <View>
                                            <Typography weight="bold" className="text-textMain text-sm">{LABEL_KATEGORI[k.kategori] || k.kategori}</Typography>
                                            <Typography className="text-textGray text-xs">{k.jumlah_transaksi} transaksi • {k.persen_rata}% rata-rata</Typography>
                                        </View>
                                        <Typography weight="bold" className="text-rose-500 text-sm">-{formatCurrency(k.total_diskon)}</Typography>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    <ReportSectionHeader title="Daftar Transaksi" count={rows.length} countLabel="Nota" />
                </View>

                <View className="px-6">
                    {isLoading && !data ? (
                        <View className="py-20 items-center">
                            <ActivityIndicator color={themeColors.primary} />
                        </View>
                    ) : rows.length === 0 ? (
                        <View className="py-16 items-center">
                            <Typography className="text-textGray text-sm">Tidak ada transaksi berdiskon pada periode ini.</Typography>
                        </View>
                    ) : (
                        rows.map((r: any) => (
                            <Pressable key={r.id} onPress={() => openDetail(r)} className="bg-background rounded-3xl p-4 mb-3 border border-border">
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 pr-3">
                                        <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>{r.nama}</Typography>
                                        <Typography className="text-textGray text-xs mt-0.5">
                                            {r.nomor_transaksi} • {r.tanggal ? format(tanggalLokal(r.tanggal), 'dd MMM yyyy', { locale: localeID }) : '-'}
                                        </Typography>
                                    </View>
                                    <Badge label={STATUS_LABEL[r.status_bayar] || r.status_bayar || '-'} variant="neutral" />
                                </View>
                                <View className="flex-row flex-wrap items-center mt-2 gap-2">
                                    <Badge label={LABEL_KATEGORI[r.kategori] || r.kategori} variant="info" />
                                    <Typography className="text-textGray text-xs">Subtotal {formatCurrency(r.subtotal)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border">
                                    <Typography weight="bold" className="text-rose-500 text-sm">
                                        Diskon -{formatCurrency(r.diskon)} ({r.persen}%)
                                    </Typography>
                                    <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(r.grand_total)}</Typography>
                                </View>
                            </Pressable>
                        ))
                    )}
                </View>
            </ScrollView>

            {detailOpen && (
                <BottomSheetContainer onClose={() => setDetailOpen(false)} insets={insets} maxHeight="88%">
                    <View className="flex-1 px-6 pb-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Typography variant="h2" weight="bold">Detail Transaksi</Typography>
                                <Typography className="text-textGray text-xs mt-1">Rincian diskon per nota</Typography>
                            </View>
                            <Pressable onPress={() => setDetailOpen(false)} className="w-8 h-8 bg-background rounded-full items-center justify-center">
                                <X size={16} color={themeColors.textGray} />
                            </Pressable>
                        </View>

                        {detailLoading || !selectedTransaction ? (
                            <View className="py-16 items-center">
                                <ActivityIndicator size="large" color={themeColors.primary} />
                                <Typography className="mt-4 text-textGray">Memuat detail...</Typography>
                            </View>
                        ) : (
                            <BoundedSheetScrollView showsVerticalScrollIndicator={false}>
                                <View className="bg-background p-5 rounded-2xl mb-6 border border-transparent">
                                    <View className="flex-row justify-between mb-4">
                                        <View className="flex-1 pr-3">
                                            <Typography className="text-textGray text-[10px] font-bold uppercase mb-1">Customer</Typography>
                                            <Typography weight="bold" className="text-lg">{selectedTransaction.customer_nama || selectedTransaction.nama_customer || '-'}</Typography>
                                            <Typography className="text-textGray text-xs font-semibold">{selectedTransaction.nomor_plat || selectedTransaction.plat_nomor || '-'}</Typography>
                                        </View>
                                        <View className="items-end">
                                            <Typography className="text-textGray text-[10px] font-bold uppercase mb-1">Tanggal</Typography>
                                            <Typography weight="bold">{selectedTransaction.tanggal ? format(tanggalLokal(selectedTransaction.tanggal), 'dd MMM yyyy', { locale: localeID }) : '-'}</Typography>
                                        </View>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <View>
                                            <Typography className="text-textGray text-[10px] font-bold uppercase mb-1">Status</Typography>
                                            <Badge label={STATUS_LABEL[selectedTransaction.status_bayar] || selectedTransaction.status_bayar || '-'} variant="neutral" />
                                        </View>
                                        <View className="items-end">
                                            <Typography className="text-textGray text-[10px] font-bold uppercase mb-1">No. Nota</Typography>
                                            <Typography weight="medium" className="text-text">{selectedTransaction.nomor_transaksi}</Typography>
                                        </View>
                                    </View>
                                </View>

                                <Typography variant="body1" weight="bold" className="mb-3">Sparepart</Typography>
                                {(selectedTransaction.detail_parts || []).length === 0 ? (
                                    <Typography className="text-textGray text-xs mb-4">Tidak ada sparepart.</Typography>
                                ) : (
                                    (selectedTransaction.detail_parts || []).map((p: any) => (
                                        <View key={`p-${p.id}`} className="flex-row justify-between py-2 border-b border-border">
                                            <View className="flex-1 pr-3">
                                                <Typography weight="bold" className="text-textMain text-sm" numberOfLines={2}>{p.spare_part_nama || 'Sparepart'}</Typography>
                                                <Typography className="text-textGray text-xs">{Number(p.qty)} x {formatCurrency(p.harga_jual)}</Typography>
                                            </View>
                                            <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(p.subtotal)}</Typography>
                                        </View>
                                    ))
                                )}

                                <Typography variant="body1" weight="bold" className="mt-5 mb-3">Jasa Servis</Typography>
                                {(selectedTransaction.detail_services || []).length === 0 ? (
                                    <Typography className="text-textGray text-xs mb-4">Tidak ada jasa servis.</Typography>
                                ) : (
                                    (selectedTransaction.detail_services || []).map((s: any) => (
                                        <View key={`s-${s.id}`} className="flex-row justify-between py-2 border-b border-border">
                                            <View className="flex-1 pr-3">
                                                <Typography weight="bold" className="text-textMain text-sm" numberOfLines={2}>{s.nama_jasa}</Typography>
                                                <Typography className="text-textGray text-xs">{Number(s.qty)} x {formatCurrency(s.harga)}</Typography>
                                            </View>
                                            <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(s.subtotal)}</Typography>
                                        </View>
                                    ))
                                )}

                                <View className="mt-6 bg-background p-5 rounded-2xl border border-border">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-textGray text-sm">Subtotal</Typography>
                                        <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(selectedTransaction.subtotal || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-rose-500 text-sm">Diskon</Typography>
                                        <Typography weight="bold" className="text-rose-500 text-sm">-{formatCurrency(selectedTransaction.diskon || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between pt-2 border-t border-border">
                                        <Typography weight="bold" className="text-textMain">Total</Typography>
                                        <Typography weight="bold" className="text-textMain">{formatCurrency(selectedTransaction.grand_total || 0)}</Typography>
                                    </View>
                                </View>
                            </BoundedSheetScrollView>
                        )}
                    </View>
                </BottomSheetContainer>
            )}

            <ReportExportSheet
                visible={showExportMenu}
                onClose={() => setShowExportMenu(false)}
                subtitle="Pilih metode ekspor laporan diskon"
                onPreview={handleExportPreview}
                onPrint={handleCetak}
                onDownload={handleExportDownload}
            />

            {showPdfPreview && (
                <Modal onRequestClose={() => setShowPdfPreview(false)} visible={showPdfPreview} animationType="slide">
                    <SafeAreaView className="flex-1 bg-surface">
                        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-surface">
                            <Pressable onPress={() => setShowPdfPreview(false)} className="w-10 h-10 items-center justify-center rounded-full bg-background">
                                <X size={20} color="#1e293b" />
                            </Pressable>
                            <Typography variant="body1" weight="bold" className="text-text">Preview Diskon</Typography>
                            <Pressable
                                onPress={handleCetak}
                                className="flex-row items-center px-4 py-2 rounded-xl shadow-sm"
                                style={{ backgroundColor: '#4f46e5' }}
                            >
                                <Download size={16} color="white" className="mr-2" />
                                <Typography variant="caption" weight="bold" className="text-white">CETAK</Typography>
                            </Pressable>
                        </View>
                        <View className="flex-1 bg-background">
                            {Platform.OS === 'web' ? (
                                <iframe srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }} title="Diskon Preview" />
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
