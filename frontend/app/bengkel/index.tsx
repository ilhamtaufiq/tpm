import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, Platform, Modal, TextInput, RefreshControl as RNRefreshControl, Share, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Plus,
    Search,
    Filter,
    Calendar,
    Wrench,
    Clock,
    CheckCircle2,
    Package,
    Receipt,
    Database,
    Activity,
    ArrowRight,
    Printer,
    Download,
    X,
    AlertCircle,
    Banknote,
    Truck,
    Car,
    Share2,
    ShoppingCart,
    Edit2,
    QrCode,
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingDown,
    TrendingUp,
    CircleDollarSign
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BengkelForm } from '../../components/BengkelForm';
import { PaymentModal } from '../../components/PaymentModal';
import { BarcodeScannerModal } from '../../components/ui/BarcodeScannerModal';
import { useTransaksiBengkelList, useTransaksiBengkelSummary, useUpdateTransaksiBengkelStatus, useUpdateTransaksiBengkelPayment, useVoidTransaksiBengkel, useCreatePengeluaran } from '../../hooks/useBengkel';
import { useMobilList } from '../../hooks/useMobil';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDistanceToNow, format, startOfMonth, isValid, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { printReceipt, saveReceiptPDF, PrintReceiptData } from '../../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import { useKasBankBalances, useCreateTransaction, useTransfer, useKasBankList, useCreatePiutang } from '../../hooks/useKeuangan';

import { AlertDialog as AlertDialogComponent } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { FILE_URL } from '../../utils/api';
import { KaryawanSelector } from '../../components/ui/KaryawanSelector';
import { Karyawan } from '../../services/sdm';
import { Header } from '../../components/ui/Header';

export default function BengkelScreen() {

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'LUNAS' | 'PARTIAL' | 'UNPAID' | 'BATAL'>('ALL');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Filters
    const [dateRange, setDateRange] = useState({
        dari: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        sampai: format(new Date(), 'yyyy-MM-dd')
    });
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [tempDateRange, setTempDateRange] = useState({ ...dateRange });
    const dateSheetRef = useRef<BottomSheet>(null);
    const dateSnapPoints = useMemo(() => ['50%', '70%'], []);

    const { data: queueData, isLoading, refetch } = useTransaksiBengkelList({
        search: searchQuery || undefined,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 5000
    });

    const { data: summary, refetch: refetchSummary } = useTransaksiBengkelSummary({
        search: searchQuery || undefined,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 5000
    });

    useFocusEffect(
        React.useCallback(() => {
            refetch();
            refetchSummary();
        }, [searchQuery])
    );

    const { data: historyData, isLoading: isHistoryLoading } = useKasBankList({
        jenis: 'KAS_UNIT_BENGKEL',
        limit: 20, // Increased limit for full history
        sort_by: 'tanggal',
        sort_order: 'desc',
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    });

    const updateStatsMutation = useUpdateTransaksiBengkelStatus();
    const voidMutation = useVoidTransaksiBengkel();

    const [selectedItem, setSelectedItem] = React.useState<any | null>(null);
    const [view, setView] = React.useState<'form' | 'detail' | 'edit'>('form');
    const [refreshing, setRefreshing] = React.useState(false);
    const [sheetIndex, setSheetIndex] = React.useState(-1);
    const [printSettings, setPrintSettings] = React.useState<PrintSettings | null>(null);
    const [printing, setPrinting] = React.useState(false);
    const [dialogConfig, setDialogConfig] = React.useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
        loading?: boolean;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert',
        onConfirm: undefined,
        loading: false
    });

    const insets = useSafeAreaInsets();
    const [paymentModalVisible, setPaymentModalVisible] = React.useState(false);
    const [showWalletModal, setShowWalletModal] = React.useState(false);
    const [showHistoryModal, setShowHistoryModal] = React.useState(false);

    // Inline Expense Form State
    const [isRecordingExpense, setIsRecordingExpense] = React.useState(false);
    const [expenseAmount, setExpenseAmount] = React.useState('');
    const [expenseNote, setExpenseNote] = React.useState('');
    const [expensePaymentMethod, setExpensePaymentMethod] = React.useState<string>('KAS_UTAMA');


    const createExpenseMutation = useCreatePengeluaran();
    const createTransactionMutation = useCreateTransaction();
    const transferMutation = useTransfer();

    const [expenseMode, setExpenseMode] = React.useState<'KELUAR' | 'MASUK' | 'SETORAN' | 'PIUTANG'>('KELUAR');
    const [expensePiutangType, setExpensePiutangType] = React.useState<'UMUM' | 'KASBON'>('UMUM');
    const [debiturName, setDebiturName] = React.useState('');
    const [selectedKaryawan, setSelectedKaryawan] = React.useState<Karyawan | null>(null);


    const createPiutangMutation = useCreatePiutang();
    const { data: balances } = useKasBankBalances();
    const unitBalance = balances?.kas_unit_bengkel?.saldo || 0;

    // Logic for internal auto-settlement (Virtual Elimination)
    const { data: mobilData } = useMobilList({ limit: 1000 });
    const soldCars = useMemo(() => {
        const soldSet = new Set<string>();
        if (mobilData?.data) {
            mobilData.data.forEach((m: any) => {
                if (m.status?.toUpperCase() === 'TERJUAL') {
                    soldSet.add(String(m.id));
                }
            });
        }
        return soldSet;
    }, [mobilData]);

    const queue = queueData?.data || [];

    // Filtered queue based on search query and payment filter
    const filteredQueue = useMemo(() => {
        let result = queue;

        if (paymentFilter === 'LUNAS') {
            result = result.filter((item: any) => item.status_bayar === 'lunas' || item.status_bayar === 'LUNAS');
        } else if (paymentFilter === 'PARTIAL') {
            result = result.filter((item: any) =>
                (item.status_bayar === 'belum_lunas' || item.status_bayar === 'BELUM_LUNAS') &&
                (Number(item.jumlah_bayar) > 0)
            );
        } else if (paymentFilter === 'UNPAID') {
            result = result.filter((item: any) =>
                (item.status_bayar === 'belum_lunas' || item.status_bayar === 'BELUM_LUNAS') &&
                (Number(item.jumlah_bayar) === 0)
            );
        } else if (paymentFilter === 'BATAL') {
            result = result.filter((item: any) => item.status_bayar === 'batal' || item.status_bayar === 'BATAL');
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((item: any) => {
                const plate = (item.nomor_plat || '').toLowerCase();
                const customer = (item.nama_customer || '').toLowerCase();
                const vehicle = (item.jenis_kendaraan || '').toLowerCase();
                const trno = (item.nomor_transaksi || '').toLowerCase();
                return plate.includes(q) || customer.includes(q) || vehicle.includes(q) || trno.includes(q);
            });
        }

        // Virtual Elimination for Internal Orders
        result = result.filter((item: any) => {
            const kategori = String(item.kategori || '').toLowerCase();
            if (kategori === 'jual_beli_mobil' && item.mobil_id) {
                if (soldCars.has(String(item.mobil_id))) {
                    return false; // Hide if car is already sold
                }
            }
            return true;
        });

        return result;
    }, [queue, searchQuery, paymentFilter, soldCars]);

    // Calculate counters for UI Pills (using values from summary API if available, else local)
    const stats = useMemo(() => {
        if (summary) {
            return {
                total: summary.total_transaksi || 0,
                lunas: summary.lunas_count || 0,
                partial: summary.belum_lunas_count || 0,
                unpaid: summary.belum_bayar_count || 0,
                batal: summary.batal_count || 0
            };
        }

        // Fallback to local calculation if summary not yet loaded
        let lunas = 0, partial = 0, unpaid = 0, batal = 0;
        queue.forEach((item: any) => {
            // Apply virtual filtering here too for stats consistency
            const kategori = String(item.kategori || '').toLowerCase();
            if (kategori === 'jual_beli_mobil' && item.mobil_id && soldCars.has(String(item.mobil_id))) {
                return;
            }

            const s = (item.status_bayar || '').toUpperCase();
            const paidNum = Number(item.jumlah_bayar || 0);
            if (s === 'LUNAS') lunas++;
            else if (s === 'BATAL') batal++;
            else if (paidNum > 0) partial++;
            else unpaid++;
        });
        return { total: lunas + partial + unpaid + batal, lunas, partial, unpaid, batal };
    }, [queue, summary, soldCars]);

    // Load print settings
    React.useEffect(() => {
        loadPrintSettings();
    }, []);

    const loadPrintSettings = async () => {
        try {
            const settings = await printSettingsService.getSettings();
            setPrintSettings(settings);
        } catch (error) {
            console.error('Failed to load print settings:', error);
        }
    };

    const handlePrintReceipt = async (item: any) => {
        if (!printSettings) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Pengaturan cetak belum dimuat',
                variant: 'error',
                type: 'alert'
            });
            return;
        }

        try {
            setPrinting(true);

            const receiptData: PrintReceiptData = {
                type: 'bengkel',
                transactionNumber: item.nomor_transaksi || item.id.toString(),
                antrian: item.nomor_antrian || '-',
                date: new Date(item.created_at || new Date()),
                customerName: item.customer_nama,
                cashierName: item.kasir_nama || '-',
                mechanicName: item.mekanik_nama || '-',
                status: item.status_bayar || 'Belum Bayar',
                vehiclePlate: item.nomor_plat,
                vehicleType: item.jenis_kendaraan,
                services: (item.detail_services || []).map((s: any) => ({
                    description: s.nama_jasa,
                    quantity: 1,
                    unitPrice: Number(s.harga),
                    subtotal: Number(s.harga)
                })),
                parts: (item.detail_parts || []).map((p: any) => ({
                    description: p.spare_part_nama || 'Sparepart',
                    quantity: p.qty,
                    unitPrice: Number(p.subtotal) / p.qty,
                    subtotal: Number(p.subtotal)
                })),
                subtotal: item.subtotal || item.total_biaya || item.grand_total,
                discount: item.diskon || 0,
                total: item.grand_total,
                paid: item.jumlah_bayar,
                change: item.kembalian,
                paymentMethod: item.metode_bayar || '-',
                notes: item.catatan
            };

            await printReceipt(receiptData, printSettings);

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Struk berhasil dicetak',
                variant: 'success',
                type: 'alert',
                onConfirm: undefined
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal mencetak struk'),
                variant: 'error',
                type: 'alert',
                onConfirm: undefined
            });
        } finally {
            setPrinting(false);
        }
    };

    const handleSavePDF = async (item: any) => {
        if (!printSettings) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Pengaturan cetak belum dimuat',
                variant: 'error',
                type: 'alert'
            });
            return;
        }

        try {
            setPrinting(true);

            const receiptData: PrintReceiptData = {
                type: 'bengkel',
                transactionNumber: item.nomor_transaksi || item.id.toString(),
                antrian: item.nomor_antrian || '-',
                date: new Date(item.created_at || new Date()),
                customerName: item.customer_nama,
                cashierName: item.kasir_nama || '-',
                mechanicName: item.mekanik_nama || '-',
                status: item.status_bayar || 'Belum Bayar',
                vehiclePlate: item.nomor_plat,
                vehicleType: item.jenis_kendaraan,
                services: (item.detail_services || []).map((s: any) => ({
                    description: s.nama_jasa,
                    quantity: 1,
                    unitPrice: Number(s.harga),
                    subtotal: Number(s.harga)
                })),
                parts: (item.detail_parts || []).map((p: any) => ({
                    description: p.spare_part_nama || 'Sparepart',
                    quantity: p.qty,
                    unitPrice: Number(p.subtotal) / p.qty,
                    subtotal: Number(p.subtotal)
                })),
                subtotal: item.total_biaya || item.grand_total,
                total: item.grand_total,
                paymentMethod: item.metode_bayar || '-',
                notes: item.catatan
            };

            await saveReceiptPDF(receiptData, printSettings);

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Struk berhasil disimpan sebagai PDF',
                variant: 'success',
                type: 'alert',
                onConfirm: undefined
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal menyimpan PDF'),
                variant: 'error',
                type: 'alert',
                onConfirm: undefined
            });
        } finally {
            setPrinting(false);
        }
    };

    const handleShareLink = async (item: any) => {
        const shareUrl = `${FILE_URL}/api/v1/public/receipt/view/bengkel/${item.id}`;
        const shareMessage = `Halo, ini adalah struk transaksi Anda di Tiga Putra Motor: ${shareUrl}`;

        try {
            if (Platform.OS === 'web' && !navigator.share) {
                await navigator.clipboard.writeText(shareMessage);
                setDialogConfig({
                    visible: true,
                    title: 'Berhasil',
                    message: 'Link struk telah disalin ke clipboard.',
                    variant: 'success',
                    type: 'alert'
                });
                return;
            }

            await Share.share({
                message: shareMessage,
                url: shareUrl,
                title: 'Bagikan Struk Digital'
            });
        } catch (error: any) {
            console.error('Error sharing link:', error);
            if (error?.message?.includes('not supported') || Platform.OS === 'web') {
                try {
                    await navigator.clipboard.writeText(shareMessage);
                    setDialogConfig({
                        visible: true,
                        title: 'Berhasil',
                        message: 'Link struk telah disalin ke clipboard.',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (clipError) {
                    console.error('Clipboard fallback also failed:', clipError);
                }
            }
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleGoBack = () => {
        try {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            try {
                router.replace('/');
            } catch (e) {
                console.error('Fallback navigation failed:', e);
            }
        }
    };

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const walletSheetRef = useRef<BottomSheet>(null);
    const walletSnapPoints = useMemo(() => ['85%', '95%'], []);

    const handlePresentModalPress = (type: 'form' | 'detail' | 'edit', item?: any) => {
        setView(type);
        if (item) setSelectedItem(item);
        else if (type === 'form') setSelectedItem(null);

        if (Platform.OS === 'web') {
            setSheetIndex(0);
        } else {
            bottomSheetRef.current?.snapToIndex(0);
        }
    };

    const handleClosePress = useCallback(() => {
        setSheetIndex(-1);
        setSelectedItem(null);
    }, []);

    const updateStatus = async (id: number, newStatus: string) => {
        try {
            await updateStatsMutation.mutateAsync({ id, status: newStatus });
            refetch();
            refetchSummary();

            // Close modal and show notification
            handleClosePress();
            setDialogConfig({
                visible: true,
                title: 'Status Diperbarui',
                message: `Status pengerjaan unit berhasil diubah menjadi ${newStatus.toUpperCase()}`,
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            console.error('Failed to update status:', error);
            setDialogConfig({
                visible: true,
                title: 'Gagal Update',
                message: 'Terjadi kesalahan saat memperbarui status pengerjaan',
                variant: 'error',
                type: 'alert'
            });
        }
    };

    const handleVoidOrder = async (item: any) => {
        setDialogConfig({
            visible: true,
            title: 'Batalkan Order',
            message: `Yakin ingin membatalkan order ${item.nomor_plat}? Transaksi akan dihapus permanen dan stok sparepart akan dikembalikan.`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setDialogConfig(prev => ({ ...prev, loading: true }));
                    await voidMutation.mutateAsync(item.id);
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'Order berhasil dibatalkan',
                        variant: 'success',
                        type: 'alert',
                        loading: false
                    });
                    handleClosePress();
                } catch (err: any) {
                    setDialogConfig({
                        visible: true,
                        title: 'Gagal',
                        message: getErrorMessage(err, 'Gagal membatalkan order'),
                        variant: 'error',
                        type: 'alert',
                        loading: false
                    });
                }
            }
        });
    };

    const handleApplyDate = () => {
        const dariValid = isValid(parse(tempDateRange.dari, 'yyyy-MM-dd', new Date()));
        const sampaiValid = isValid(parse(tempDateRange.sampai, 'yyyy-MM-dd', new Date()));

        if (!dariValid || !sampaiValid) {
            Alert.alert('Kesalahan', 'Format tanggal tidak valid (Gunakan YYYY-MM-DD)');
            return;
        }

        setDateRange(tempDateRange);
        setIsDateModalVisible(false);
        if (Platform.OS !== 'web') {
            dateSheetRef.current?.close();
        }
    };

    const handleScanBarcode = (data: string) => {
        setSearchQuery(data);
        setIsScannerOpen(false);
    };

    const renderDateContent = () => (
        <View className="p-0">
            <Typography className="text-gray-400 text-[10px] uppercase font-bold mb-4 ml-1">Rentang Tanggal</Typography>
            <View className="space-y-4">
                <View>
                    <Typography variant="caption" className="text-gray-500 mb-1 ml-1">Dari Tanggal</Typography>
                    <TextInput
                        className="bg-gray-50 h-12 px-4 rounded-xl border border-gray-100 text-sm font-bold text-primary"
                        value={tempDateRange.dari}
                        onChangeText={(v) => setTempDateRange({ ...tempDateRange, dari: v })}
                        placeholder="YYYY-MM-DD"
                    />
                </View>
                <View>
                    <Typography variant="caption" className="text-gray-500 mb-1 ml-1">Sampai Tanggal</Typography>
                    <TextInput
                        className="bg-gray-50 h-12 px-4 rounded-xl border border-gray-100 text-sm font-bold text-primary"
                        value={tempDateRange.sampai}
                        onChangeText={(v) => setTempDateRange({ ...tempDateRange, sampai: v })}
                        placeholder="YYYY-MM-DD"
                    />
                </View>
            </View>

            <View className="flex-row mt-8 space-x-3 pb-8">
                <View className="flex-1">
                    <Button
                        variant="outline"
                        title="Batal"
                        onPress={() => setIsDateModalVisible(false)}
                    />
                </View>
                <View className="flex-1">
                    <Button
                        title="Terapkan"
                        onPress={handleApplyDate}
                    />
                </View>
            </View>
        </View>
    );

    const renderDetailContent = () => {
        if (!selectedItem) return null;
        return (
            <>
                <View className="flex-row justify-between items-start mb-6">
                    <View>
                        <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{selectedItem.nomor_plat}</Typography>
                        <Typography variant="body2" className="text-textGray mt-1">{selectedItem.jenis_kendaraan}</Typography>
                    </View>
                    <Badge
                        label={(selectedItem.status_pengerjaan || '').toUpperCase()}
                        variant={
                            selectedItem.status_pengerjaan === 'proses' ? 'info' :
                                selectedItem.status_pengerjaan === 'selesai' ? 'success' :
                                    selectedItem.status_pengerjaan === 'batal' ? 'error' : 'warning'
                        }
                    />
                </View>

                {/* Category Info */}
                {selectedItem.kategori && selectedItem.kategori !== 'umum' && (
                    <View className={`flex-row items-center mb-4 px-4 py-2.5 rounded-2xl border ${selectedItem.kategori === 'jasa_angkut'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-blue-50 border-blue-200'
                        }`}>
                        {selectedItem.kategori === 'jasa_angkut' ? (
                            <Truck size={16} color="#10B981" />
                        ) : (
                            <Car size={16} color="#3B82F6" />
                        )}
                        <Typography weight="bold" className={`ml-2 text-xs ${selectedItem.kategori === 'jasa_angkut' ? 'text-emerald-700' : 'text-blue-700'
                            }`}>
                            {selectedItem.kategori === 'jasa_angkut' ? 'Jasa Angkut' : 'Jual Beli Mobil'}
                        </Typography>
                        {selectedItem.muatan_id && (
                            <Typography className="text-emerald-500 text-[10px] ml-2">
                                Muatan {selectedItem.muatan_nomor ? `#${selectedItem.muatan_nomor}` : `ID #${selectedItem.muatan_id}`}
                            </Typography>
                        )}
                        {selectedItem.mobil_id && (
                            <Typography className="text-blue-500 text-[10px] ml-2">
                                Mobil #{selectedItem.mobil_id}
                            </Typography>
                        )}
                    </View>
                )}

                <Card variant="outlined" className="p-6 border-gray-100 mb-8 bg-gray-50/50 rounded-[32px]">
                    <Typography variant="caption" weight="bold" className="mb-4 text-primary uppercase tracking-widest">Rincian Order</Typography>

                    {(selectedItem.detail_services || []).map((s: any, idx: number) => (
                        <View key={`svc-${idx}`} className="flex-row justify-between mb-2">
                            <Typography variant="body2" className="flex-1 text-textMain">{s.nama_jasa}</Typography>
                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(s.harga)}</Typography>
                        </View>
                    ))}

                    {(selectedItem.detail_parts || []).map((p: any, idx: number) => (
                        <View key={`part-${idx}`} className="flex-row justify-between mb-2">
                            <Typography variant="body2" className="flex-1 text-textGray">
                                {p.spare_part_nama || p.spare_part?.nama || 'Sparepart'} <Typography variant="caption" className="text-textGray/60">x{p.qty}</Typography>
                            </Typography>
                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(p.subtotal || 0)}</Typography>
                        </View>
                    ))}

                    {(!selectedItem.detail_services?.length && !selectedItem.detail_parts?.length) ? (
                        <Typography variant="body2" className="mb-4 text-gray-400 italic">Tidak ada item rincian</Typography>
                    ) : null}

                    {selectedItem.catatan ? (
                        <View className="mt-4 pt-4 border-t border-gray-100">
                            <Typography variant="caption" className="text-gray-400 mb-1">Catatan:</Typography>
                            <Typography variant="body2" className="italic text-textMain">{selectedItem.catatan}</Typography>
                        </View>
                    ) : null}

                    <View className="h-[1px] bg-gray-200 my-4" />

                    <View className="space-y-1 mb-2">
                        <View className="flex-row justify-between items-center">
                            <Typography variant="caption" className="text-textGray">Subtotal</Typography>
                            <Typography variant="caption" weight="semibold">{formatCurrency(selectedItem.subtotal || 0)}</Typography>
                        </View>
                        {selectedItem.diskon > 0 ? (
                            <View className="flex-row justify-between items-center">
                                <Typography variant="caption" className="text-rose-500">Diskon</Typography>
                                <Typography variant="caption" weight="semibold" className="text-rose-500">-{formatCurrency(selectedItem.diskon)}</Typography>
                            </View>
                        ) : null}
                        <View className="flex-row justify-between items-center">
                            <Typography variant="caption" className="text-textGray">Sudah Dibayar</Typography>
                            <Typography variant="caption" weight="semibold">{formatCurrency(selectedItem.jumlah_bayar || 0)}</Typography>
                        </View>
                    </View>

                    <View className="h-[1px] bg-gray-200 my-4" />
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Typography weight="bold" className="text-lg">Total Pembayaran</Typography>
                            {selectedItem.metode_bayar === 'INTERNAL' ? (
                                (selectedItem.status_bayar === 'LUNAS' || selectedItem.status_bayar === 'lunas') ? (
                                    <Typography variant="caption" className="text-emerald-600 font-bold">
                                        Lunas — Potong Laba TPM
                                    </Typography>
                                ) : (
                                    <Typography variant="caption" className="text-amber-600 font-bold">
                                        Menunggu Pelunasan Jasa Angkut
                                    </Typography>
                                )
                            ) : selectedItem.kategori === 'jual_beli_mobil' && selectedItem.mobil_id ? (
                                <Typography variant="caption" className="text-orange-600 font-bold">
                                    Hutang Unit (Piutang JB Mobil) — Dibayar saat Terjual
                                </Typography>
                            ) : (selectedItem.grand_total > (selectedItem.jumlah_bayar || 0)) && (
                                <Typography variant="caption" className="text-rose-600 font-bold">
                                    Sisa: {formatCurrency(selectedItem.grand_total - (selectedItem.jumlah_bayar || 0))}
                                </Typography>
                            )}
                        </View>
                        <Typography variant="h2" weight="bold" className="text-primary">
                            {formatCurrency(selectedItem.grand_total || 0)}
                        </Typography>
                    </View>

                    {selectedItem.piutang_id && selectedItem.status_bayar !== 'LUNAS' && selectedItem.status_bayar !== 'lunas' && (
                        <Pressable
                            onPress={() => setPaymentModalVisible(true)}
                            className="mt-6 bg-primary/10 py-4 rounded-2xl flex-row items-center justify-center border border-primary/20 shadow-sm"
                        >
                            <Banknote size={20} color="#023C69" />
                            <Typography weight="bold" className="text-primary ml-2 uppercase tracking-widest text-xs">Pelunasan / Bayar Cicilan</Typography>
                        </Pressable>
                    )}
                </Card>

                {/* Status Update Section */}
                <View className="mb-8 mt-2">
                    <Typography variant="caption" weight="bold" className="mb-3 text-textGray uppercase tracking-widest px-1">Update Status Pengerjaan</Typography>
                    <View className="flex-row items-center space-x-3">
                        {[
                            { id: 'antre', label: 'Antre', activeBg: '#F59E0B', activeBorder: '#D97706' },
                            { id: 'proses', label: 'Proses', activeBg: '#3B82F6', activeBorder: '#2563EB' },
                            { id: 'selesai', label: 'Selesai', activeBg: '#10B981', activeBorder: '#059669' }
                        ].map((s) => {
                            const isActive = (selectedItem.status_pengerjaan || '').toString().toLowerCase() === s.id;
                            return (
                                <Pressable
                                    key={s.id}
                                    onPress={() => updateStatus(selectedItem.id, s.id)}
                                    disabled={updateStatsMutation.isPending}
                                    style={isActive ? { backgroundColor: s.activeBg, borderColor: s.activeBorder } : {}}
                                    className={`flex-1 py-4 rounded-2xl border-2 items-center justify-center ${isActive ? 'shadow-lg' : 'bg-white border-gray-100 shadow-sm'}`}
                                >
                                    <Typography
                                        weight="bold"
                                        className={`text-[10px] uppercase tracking-widest ${isActive ? 'text-white' : 'text-textGray'}`}
                                    >
                                        {s.label}
                                    </Typography>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="gap-3">
                    <Button
                        variant="primary"
                        title="Cetak Struk Transaksi"
                        onPress={() => handlePrintReceipt(selectedItem)}
                        loading={printing}
                        icon={<Printer size={20} color="white" />}
                        className="rounded-2xl h-14 bg-primary shadow-lg shadow-primary/30"
                    />

                    <Button
                        variant="secondary"
                        title="Simpan / Bagikan PDF"
                        onPress={() => handleSavePDF(selectedItem)}
                        loading={printing}
                        icon={<Download size={20} color="white" />}
                        className="rounded-2xl h-14 bg-secondary shadow-lg shadow-secondary/30"
                    />

                    <Button
                        variant="primary"
                        title="Bagikan Link Struk"
                        onPress={() => handleShareLink(selectedItem)}
                        icon={<Share2 size={20} color="white" />}
                        className="rounded-2xl h-14 bg-[#00ADEF] shadow-lg shadow-[#00ADEF]/30"
                    />

                    {selectedItem.status_bayar !== 'lunas' && selectedItem.status_bayar !== 'LUNAS' &&
                        selectedItem.status_bayar !== 'batal' && selectedItem.status_bayar !== 'BATAL' && (
                            <Button
                                variant="secondary"
                                title="Edit Transaksi"
                                onPress={() => setView('edit')}
                                icon={<Edit2 size={20} color="white" />}
                                className="rounded-2xl h-14 bg-amber-500 shadow-lg shadow-amber-500/30"
                            />
                        )}

                    <Button
                        variant="outline-danger"
                        title="Batalkan Order"
                        onPress={() => handleVoidOrder(selectedItem)}
                        loading={voidMutation.isPending}
                        className="rounded-2xl h-14"
                    />
                </View>
            </>
        );
    };

    const handleCloseWallet = () => {
        if (Platform.OS === 'web') {
            setShowWalletModal(false);
        } else {
            walletSheetRef.current?.close();
        }
        setIsRecordingExpense(false);
        setExpenseAmount('');
        setExpenseNote('');
        setDebiturName('');
    };


    const renderWalletContent = () => (
        <>
            <View className="flex-row justify-between items-center mb-8">
                <View>
                    <Typography variant="h3" weight="bold" className="text-primary text-2xl tracking-tight">Dompet Bengkel</Typography>
                    <Typography className="text-textGray/40 text-[10px] uppercase font-black tracking-widest">Workshop Cash Liquidity</Typography>
                </View>
                <Pressable
                    onPress={handleCloseWallet}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                >
                    <X size={20} color="#6B7280" />
                </Pressable>
            </View>

            {/* Main Wallet View */}
            {!isRecordingExpense && (
                <View>
                    {/* Balance Card */}
                    <View className="bg-primary p-7 rounded-[32px] mb-6 shadow-xl shadow-primary/20 relative overflow-hidden">
                        <View className="absolute top-0 right-0 p-4">
                            <Wallet size={80} color="rgba(255,255,255,0.1)" strokeWidth={1} />
                        </View>
                        <Typography className="text-white/60 text-[10px] font-black uppercase tracking-[2px] mb-2 text-center">Total Uang Fisik Di Laci</Typography>
                        <Typography weight="bold" className="text-white text-3xl tracking-tight text-center">
                            {formatCurrency(unitBalance)}
                        </Typography>

                        {/* Balanced Breakdown Section */}
                        <View className="mt-5 pt-5 border-t border-white/10">
                            <View className="flex-row justify-between mb-4">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />
                                        <Typography variant="caption" className="text-white/50 font-black uppercase tracking-[1px] text-[7px]">Dana Masuk (Pusat)</Typography>
                                    </View>
                                    <Typography className="text-white text-sm font-bold">{formatCurrency(summary?.total_dana_dari_utama || 0)}</Typography>
                                </View>
                                <View className="flex-1 items-end">
                                    <View className="flex-row items-center mb-1">
                                        <Typography variant="caption" className="text-white/50 font-black uppercase tracking-[1px] text-[7px]">Total Keluar (Biaya/Setor)</Typography>
                                        <View className="w-1.5 h-1.5 rounded-full bg-rose-400 ml-2" />
                                    </View>
                                    <Typography className="text-rose-300 text-sm font-bold">{formatCurrency((summary?.total_dana_dari_utama || 0) + (summary?.total_tunai || 0) - unitBalance)}</Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between pt-4 border-t border-white/5">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                                        <Typography variant="caption" className="text-white/50 font-black uppercase tracking-[1px] text-[7px]">Hasil Jual (Tunai)</Typography>
                                    </View>
                                    <Typography className="text-white text-sm font-bold">{formatCurrency(summary?.total_tunai || 0)}</Typography>
                                </View>
                                <View className="flex-1 items-end">
                                    <View className="flex-row items-center mb-1 text-right">
                                        <Typography variant="caption" className="text-white/30 font-bold uppercase tracking-[1px] text-[7px]">Omzet (via Transfer)</Typography>
                                        <View className="w-1 h-1 rounded-full bg-gray-500 ml-2" />
                                    </View>
                                    <Typography className="text-white/40 text-[10px] font-bold italic">{formatCurrency(summary?.total_transfer || 0)}</Typography>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Cash Activity History */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4 px-1">
                            <Typography variant="caption" weight="bold" className="text-textGray/40 uppercase tracking-[2px]">History Aktivitas Kas & Setoran</Typography>
                            <Pressable onPress={() => setShowHistoryModal(true)}>
                                <Typography className="text-primary text-[10px] font-bold underline">Lihat Semua</Typography>
                            </Pressable>
                        </View>

                        {historyData?.data?.length === 0 ? (
                            <View className="bg-gray-50/50 p-8 rounded-[32px] border border-dashed border-gray-200 items-center justify-center">
                                <Typography className="text-gray-400 text-xs italic">Belum ada aktivitas kas</Typography>
                            </View>
                        ) : (
                            <View className="space-y-3">
                                {historyData?.data?.slice(0, 2)?.map((item: any) => (
                                    <View key={item.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex-row items-center shadow-sm">
                                        <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${item.tipe === 'MASUK' ? 'bg-emerald-50' : 'bg-rose-50'
                                            }`}>
                                            {item.tipe === 'MASUK' ? (
                                                <TrendingUp size={20} color="#10B981" />
                                            ) : (
                                                <TrendingDown size={20} color="#E11D48" />
                                            )}
                                        </View>
                                        <View className="flex-1">
                                            <Typography weight="bold" className="text-textMain text-sm">{item.keterangan || item.sumber}</Typography>
                                            <Typography variant="caption" className="text-textGray/60 mt-0.5">{format(new Date(item.tanggal), 'dd MMM yyyy')}</Typography>
                                        </View>
                                        <View className="items-end">
                                            <Typography weight="bold" className={`text-sm ${item.tipe === 'MASUK' ? 'text-emerald-600' : 'text-rose-600'
                                                }`}>
                                                {item.tipe === 'MASUK' ? '+' : '-'}{formatCurrency(item.nominal)}
                                            </Typography>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Quick Actions Container */}
                    <View>
                        <Typography variant="caption" weight="bold" className="text-textGray/30 uppercase tracking-[2px] ml-1 mb-4 text-center">Penyesuaian & Pengeluaran Kas</Typography>

                        <View className="flex-row space-x-2 mb-6">
                            <Pressable
                                onPress={() => {
                                    setExpenseMode('KELUAR');
                                    setIsRecordingExpense(true);
                                    setExpenseNote('');
                                    setExpensePaymentMethod('TUNAI');
                                }}
                                className="flex-1 bg-white p-3 rounded-2xl border border-gray-100 items-center justify-center shadow-sm active:bg-gray-50"
                            >
                                <View className="w-8 h-8 bg-rose-50 rounded-xl items-center justify-center mb-2">
                                    <TrendingDown size={16} color="#E11D48" />
                                </View>
                                <Typography weight="bold" className="text-rose-600 text-[8px] uppercase tracking-wider">Catat Biaya</Typography>
                                <Typography className="text-textGray/30 text-[6px] font-bold mt-0.5">DANA KELUAR</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setExpenseMode('MASUK');
                                    setIsRecordingExpense(true);
                                    setExpenseNote('Terima Dana dari Akun Utama');
                                    setExpensePaymentMethod('TUNAI');
                                }}
                                className="flex-1 bg-white p-3 rounded-2xl border border-gray-100 items-center justify-center shadow-sm active:bg-gray-50"
                            >
                                <View className="w-8 h-8 bg-emerald-50 rounded-xl items-center justify-center mb-2">
                                    <TrendingUp size={16} color="#10B981" />
                                </View>
                                <Typography weight="bold" className="text-emerald-600 text-[8px] uppercase tracking-wider">Terima Dana</Typography>
                                <Typography className="text-textGray/30 text-[6px] font-bold mt-0.5">DANA MASUK</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setExpenseMode('SETORAN');
                                    setIsRecordingExpense(true);
                                    setExpenseNote('Setoran Tunai ke Akun Utama');
                                    setExpensePaymentMethod('KAS_UTAMA');

                                }}
                                className="flex-1 bg-white p-3 rounded-2xl border border-gray-100 items-center justify-center shadow-sm active:bg-gray-50"
                            >
                                <View className="w-8 h-8 bg-blue-50 rounded-xl items-center justify-center mb-2">
                                    <ArrowUpCircle size={16} color="#2563EB" />
                                </View>
                                <Typography weight="bold" className="text-blue-700 text-[8px] uppercase tracking-wider">Setoran Unit</Typography>
                                <Typography className="text-textGray/30 text-[6px] font-bold mt-0.5">SETOR KE PUSAT</Typography>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setExpenseMode('PIUTANG');
                                    setIsRecordingExpense(true);
                                    setExpenseNote('');
                                    setDebiturName('');
                                    setExpensePaymentMethod('TUNAI');
                                }}
                                className="flex-1 bg-white p-3 rounded-2xl border border-gray-100 items-center justify-center shadow-sm active:bg-gray-50"
                            >
                                <View className="w-8 h-8 bg-amber-50 rounded-xl items-center justify-center mb-2">
                                    <CircleDollarSign size={16} color="#D97706" />
                                </View>
                                <Typography weight="bold" className="text-amber-700 text-[8px] uppercase tracking-wider">Kasbon/Piutang</Typography>
                                <Typography className="text-textGray/30 text-[6px] font-bold mt-0.5">UANG KELUAR</Typography>
                            </Pressable>
                        </View>


                        <View className="flex-row items-center bg-blue-50/50 p-4 rounded-3xl border-dashed border border-blue-100">
                            {/* info icon */}
                            <View className="flex-1">
                                <Typography className="text-blue-700 text-[9px] font-black uppercase tracking-wider mb-1">Cara Menyesuaikan Saldo Tunai:</Typography>
                                <Typography className="text-blue-600/60 text-[8px] font-bold leading-tight">
                                    Gunakan tombol "Catat Biaya" untuk pengeluaran operasional (mengurangi saldo) atau "Setoran Unit" untuk setor tunai ke admin/bank.
                                </Typography>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* Expense Form View */}
            {isRecordingExpense && (
                <View>
                    <View className="flex-row items-center mb-6">
                        <Pressable
                            onPress={() => {
                                setIsRecordingExpense(false);
                                setExpenseAmount('');
                                setExpenseNote('');
                            }}
                            className="mr-3"
                        >
                            <View className="w-8 h-8 bg-gray-50 rounded-full items-center justify-center">
                                <ChevronLeft size={18} color="#6B7280" />
                            </View>
                        </Pressable>
                        <Typography variant="h3" weight="bold" className={`${expenseMode === 'KELUAR' ? 'text-rose-600' : expenseMode === 'MASUK' ? 'text-emerald-600' : expenseMode === 'PIUTANG' ? 'text-amber-600' : 'text-blue-600'} tracking-tight`}>
                            {expenseMode === 'KELUAR' ? 'Catat Biaya Operasional' : expenseMode === 'MASUK' ? 'Terima Dana (Pusat)' : expenseMode === 'PIUTANG' ? 'Pemberian Kasbon/Piutang' : 'Setoran ke Akun Utama'}
                        </Typography>

                    </View>

                    <View className="space-y-6">
                        <View>
                            <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Jumlah Nominal (Rp)</Typography>
                            <TextInput
                                placeholder="0"
                                keyboardType="numeric"
                                value={expenseAmount}
                                onChangeText={(val) => setExpenseAmount(formatNumber(val))}
                                className={`bg-gray-50 p-5 rounded-3xl text-2xl font-bold ${expenseMode === 'KELUAR' ? 'text-rose-600' : expenseMode === 'MASUK' ? 'text-emerald-600' : expenseMode === 'PIUTANG' ? 'text-amber-600' : 'text-blue-600'} border border-gray-100`}
                            />
                        </View>

                        {expenseMode === 'PIUTANG' && (
                            <>
                                <View className="flex-row items-center justify-between bg-amber-50 p-4 rounded-[24px] border border-amber-100">
                                    <View className="flex-row items-center">
                                        <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${expensePiutangType === 'KASBON' ? 'bg-amber-500' : 'bg-amber-200'}`}>
                                            <Wallet size={14} color="white" />
                                        </View>
                                        <View>
                                            <Typography variant="caption" weight="bold" className="text-amber-900">Jenis Piutang</Typography>
                                            <Typography variant="caption" className="text-amber-700/60 font-medium">Beri ke Karyawan?</Typography>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center bg-white/50 p-1 rounded-2xl border border-amber-100">
                                        <Pressable
                                            onPress={() => setExpensePiutangType('UMUM')}
                                            className={`px-4 py-2 rounded-xl ${expensePiutangType === 'UMUM' ? 'bg-amber-500 shadow-md' : ''}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={expensePiutangType === 'UMUM' ? 'text-white' : 'text-amber-700'}>Umum</Typography>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => setExpensePiutangType('KASBON')}
                                            className={`px-4 py-2 rounded-xl ${expensePiutangType === 'KASBON' ? 'bg-amber-500 shadow-md' : ''}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={expensePiutangType === 'KASBON' ? 'text-white' : 'text-amber-700'}>Kasbon</Typography>
                                        </Pressable>
                                    </View>
                                </View>

                                <View>
                                    {expensePiutangType === 'KASBON' ? (
                                        <KaryawanSelector
                                            label="Pilih Karyawan SDM"
                                            value={selectedKaryawan}
                                            onSelect={(k) => {
                                                setSelectedKaryawan(k);
                                                if (k) setDebiturName(k.nama);
                                            }}
                                            placeholder="Cari nama karyawan..."
                                        />
                                    ) : (
                                        <>
                                            <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Nama Penerima/Debitur</Typography>
                                            <TextInput
                                                placeholder="Contoh: Andi, Staff, dll..."
                                                value={debiturName}
                                                onChangeText={setDebiturName}
                                                className="bg-gray-50 p-5 rounded-3xl text-sm font-bold text-primary border border-gray-100"
                                            />
                                        </>
                                    )}
                                </View>
                            </>
                        )}


                        <View>
                            <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Keterangan / Keperluan</Typography>
                            <TextInput
                                placeholder="Contoh: Beli bensin, Aqua, dll..."
                                value={expenseNote}
                                onChangeText={setExpenseNote}
                                className="bg-gray-50 p-5 rounded-3xl text-sm font-bold text-primary border border-gray-100"
                            />
                        </View>

                        {expenseMode === 'SETORAN' && (
                            <View>
                                <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Tujuan Transfer / Mutasi</Typography>
                                <View className="flex-row flex-wrap -m-1">
                                    {[
                                        { id: 'KAS_UTAMA', label: 'Cash Utama' },
                                        { id: 'BANK_UTAMA', label: 'Bank Utama' },
                                        { id: 'KAS_UNIT_MOBIL', label: 'Unit Mobil' },
                                        { id: 'KAS_UNIT_JASA_ANGKUT', label: 'Jasa Angkut' }
                                    ].map((opt) => (
                                        <View key={opt.id} className="w-1/2 p-1">
                                            <Pressable
                                                onPress={() => setExpensePaymentMethod(opt.id)}
                                                className={`p-4 rounded-2xl border items-center justify-center ${expensePaymentMethod === opt.id
                                                    ? 'bg-blue-600 border-blue-600 shadow-sm'
                                                    : 'bg-white border-gray-100'
                                                    }`}
                                            >
                                                <Typography weight="bold" className={`text-[10px] uppercase tracking-wider ${expensePaymentMethod === opt.id ? 'text-white' : 'text-textGray'}`}>
                                                    {opt.label}
                                                </Typography>
                                            </Pressable>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}


                        {expenseMode === 'MASUK' && (
                            <View className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 border-dashed">
                                <Typography className="text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1 text-center">Sumber Dana</Typography>
                                <Typography className="text-emerald-600 text-[8px] font-bold text-center">Saldo akan ditarik dari KAS UTAMA ke Unit Bengkel</Typography>
                            </View>
                        )}

                        {expenseMode === 'KELUAR' && (
                            <View className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 border-dashed">
                                <Typography className="text-rose-800 text-[10px] font-bold uppercase tracking-wider mb-1 text-center">Sumber Saldo</Typography>
                                <Typography className="text-rose-600 text-[8px] font-bold text-center">Saldo akan dipotong otomatis dari KAS UNIT BENGKEL</Typography>
                            </View>
                        )}

                        <Button
                            title={
                                expenseMode === 'KELUAR' ? 'Catat Pengeluaran' :
                                    expenseMode === 'MASUK' ? 'Catat Penambahan' : 
                                    expenseMode === 'PIUTANG' ? 'Catat Kasbon' : 'Catat Setoran'
                            }
                            loading={createExpenseMutation.isPending || createTransactionMutation.isPending || transferMutation.isPending || createPiutangMutation.isPending}
                            onPress={async () => {
                                if (!expenseAmount || !expenseNote) {
                                    Alert.alert('Gagal', 'Mohon isi nominal dan keterangan');
                                    return;
                                }

                                try {
                                    if (expenseMode === 'KELUAR') {
                                        await createExpenseMutation.mutateAsync({
                                            tanggal: new Date().toISOString().split('T')[0],
                                            jumlah: parseNumber(expenseAmount),
                                            deskripsi: expenseNote,
                                            metode_bayar: 'TUNAI',
                                            bisnis_kategori: 'bengkel',
                                            kategori: 'BIAYA_OPERASIONAL',
                                            kas_jenis: 'KAS_UNIT_BENGKEL'
                                        });
                                    } else if (expenseMode === 'MASUK') {
                                        // TERIMA DANA (Transfer from Main to Unit)
                                        await transferMutation.mutateAsync({
                                            dari: 'KAS_UTAMA',
                                            ke: 'KAS_UNIT_BENGKEL',
                                            nominal: parseNumber(expenseAmount),
                                            tanggal: new Date().toISOString().split('T')[0],
                                            keterangan: expenseNote
                                        });
                                    } else if (expenseMode === 'PIUTANG') {
                                        // CREATE PIUTANG (Money out from Unit)
                                        await createPiutangMutation.mutateAsync({
                                            tanggal: new Date().toISOString().split('T')[0],
                                            sumber: expensePiutangType === 'KASBON' ? 'KASBON_KARYAWAN' : 'LAINNYA',
                                            unit: 'BENGKEL',
                                            nama_debitur: debiturName,
                                            referensi_id: expensePiutangType === 'KASBON' ? selectedKaryawan?.id : undefined,
                                            nominal_piutang: parseNumber(expenseAmount),
                                            metode_pembayaran: 'TUNAI',
                                            catatan: expenseNote || `Pemberian ${expensePiutangType === 'KASBON' ? 'kasbon' : 'piutang umum'} dari Unit Bengkel`,
                                            payments: [{
                                                metode: 'TUNAI',
                                                nominal: parseNumber(expenseAmount),
                                                kas_jenis: 'KAS_UNIT_BENGKEL',
                                                catatan: `Disbursement for ${expensePiutangType}`
                                            }]
                                        });
                                    } else {
                                        // SETORAN / MUTASI (Transfer from Unit to Main or other Units)
                                        await transferMutation.mutateAsync({
                                            dari: 'KAS_UNIT_BENGKEL',
                                            ke: expensePaymentMethod as any,
                                            nominal: parseNumber(expenseAmount),
                                            tanggal: new Date().toISOString().split('T')[0],
                                            keterangan: expenseNote
                                        });
                                    }


                                    setExpenseAmount('');
                                    setExpenseNote('');
                                    setDebiturName('');
                                    setIsRecordingExpense(false);
                                    setExpenseAmount('');
                                    setExpenseNote('');
                                    setSelectedKaryawan(null);
                                    handleCloseWallet();

                                    setTimeout(() => {
                                        setDialogConfig({
                                            visible: true,
                                            title: 'Sukses',
                                            message: expenseMode === 'KELUAR'
                                                ? 'Biaya operasional unit mobil berhasil dicatat'
                                                : expenseMode === 'MASUK'
                                                    ? 'Dana berhasil diterima dari akun utama'
                                                    : expenseMode === 'PIUTANG'
                                                        ? 'Pemberian kasbon/piutang unit berhasil dicatat'
                                                        : 'Setoran ke akun utama berhasil dicatat',
                                            variant: 'success',
                                            type: 'alert'
                                        });
                                    }, 400);

                                    refetch();
                                    refetchSummary();
                                } catch (e: any) {
                                    Alert.alert('Gagal', e?.response?.data?.detail || 'Gagal mencatat transaksi');
                                }
                            }}
                            className={`h-16 rounded-[28px] mt-2 ${expenseMode === 'KELUAR' ? 'bg-rose-600 shadow-rose-600/30' : expenseMode === 'MASUK' ? 'bg-emerald-600 shadow-emerald-600/30' : expenseMode === 'PIUTANG' ? 'bg-amber-600 shadow-amber-600/30' : 'bg-blue-600 shadow-blue-600/30'} shadow-xl`}
                        />

                    </View>
                </View>
            )}
            <View className="h-4" />
        </>
    );

    const renderBottomSheetContent = () => (
        <View style={{ flex: 1 }}>
            {view === 'form' || view === 'edit' ? (
                <BengkelForm
                    initialData={view === 'edit' ? selectedItem : null}
                    onSuccess={handleClosePress}
                />
            ) : selectedItem ? (
                Platform.OS === 'web' ? (
                    <ScrollView className="flex-1">
                        <View className="p-8 pb-32">
                            {renderDetailContent()}
                        </View>
                    </ScrollView>
                ) : (
                    <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        <View className="p-8 pb-32">
                            {renderDetailContent()}
                        </View>
                    </BottomSheetScrollView>
                )
            ) : null}
        </View>
    );


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header 
                title="Bengkel & POS" 
                subtitle="Manajemen Antrian & Inventori" 
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            />

            {/* Filter Search Overlay */}
            {sheetIndex === -1 && (
                <View className="px-6 -mt-6 z-1">
                    <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-col">
                        <View className="flex-row items-center">
                            <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                                <Search size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-sm font-medium text-textMain"
                                    placeholder="Cari antrian (Plat, Customer)..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor="#9CA3AF"
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    returnKeyType="search"
                                />
                                {searchQuery.length > 0 && (
                                    <Pressable onPress={() => setSearchQuery('')} className="ml-1">
                                        <X size={18} color="#9CA3AF" />
                                    </Pressable>
                                )}
                            </View>
                            <Pressable
                                onPress={() => setIsScannerOpen(true)}
                                className="ml-2 w-12 h-12 bg-blue-500 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/20"
                            >
                                <QrCode size={20} color="white" />
                            </Pressable>
                            <Pressable className="ml-2 w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
                                <Filter size={20} color="#023C69" />
                            </Pressable>
                        </View>
                        {/* Status Bayar Chips Filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-3 pt-3 border-t border-gray-100 space-x-2">
                            <Pressable
                                onPress={() => setPaymentFilter('ALL')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'ALL' ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'ALL' ? 'text-white' : 'text-gray-500'}>
                                    Semua ({stats.total})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('LUNAS')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'LUNAS' ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-50 border-emerald-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'LUNAS' ? 'text-white' : 'text-emerald-700'}>
                                    Lunas ({stats.lunas})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('PARTIAL')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'PARTIAL' ? 'bg-blue-500 border-blue-500' : 'bg-blue-50 border-blue-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'PARTIAL' ? 'text-white' : 'text-blue-700'}>
                                    Belum Lunas ({stats.partial})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('UNPAID')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'UNPAID' ? 'bg-amber-500 border-amber-500' : 'bg-amber-50 border-amber-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'UNPAID' ? 'text-white' : 'text-amber-700'}>
                                    Belum Bayar ({stats.unpaid})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('BATAL')}
                                className={`px-4 py-1.5 rounded-full border ${paymentFilter === 'BATAL' ? 'bg-rose-500 border-rose-500' : 'bg-rose-50 border-rose-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'BATAL' ? 'text-white' : 'text-rose-700'}>
                                    Batal ({stats.batal})
                                </Typography>
                            </Pressable>
                        </ScrollView>

                    </View>
                </View>
            )}

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {/* Status Pengerjaan (Metric Row) */}
                <View className="flex-row justify-between mb-8">
                    {[
                        { label: 'ANTRE', key: 'antre', color: '#F59E0B', icon: Clock },
                        { label: 'PROSES', key: 'proses', color: '#3B82F6', icon: Activity },
                        { label: 'SELESAI', key: 'selesai', color: '#10B981', icon: CheckCircle2 },
                    ].map((stat) => (
                        <View key={stat.key} style={{ width: '31%' }} className="bg-white p-3 rounded-[32px] border border-gray-100 shadow-sm items-center">
                            <View style={{ backgroundColor: stat.color + '15' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-1.5">
                                <stat.icon size={16} color={stat.color} />
                            </View>
                            <Typography weight="bold" style={{ color: stat.color }} className="text-xl leading-tight">{summary ? summary[stat.key] : 0}</Typography>
                            <Typography className="text-textGray/40 text-[7px] font-bold tracking-widest">{stat.label}</Typography>
                        </View>
                    ))}
                </View>

                {/* Service Grid Section (Bento Style) */}
                <View className="flex-row flex-wrap justify-between mb-8">
                    {/* Item 1: Wallet (Dompet Unit) */}
                    <Pressable
                        key="grid-wallet"
                        onPress={() => {
                            setShowWalletModal(true);
                            if (Platform.OS !== 'web') {
                                walletSheetRef.current?.expand();
                            }
                        }}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-emerald-500/10 border border-gray-50">
                            <Wallet size={22} color="#10B981" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Dompet</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>KAS UNIT</Typography>
                        </View>
                    </Pressable>

                    {/* Item 2: Master Data */}
                    <Pressable
                        key="grid-master-data"
                        onPress={() => {
                            try {
                                router.push('/master-data');
                            } catch (e) {
                                console.error('Nav error:', e);
                            }
                        }}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-blue-500/10 border border-gray-50">
                            <Database size={22} color="#3B82F6" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Master Data</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>KELOLA DATA</Typography>
                        </View>
                    </Pressable>

                    {/* Item 3: Inventory (Stok & Opname) */}
                    <Pressable
                        key="grid-inventory"
                        onPress={() => {
                            try {
                                router.push('/bengkel/inventory');
                            } catch (e) {
                                console.error('Nav error:', e);
                            }
                        }}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-amber-500/10 border border-gray-50">
                            <Package size={22} color="#F59E0B" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Inventori</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>STOK OPNAME</Typography>
                        </View>
                    </Pressable>

                    {/* Item 4: Absensi (Presensi Karyawan) */}
                    <Pressable
                        key="grid-absensi"
                        onPress={() => {
                            try {
                                router.push('/sdm/absensi');
                            } catch (e) {
                                console.error('Nav error:', e);
                            }
                        }}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-indigo-500/10 border border-gray-50">
                            <Clock size={22} color="#6366F1" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Absensi</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>PRESENSI SDM</Typography>
                        </View>
                    </Pressable>
                </View>

                {/* Section Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">
                            {dateRange.dari === dateRange.sampai && dateRange.dari === format(new Date(), 'yyyy-MM-dd') ? 'Antrian Hari Ini' : 'Daftar Antrian'}
                        </Typography>
                        <Typography variant="caption" className="text-textGray">Monitoring pengerjaan bengkel</Typography>
                    </View>
                </View>

                {/* Date Filter Selection */}
                <Pressable
                    onPress={() => {
                        setTempDateRange(dateRange);
                        setIsDateModalVisible(true);
                        if (Platform.OS !== 'web') {
                            dateSheetRef.current?.expand();
                        }
                    }}
                    className="flex-row items-center justify-between mb-8 bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 active:bg-gray-50"
                >
                    <View className="flex-row items-center">
                        <Calendar size={18} color="#023C69" />
                        <Typography className="text-gray-800 text-xs font-bold ml-3">{dateRange.dari} s/d {dateRange.sampai}</Typography>
                    </View>
                    <View className="bg-primary/5 px-2 py-1 rounded-lg">
                        <Typography className="text-primary text-[10px] font-bold">Ubah Periode</Typography>
                    </View>
                </Pressable>

                {/* Unpaid Info Pills */}
                {summary && summary.piutang_count > 0 ? (
                    <View className="flex-row space-x-2 mb-6">
                        <View className="bg-rose-50 px-4 py-2.5 rounded-2xl border border-rose-100 flex-row items-center shadow-sm">
                            <AlertCircle size={16} color="#E11D48" />
                            <Typography variant="caption" weight="bold" className="text-rose-600 ml-2">
                                {summary.piutang_count} Order Belum Lunas
                            </Typography>
                        </View>
                        <View className="bg-rose-50 px-4 py-2.5 rounded-2xl border border-rose-100 flex-row items-center shadow-sm">
                            <Typography variant="caption" weight="bold" className="text-rose-600">
                                Total: {formatCurrency(summary.piutang_nilai)}
                            </Typography>
                        </View>
                    </View>
                ) : null}

                {/* Queue List */}
                {isLoading ? (
                    <View className="space-y-4">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </View>
                ) : queue.length === 0 ? (
                    <EmptyState
                        title="Antrian Masih Kosong"
                        description="Klik tombol '+' di bawah untuk menambah antrian baru."
                        icon={Wrench}
                    />
                ) : filteredQueue.length === 0 ? (
                    <EmptyState
                        title="Tidak Ditemukan"
                        description={`Tidak ada antrian yang cocok dengan "${searchQuery}"`}
                        icon={Search}
                    />
                ) : (
                    filteredQueue.map((item: any) => (
                        <Pressable
                            key={item.id}
                            onPress={() => handlePresentModalPress('detail', item)}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            <View className="w-16 h-16 bg-emerald-50 rounded-[20px] items-center justify-center mr-4 border border-emerald-100/50">
                                <Typography weight="bold" className="text-primary text-[10px] uppercase tracking-tighter">
                                    {item.nomor_plat?.split(' ')[0] || '-'}
                                </Typography>
                                <Typography weight="bold" className="text-primary/40 text-[8px] mt-0.5">
                                    KENDARAAN
                                </Typography>
                            </View>

                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-2">
                                    <Typography variant="body1" weight="bold" className="text-textMain text-lg tracking-tight">
                                        {item.nomor_plat}
                                    </Typography>
                                    <View className="flex-row items-center space-x-2">
                                        {/* Category Badge */}
                                        {item.kategori === 'jasa_angkut' && (
                                            <View className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 flex-row items-center">
                                                <Truck size={8} color="#10B981" />
                                                <Typography weight="bold" className="text-emerald-600 text-[7px] uppercase tracking-tighter ml-0.5">ANGKUT</Typography>
                                            </View>
                                        )}
                                        {item.kategori === 'jual_beli_mobil' && (
                                            <View className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 flex-row items-center">
                                                <Car size={8} color="#3B82F6" />
                                                <Typography weight="bold" className="text-blue-600 text-[7px] uppercase tracking-tighter ml-0.5">MOBIL</Typography>
                                            </View>
                                        )}
                                        {item.status_bayar !== 'lunas' && item.status_bayar !== 'LUNAS' ? (
                                            item.metode_bayar === 'INTERNAL' || item.metode_bayar === 'internal' ? (
                                                <View className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100">
                                                    <Typography weight="bold" className="text-amber-600 text-[7px] uppercase tracking-tighter">IKUT ANGKUT</Typography>
                                                </View>
                                            ) : (
                                                <View className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100">
                                                    <Typography weight="bold" className="text-rose-500 text-[7px] uppercase tracking-tighter">BELUM LUNAS</Typography>
                                                </View>
                                            )
                                        ) : null}
                                        <View className={`px-2.5 py-1 rounded-full ${item.status_pengerjaan === 'proses' ? 'bg-blue-50' :
                                            item.status_pengerjaan === 'selesai' ? 'bg-emerald-50' : 'bg-amber-50'
                                            }`}>
                                            <Typography variant="caption" weight="bold" className={`uppercase text-[8px] tracking-widest ${item.status_pengerjaan === 'proses' ? 'text-blue-500' :
                                                item.status_pengerjaan === 'selesai' ? 'text-emerald-500' : 'text-amber-500'
                                                }`}>
                                                {item.status_pengerjaan}
                                            </Typography>
                                        </View>
                                    </View>
                                </View>

                                <Typography variant="caption" className="text-textGray font-medium flex-row items-center">
                                    {item.jenis_kendaraan} • {item.nama_customer || 'Umum'}
                                    {item.metode_bayar && item.metode_bayar !== 'KREDIT' && (
                                        <Typography variant="caption" className={`font-black ${item.metode_bayar === 'TRANSFER' ? 'text-blue-600' : 'text-emerald-600'} text-[9px] uppercase tracking-widest ml-1`}>
                                            • {item.metode_bayar}
                                        </Typography>
                                    )}
                                </Typography>

                                <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50/50">
                                    <Clock size={12} color="#9CA3AF" />
                                    <Typography variant="caption" className="ml-1.5 text-textGray/60 font-medium">
                                        {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: localeID }) : '-'}
                                    </Typography>
                                    <View className="flex-row items-center ml-auto">
                                        {item.grand_total > 0 && (
                                            <Typography weight="bold" className="text-primary text-xs mr-3">
                                                {formatCurrency(item.grand_total)}
                                            </Typography>
                                        )}
                                        {item.status_bayar !== 'lunas' && item.status_bayar !== 'LUNAS' &&
                                            item.status_bayar !== 'batal' && item.status_bayar !== 'BATAL' && (
                                                <Pressable
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handlePresentModalPress('edit', item);
                                                    }}
                                                    className="w-8 h-8 bg-primary/5 rounded-full items-center justify-center border border-primary/10"
                                                >
                                                    <Edit2 size={14} color="#023C69" />
                                                </Pressable>
                                            )}

                                    </View>
                                </View>

                            </View>
                        </Pressable>
                    ))
                )}
                <View className="h-32" />
            </ScrollView>


            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <Modal visible={sheetIndex !== -1} transparent animationType="slide" onRequestClose={handleClosePress}>
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClosePress} />
                        <View className="bg-white rounded-t-[48px] shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: 640, height: '85%', alignSelf: 'center' }}>
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            {renderBottomSheetContent()}
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={sheetIndex}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onChange={setSheetIndex}
                >
                    {renderBottomSheetContent()}
                </BottomSheet>
            )}

            {/* Floating Action Button (Design System) - Rendered last with high zIndex to ensure clickability on Android */}
            <View style={{ position: 'absolute', bottom: 40, right: 24, zIndex: 999 }}>
                <Pressable
                    onPress={() => handlePresentModalPress('form')}
                    className="w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20 active:scale-95 transition-transform"
                >
                    <Plus size={32} color="white" strokeWidth={2.5} />
                </Pressable>
            </View>

            {/* Date Selection Modal (Hybrid) */}
            {Platform.OS === 'web' ? (
                <Modal visible={isDateModalVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/50 justify-center items-center p-6">
                        <View className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h2" weight="bold">Pilih Periode</Typography>
                                <Pressable onPress={() => setIsDateModalVisible(false)}>
                                    <X size={24} color="#6B7280" />
                                </Pressable>
                            </View>
                            {renderDateContent()}
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={dateSheetRef}
                    index={-1}
                    snapPoints={dateSnapPoints}
                    enablePanDownToClose
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onClose={() => setIsDateModalVisible(false)}
                >
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <View className="px-8 py-2">
                            <Typography variant="h2" weight="bold" className="mb-6">Pilih Periode</Typography>
                            {renderDateContent()}
                        </View>
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            <BarcodeScannerModal
                visible={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanBarcode}
            />


            {/* Payment Modal (Settlement/Installment) */}
            {selectedItem && (
                <PaymentModal
                    visible={paymentModalVisible}
                    onClose={() => setPaymentModalVisible(false)}
                    onSuccess={() => {
                        setPaymentModalVisible(false);
                        handleClosePress();
                        setTimeout(() => {
                            setDialogConfig({
                                visible: true,
                                title: 'Sukses',
                                message: 'Pembayaran cicilan berhasil dicatat',
                                variant: 'success',
                                type: 'alert'
                            });
                        }, 400);
                        refetch();
                        refetchSummary();
                    }}
                    id={selectedItem.piutang_id}
                    initialAmount={Number(selectedItem.grand_total) - Number(selectedItem.jumlah_bayar || 0)}
                    type="piutang"
                />
            )}
            {/* Wallet Modal (Unit Level) - Hybrid: Modal on web, BottomSheet on mobile */}
            {Platform.OS === 'web' ? (
                <Modal
                    visible={showWalletModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowWalletModal(false)}
                >
                    <View className="flex-1 justify-end bg-black/60">
                        <Pressable
                            className="flex-1"
                            onPress={() => setShowWalletModal(false)}
                        />
                        <View className="bg-white rounded-t-[48px] pt-16 px-9 pb-12 shadow-2xl relative" style={{ maxWidth: 640, alignSelf: 'center', width: '100%' }}>
                            {renderWalletContent()}
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={walletSheetRef}
                    index={-1}
                    snapPoints={walletSnapPoints}
                    enablePanDownToClose
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onChange={(idx) => {
                        if (idx === -1) {
                            setShowWalletModal(false);
                            setIsRecordingExpense(false);
                            setExpenseAmount('');
                            setExpenseNote('');
                        }
                    }}
                >
                    {showWalletModal && (
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            <View className="px-9 py-4 pb-12">
                                {renderWalletContent()}
                            </View>
                        </BottomSheetScrollView>
                    )}
                </BottomSheet>
            )}
            {/* Full History Modal */}
            <Modal
                visible={showHistoryModal}
                animationType="slide"
                onRequestClose={() => setShowHistoryModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, flex: 1 }}>
                        <View className="items-center mb-2">
                            <View className="w-10 h-1 bg-gray-300 rounded-full" />
                        </View>

                        <View className="flex-row justify-between items-center mb-6">
                            <Typography variant="h2" weight="bold">History Lengkap</Typography>
                            <Pressable onPress={() => setShowHistoryModal(false)} hitSlop={12}>
                                <View className="w-8 h-8 bg-gray-50 rounded-full items-center justify-center">
                                    <X size={18} color="#6B7280" />
                                </View>
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="space-y-4">
                                {historyData?.data?.map((item: any) => (
                                    <View key={item.id} className="bg-gray-50/50 p-5 rounded-[32px] border border-gray-100 flex-row items-center">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.tipe === 'MASUK' ? 'bg-emerald-100' : 'bg-rose-100'
                                            }`}>
                                            {item.tipe === 'MASUK' ? (
                                                <TrendingUp size={24} color="#059669" />
                                            ) : (
                                                <TrendingDown size={24} color="#DC2626" />
                                            )}
                                        </View>
                                        <View className="flex-1">
                                            <Typography weight="bold" className="text-textMain text-base">{item.keterangan || item.sumber}</Typography>
                                            <Typography variant="caption" className="text-textGray/60 mt-0.5">{format(new Date(item.tanggal), 'EEEE, dd MMMM yyyy', { locale: localeID })}</Typography>
                                            <View className="flex-row mt-2">
                                                <Badge label={item.metode_pembayaran || 'TUNAI'} variant="neutral" />
                                                <View className="w-2" />
                                                <Badge label={item.sumber} variant="info" />
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Typography weight="bold" className={`text-lg ${item.tipe === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'
                                                }`}>
                                                {item.tipe === 'MASUK' ? '+' : '-'}{formatCurrency(item.nominal)}
                                            </Typography>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            <AlertDialogComponent
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                loading={dialogConfig.loading}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
            />
        </View>
    );
}
