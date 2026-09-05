import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, Platform, Modal, TextInput, RefreshControl as RNRefreshControl, Share } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PendingSyncBadge, isPendingSyncRow } from '../../components/ui/PendingSyncBadge';
import { Button } from '../../components/ui/Button';
import { BoundedSheetPanel, BoundedSheetScrollView } from '../../components/ui/BottomSheetContainer';
import {
    ChevronLeft,
    Plus,
    Search,
    Filter,
    Calendar,
    Wrench,
    Settings,
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
    Edit2,
    QrCode,
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingDown,
    TrendingUp,
    CircleDollarSign,
    Boxes,
    ShoppingCart,
    History,
    CreditCard
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { PaymentModal } from '../../components/PaymentModal';
import { BarcodeScannerModal } from '../../components/ui/BarcodeScannerModal';
import { useTransaksiBengkelList, useTransaksiBengkelSummary, useUpdateTransaksiBengkelStatus, useUpdateTransaksiBengkelPayment, useVoidTransaksiBengkel, useCreatePengeluaran } from '../../hooks/useBengkel';
import { useMobilList } from '../../hooks/useMobil';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDistanceToNow, format, isValid, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { printReceipt, saveReceiptPDF, PrintReceiptData } from '../../utils/printReceipt';
import { buildBengkelPrintData } from '../../utils/buildPrintReceiptData';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import {
    buildSoldMobilIdSet,
    formatBengkelWorkStatusLabel,
    getBengkelQueuePaymentStatus,
    isBengkelTransactionLocked,
    isSoldJbmWorkshopItem,
} from '../../utils/bengkelTransaction';
import { useKasBankBalances, useCreateTransaction, useTransfer, useKasBankList, useCreatePiutang, useHutangList, usePiutangList } from '../../hooks/useKeuangan';
import { useAuthStore } from '../../store/useAuthStore';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

import { AlertDialog as AlertDialogComponent } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { FILE_URL } from '../../utils/api';
import {
    buildPublicReceiptShareUrl,
    sharePublicReceiptLink,
} from '../../utils/sharePublicReceipt';
import { KaryawanSelector } from '../../components/ui/KaryawanSelector';
import { Karyawan } from '../../services/sdm';
import { Header } from '../../components/ui/Header';
import { useDeferredReady } from '../../hooks/useDeferredReady';
/** Lightweight menu card — no Reanimated (was stalling first paint). */
const BengkelServiceCard = React.memo(function BengkelServiceCard({
    menu,
    onPress,
}: {
    menu: any;
    index?: number;
    onPress: () => void;
}) {
    const Icon = menu.icon;
    return (
        <View style={{ width: '25%' }} className="items-center mb-5 px-1">
            <Pressable onPress={onPress} className="items-center w-full active:opacity-70">
                <View
                    style={{ backgroundColor: 'white', borderRadius: 20 }}
                    className="w-14 h-14 items-center justify-center mb-1.5 border border-gray-100 shadow-sm"
                >
                    <View
                        style={{ backgroundColor: `${menu.color}15` }}
                        className="w-10 h-10 rounded-xl items-center justify-center"
                    >
                        <Icon size={22} color={menu.color} strokeWidth={2} />
                    </View>
                </View>
                <Typography
                    variant="caption"
                    weight="bold"
                    className="text-gray-600 text-[9px] uppercase tracking-tighter text-center"
                    numberOfLines={2}
                >
                    {menu.title}
                </Typography>
            </Pressable>
        </View>
    );
});

export default function BengkelScreen() {

    const { action } = useLocalSearchParams<{ action?: string }>();
    const user = useAuthStore(state => state.user);
    const bengkelMenus = useMemo(() => ([
        {
            id: 'sparepart',
            title: 'Sparepart',
            description: 'Transaksi khusus part',
            icon: Package,
            color: '#059669',
            route: { pathname: '/bengkel/transaksi', params: { mode: 'sparepart' } }
        },
        {
            id: 'servis',
            title: 'Servis',
            description: 'Transaksi jasa servis',
            icon: Settings,
            color: '#0F766E',
            route: { pathname: '/bengkel/transaksi', params: { mode: 'servis' } }
        },
        {
            id: 'wallet',
            title: 'Dompet',
            description: 'Kas dan saldo unit',
            icon: Wallet,
            color: '#2563EB',
            action: 'wallet'
        },
        {
            id: 'inventory',
            title: 'Inventory',
            description: 'Stok dan barang bengkel',
            icon: Boxes,
            color: '#2563EB',
            route: '/bengkel/inventory'
        },
        {
            id: 'master-data',
            title: 'Master Data',
            description: 'Kelola data referensi',
            icon: Database,
            color: '#7C3AED',
            route: '/master-data'
        },
        {
            id: 'absensi',
            title: 'Absensi',
            description: 'Presensi tim bengkel',
            icon: Clock,
            color: '#EA580C',
            route: '/sdm/absensi'
        },
        {
            id: 'queue',
            title: 'Transaksi',
            description: 'Lihat transaksi hari ini',
            icon: History,
            color: '#059669',
            route: '/bengkel/queue'
        }
    ]), []);

    // Search & Filter State kept for compatibility with hidden legacy sections.
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'LUNAS' | 'PARTIAL' | 'UNPAID' | 'BATAL'>('ALL');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Filters
    const [dateRange, setDateRange] = useState({
        dari: format(new Date(), 'yyyy-MM-dd'),
        sampai: format(new Date(), 'yyyy-MM-dd')
    });
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [tempDateRange, setTempDateRange] = useState({ ...dateRange });
    const dateSheetRef = useRef<BottomSheet>(null);
    const dateSnapPoints = useMemo(() => ['50%', '70%'], []);

    // Phase paint: shell first → data after interactions → sheets last
    const dataReady = useDeferredReady(0);
    const secondaryReady = useDeferredReady(120);
    const sheetsReady = useDeferredReady(200);

    const [selectedItem, setSelectedItem] = React.useState<any | null>(null);
    const [view, setView] = React.useState<'form' | 'detail' | 'edit'>('form');
    const [refreshing, setRefreshing] = React.useState(false);
    const [sheetIndex, setSheetIndex] = React.useState(-1);
    const [queueSheetIndex, setQueueSheetIndex] = React.useState(-1);
    const [queuePaymentFilter, setQueuePaymentFilter] = React.useState<'ALL' | 'LUNAS' | 'BELUM_LUNAS' | 'BELUM_BAYAR' | 'BATAL'>('ALL');
    const [queueWorkStatusFilter, setQueueWorkStatusFilter] = React.useState<'ALL' | 'antre' | 'proses' | 'selesai'>('ALL');
    const [queueSearchOpen, setQueueSearchOpen] = React.useState(false);
    const [queueSearchQuery, setQueueSearchQuery] = React.useState('');
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
    const [walletView, setWalletView] = React.useState<'main' | 'expense' | 'hutang' | 'piutang'>('main');
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

    const walletDataEnabled = secondaryReady || showWalletModal || showHistoryModal;

    const { data: queueData, isLoading, refetch } = useTransaksiBengkelList({
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        enabled: dataReady,
    });

    const { data: summary, refetch: refetchSummary } = useTransaksiBengkelSummary({
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        enabled: dataReady,
    });

    // Intentionally no force-refetch on focus: RQ cache + mutations/WS keep data
    // fresh. Pull-to-refresh still calls refetch.

    const { data: historyData, isLoading: isHistoryLoading } = useKasBankList({
        jenis: 'KAS_UNIT_BENGKEL',
        limit: 20,
        sort_by: 'tanggal',
        sort_order: 'desc',
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        enabled: walletDataEnabled,
    });

    const updateStatsMutation = useUpdateTransaksiBengkelStatus();
    const voidMutation = useVoidTransaksiBengkel();

    const createPiutangMutation = useCreatePiutang();
    const { data: hutangData } = useHutangList({
        limit: 20,
        status: 'BELUM_LUNAS',
        unit: 'BENGKEL',
        sort_by: 'tanggal',
        sort_order: 'desc',
    }, { enabled: walletDataEnabled });
    const { data: piutangData } = usePiutangList({
        limit: 20,
        status: 'BELUM_LUNAS',
        unit: 'BENGKEL',
        sort_by: 'tanggal',
        sort_order: 'desc',
    }, { enabled: walletDataEnabled });
    const { data: balances } = useKasBankBalances({ enabled: dataReady });
    const unitBalance = balances?.kas_unit_bengkel?.saldo || 0;
    const bengkelHutangList = useMemo(() => (hutangData?.data || []).filter((item: any) => item.unit === 'BENGKEL'), [hutangData]);
    // Sold cars needed for queue payment status — defer slightly so first paint is faster
    const { data: mobilData } = useMobilList(
        { status: 'TERJUAL', limit: 500 },
        { enabled: secondaryReady }
    );
    const soldCars = useMemo(() => buildSoldMobilIdSet(mobilData?.data), [mobilData]);
    const soldCarPlates = useMemo(() => {
        const plates = new Set<string>();
        (mobilData?.data || []).forEach((mobil: any) => {
            if (mobil?.nomor_plat) {
                plates.add(String(mobil.nomor_plat).replace(/\s+/g, '').toUpperCase());
            }
        });
        return plates;
    }, [mobilData]);
    const bengkelPiutangList = useMemo(() => {
        return (piutangData?.data || []).filter((item: any) => {
            if (item.unit !== 'BENGKEL') return false;
            const debitur = String(item.nama_debitur || '').toUpperCase();
            if (debitur.startsWith('JB MOBIL - ')) {
                const plate = debitur.replace('JB MOBIL - ', '').replace(/\s+/g, '');
                if (soldCarPlates.has(plate)) return false;
            }
            return true;
        });
    }, [piutangData, soldCarPlates]);

    const queue = queueData?.data || [];
    const todayQueue = queue;
    const getQueuePaymentStatus = useCallback((item: any) => {
        return getBengkelQueuePaymentStatus(item, soldCars);
    }, [soldCars]);
    const queuePaymentStats = useMemo(() => {
        return todayQueue.reduce((acc: any, item: any) => {
            const status = getQueuePaymentStatus(item);
            acc.total += 1;
            acc[status] += 1;
            return acc;
        }, { total: 0, LUNAS: 0, BELUM_LUNAS: 0, BELUM_BAYAR: 0, BATAL: 0, INTERNAL: 0 });
    }, [getQueuePaymentStatus, todayQueue]);
    const queueWorkStatusStats = useMemo(() => {
        return todayQueue.reduce((acc: any, item: any) => {
            const status = String(item.status_pengerjaan || 'antre').toLowerCase();
            acc.total += 1;
            if (status === 'proses') acc.proses += 1;
            else if (status === 'selesai') acc.selesai += 1;
            else acc.antre += 1;
            return acc;
        }, { total: 0, antre: 0, proses: 0, selesai: 0 });
    }, [todayQueue]);
    const queueSheetItems = useMemo(() => {
        return todayQueue.filter((item: any) => {
            const matchesPayment = queuePaymentFilter === 'ALL' || getQueuePaymentStatus(item) === queuePaymentFilter;
            const workStatus = String(item.status_pengerjaan || 'antre').toLowerCase();
            const matchesWorkStatus = queueWorkStatusFilter === 'ALL' || workStatus === queueWorkStatusFilter;
            const q = queueSearchQuery.trim().toLowerCase();
            const matchesSearch = !q || [
                item.nomor_transaksi,
                item.nomor_plat,
                item.nama_customer,
                item.customer_nama,
                item.jenis_kendaraan,
            ].some((value) => String(value || '').toLowerCase().includes(q));
            return matchesPayment && matchesWorkStatus && matchesSearch;
        });
    }, [getQueuePaymentStatus, queuePaymentFilter, queueSearchQuery, queueWorkStatusFilter, todayQueue]);
    const filteredQueue = todayQueue;

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
            const status = getBengkelQueuePaymentStatus(item, soldCars);
            if (status === 'INTERNAL') return;
            if (status === 'LUNAS') lunas++;
            else if (status === 'BATAL') batal++;
            else if (status === 'BELUM_LUNAS') partial++;
            else unpaid++;
        });
        return { total: lunas + partial + unpaid + batal, lunas, partial, unpaid, batal };
    }, [queue, summary, soldCars]);

    const loadPrintSettings = async () => {
        try {
            const settings = await printSettingsService.getSettings();
            setPrintSettings(settings);
            return settings;
        } catch (error) {
            console.error('Failed to load print settings:', error);
            return null;
        }
    };

    const handlePrintReceipt = async (item: any) => {
        const settings = printSettings || (await loadPrintSettings());
        if (!settings) {
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

            const latestSettings = await printSettingsService.getSettings();
            setPrintSettings(latestSettings);
            await printReceipt(buildBengkelPrintData(item), latestSettings);

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
        const settings = printSettings || (await loadPrintSettings());
        if (!settings) {
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

            await saveReceiptPDF(buildBengkelPrintData(item), settings);

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
        const receiptToken = item.public_receipt_token;
        if (!receiptToken) {
            setDialogConfig({
                visible: true,
                title: 'Token Tidak Tersedia',
                message: 'Token struk publik belum tersedia untuk transaksi ini. Jalankan migrasi database lalu muat ulang data.',
                variant: 'error',
                type: 'alert'
            });
            return;
        }

        try {
            const shareUrl = await buildPublicReceiptShareUrl('bengkel', receiptToken);
            const result = await sharePublicReceiptLink({
                shareUrl,
                transactionNumber: item.nomor_transaksi,
                receiptType: 'bengkel',
                receiptId: receiptToken,
                onCopied: () => {
                    setDialogConfig({
                        visible: true,
                        title: 'Berhasil',
                        message: Platform.OS === 'web'
                            ? 'Link disalin. Gambar struk diunduh bila tersedia — lampirkan manual di chat.'
                            : 'Link struk telah disalin ke clipboard.',
                        variant: 'success',
                        type: 'alert',
                    });
                },
                onShared: () => {
                    setDialogConfig({
                        visible: true,
                        title: 'Berhasil',
                        message: 'Struk berhasil dibagikan.',
                        variant: 'success',
                        type: 'alert',
                    });
                },
            });
            if (result === 'cancelled') return;
        } catch (error: any) {
            console.error('Error sharing link:', error);
            setDialogConfig({
                visible: true,
                title: 'Gagal',
                message: getErrorMessage(error, 'Gagal membagikan link struk'),
                variant: 'error',
                type: 'alert',
            });
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

    const handlePrintOrderSlip = async (item: any) => {
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

            const orderSlipData: PrintReceiptData = {
                ...buildBengkelPrintData(item),
                paid: 0,
                paymentMethod: 'ORDER SLIP',
            };

            const latestOrderSettings = await printSettingsService.getSettings();
            setPrintSettings(latestOrderSettings);
            await printReceipt(orderSlipData, latestOrderSettings);

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Order Slip berhasil dicetak',
                variant: 'success',
                type: 'alert',
                onConfirm: undefined
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal mencetak Order Slip'),
                variant: 'error',
                type: 'alert',
                onConfirm: undefined
            });
        } finally {
            setPrinting(false);
        }
    };

    const handleMenuPress = useCallback((menu: typeof bengkelMenus[number]) => {
        if ((menu as any).action === 'wallet') {
            setShowWalletModal(true);
            if (Platform.OS !== 'web') {
                requestAnimationFrame(() => walletSheetRef.current?.expand());
            }
            return;
        }
        router.push(menu.route as any);
    }, [bengkelMenus]);

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const walletSheetRef = useRef<BottomSheet>(null);
    const walletSnapPoints = useMemo(() => ['85%', '95%'], []);

    const queueSheetRef = useRef<BottomSheet>(null);
    const queueSnapPoints = useMemo(() => ['78%', '92%'], []);

    const handlePresentModalPress = (type: 'form' | 'detail' | 'edit', item?: any) => {
        setView(type);
        if (item) setSelectedItem(item);
        else if (type === 'form') setSelectedItem(null);

        if (Platform.OS === 'web') {
            setSheetIndex(0);
        } else {
            setSheetIndex(0);
            requestAnimationFrame(() => bottomSheetRef.current?.snapToIndex(0));
        }
    };

    React.useEffect(() => {
        if (action === 'new-order' || action === 'form') {
            router.push('/bengkel/order');
        } else if (action === 'wallet' || action === 'dompet') {
            const timer = setTimeout(() => {
                if (Platform.OS === 'web') {
                    setShowWalletModal(true);
                } else {
                    setShowWalletModal(true);
                    requestAnimationFrame(() => walletSheetRef.current?.expand());
                }
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [action]);

    const handleClosePress = useCallback(() => {
        setSheetIndex(-1);
        setSelectedItem(null);
        router.setParams({ action: undefined } as any);
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
            appAlert('Kesalahan', 'Format tanggal tidak valid (Gunakan YYYY-MM-DD)');
            return;
        }

        setDateRange(tempDateRange);
        setIsDateModalVisible(false);
        if (Platform.OS !== 'web') {
            dateSheetRef.current?.close();
        }
    };

    const handleScanBarcode = (data: string): boolean => {
        setSearchQuery(data);
        setIsScannerOpen(false);
        return true;
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

    const handleSettleSelectedOrder = () => {
        if (!selectedItem) return;
        if (selectedItem.piutang_id) {
            setPaymentModalVisible(true);
            return;
        }

        handleClosePress();
        router.push({
            pathname: '/bengkel/transaksi',
            params: { transactionId: String(selectedItem.id), mode: 'all', action: 'payment' }
        } as any);
    };

    const renderDetailContent = () => {
        if (!selectedItem) return null;
        const detailServices = selectedItem.detail_services || [];
        const detailParts = selectedItem.detail_parts || [];
        const hasDetails = detailServices.length > 0 || detailParts.length > 0;
        const outstanding = Math.max((selectedItem.grand_total || 0) - (selectedItem.jumlah_bayar || 0), 0);
        const paymentStatus = getBengkelQueuePaymentStatus(selectedItem, soldCars);
        const isPaid = paymentStatus === 'LUNAS';
        const isSoldJbm = isSoldJbmWorkshopItem(selectedItem, soldCars);
        const isVoided = selectedItem.status_bayar === 'batal' || selectedItem.status_bayar === 'BATAL';
        const isLocked = isBengkelTransactionLocked(selectedItem);
        const isInternalPayment = paymentStatus === 'INTERNAL';
        const canSettlePayment = !isInternalPayment && !isPaid && !isVoided && outstanding > 0;
        return (
            <>
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1 mr-3">
                        <Typography variant="caption" weight="bold" className="text-primary uppercase tracking-widest mb-1">Rincian Order</Typography>
                        <Typography variant="h2" weight="bold" className="text-xl tracking-tight" numberOfLines={1}>{selectedItem.nomor_plat}</Typography>
                        <Typography variant="caption" className="text-textGray mt-0.5" numberOfLines={1}>
                            {selectedItem.jenis_kendaraan} - {selectedItem.nama_customer || 'Umum'}
                        </Typography>
                    </View>
                    <View className="items-end">
                        <Pressable
                            onPress={() => handlePrintOrderSlip(selectedItem)}
                            disabled={printing}
                            className="bg-primary/10 rounded-full p-2 mb-2 border border-primary/20"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Printer size={16} color="#023C69" />
                        </Pressable>
                        <Badge
                            label={formatBengkelWorkStatusLabel(selectedItem.status_pengerjaan)}
                            variant={
                                selectedItem.status_pengerjaan === 'proses' ? 'info' :
                                    selectedItem.status_pengerjaan === 'selesai' ? 'success' :
                                        selectedItem.status_pengerjaan === 'batal' ? 'error' : 'warning'
                            }
                        />
                        <Typography weight="bold" className="text-primary text-sm mt-2">
                            {formatCurrency(selectedItem.grand_total || 0)}
                        </Typography>
                    </View>
                </View>

                {/* Category Info */}
                {selectedItem.kategori && selectedItem.kategori !== 'umum' && (
                    <View className={`flex-row items-center mb-3 px-3 py-2 rounded-xl border ${selectedItem.kategori === 'jasa_angkut'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-blue-50 border-blue-200'
                        }`}>
                        {selectedItem.kategori === 'jasa_angkut' ? (
                            <Truck size={14} color="#10B981" />
                        ) : (
                            <Car size={14} color="#3B82F6" />
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

                <Card variant="outlined" className="p-4 border-gray-100 mb-4 bg-gray-50/60 rounded-2xl">
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center">
                            <Receipt size={15} color="#023C69" />
                            <Typography variant="caption" weight="bold" className="ml-2 text-primary uppercase tracking-widest">Item Order</Typography>
                        </View>
                        <Typography variant="caption" className="text-textGray">{detailServices.length + detailParts.length} baris</Typography>
                    </View>

                    {detailServices.map((s: any, idx: number) => (
                        <View key={`svc-${idx}`} className="flex-row justify-between items-center py-1.5 border-t border-gray-100">
                            <View className="flex-1 mr-3">
                                <Typography variant="body2" weight="semibold" className="text-textMain" numberOfLines={1}>{s.nama_jasa}</Typography>
                                <Typography variant="caption" className="text-textGray/70">Jasa</Typography>
                            </View>
                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(s.harga)}</Typography>
                        </View>
                    ))}

                    {detailParts.map((p: any, idx: number) => (
                        <View key={`part-${idx}`} className="flex-row justify-between items-center py-1.5 border-t border-gray-100">
                            <View className="flex-1 mr-3">
                                <Typography variant="body2" weight="semibold" className="text-textMain" numberOfLines={1}>
                                    {p.spare_part_nama || p.spare_part?.nama || 'Sparepart'}
                                </Typography>
                                <Typography variant="caption" className="text-textGray/70">Part x{formatNumber(p.qty || 0)}</Typography>
                            </View>
                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(p.subtotal || 0)}</Typography>
                        </View>
                    ))}

                    {!hasDetails ? (
                        <Typography variant="body2" className="py-3 text-gray-400 italic">Tidak ada item rincian</Typography>
                    ) : null}

                    {selectedItem.catatan ? (
                        <View className="mt-2 pt-3 border-t border-gray-100">
                            <Typography variant="caption" className="text-gray-400 mb-1">Catatan</Typography>
                            <Typography variant="body2" className="italic text-textMain" numberOfLines={3}>{selectedItem.catatan}</Typography>
                        </View>
                    ) : null}

                    <View className="h-[1px] bg-gray-200 my-3" />

                    <View className="space-y-0.5 mb-1">
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

                    <View className="h-[1px] bg-gray-200 my-3" />
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1 mr-3">
                            <Typography variant="caption" className="text-textGray uppercase tracking-widest font-bold">Total</Typography>
                            {selectedItem.metode_bayar === 'INTERNAL' ? (
                                isPaid ? (
                                    <Typography variant="caption" className="text-emerald-600 font-bold">
                                        Lunas - Potong Laba TPM
                                    </Typography>
                                ) : (
                                    <Typography variant="caption" className="text-amber-600 font-bold">
                                        Menunggu Pelunasan Jasa Angkut
                                    </Typography>
                                )
                            ) : selectedItem.kategori === 'jual_beli_mobil' && selectedItem.mobil_id ? (
                                isSoldJbm || isPaid ? (
                                    <Typography variant="caption" className="text-emerald-600 font-bold">
                                        Lunas - Terlunasi saat unit terjual
                                    </Typography>
                                ) : (
                                    <Typography variant="caption" className="text-orange-600 font-bold">
                                        Hutang Unit - Dibayar saat Terjual
                                    </Typography>
                                )
                            ) : outstanding > 0 && (
                                <Typography variant="caption" className="text-rose-600 font-bold">
                                    Sisa: {formatCurrency(outstanding)}
                                </Typography>
                            )}
                        </View>
                        <Typography variant="h3" weight="bold" className="text-primary">
                            {formatCurrency(selectedItem.grand_total || 0)}
                        </Typography>
                    </View>

                    {canSettlePayment && (
                        <Pressable
                            onPress={handleSettleSelectedOrder}
                            className="mt-3 bg-primary/10 py-3 rounded-xl flex-row items-center justify-center border border-primary/20"
                        >
                            <Banknote size={17} color="#023C69" />
                            <Typography weight="bold" className="text-primary ml-2 uppercase tracking-widest text-xs">Pelunasan / Bayar Cicilan</Typography>
                        </Pressable>
                    )}
                </Card>

                {/* Status Update Section */}
                <View className="mb-4 mt-1">
                    <Typography variant="caption" weight="bold" className="mb-2 text-textGray uppercase tracking-widest px-1">Status Pengerjaan</Typography>
                    <View className="flex-row items-center space-x-2">
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
                                    className={`flex-1 py-3 rounded-xl border items-center justify-center ${isActive ? 'shadow-sm' : 'bg-white border-gray-100'}`}
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
                <View className="flex-row flex-wrap -mx-1">
                    {!isVoided && !isLocked && (
                        <View className="w-1/2 px-1 mb-2">
                            <Button
                                variant="secondary"
                                title="Edit"
                                onPress={() => openEditTransaction(selectedItem)}
                                icon={<Edit2 size={17} color="white" />}
                                className="rounded-xl h-12 bg-amber-500"
                            />
                        </View>
                    )}
                    <View className="w-1/2 px-1 mb-2">
                        <Button
                            variant="primary"
                            title="Cetak"
                            onPress={() => handlePrintReceipt(selectedItem)}
                            loading={printing}
                            icon={<Printer size={17} color="white" />}
                            className="rounded-xl h-12 bg-primary"
                        />
                    </View>
                    <View className="w-1/2 px-1 mb-2">
                        <Button
                            variant="secondary"
                            title="PDF"
                            onPress={() => handleSavePDF(selectedItem)}
                            loading={printing}
                            icon={<Download size={17} color="white" />}
                            className="rounded-xl h-12 bg-secondary"
                        />
                    </View>
                    <View className="w-1/2 px-1 mb-2">
                        <Button
                            variant="primary"
                            title="Link"
                            onPress={() => handleShareLink(selectedItem)}
                            icon={<Share2 size={17} color="white" />}
                            className="rounded-xl h-12 bg-[#00ADEF]"
                        />
                    </View>
                    {!isVoided ? (
                        <View className="w-full px-1">
                            <Button
                                variant="outline-danger"
                                title="Batalkan Order"
                                onPress={() => handleVoidOrder(selectedItem)}
                                loading={voidMutation.isPending}
                                className="rounded-xl h-12"
                            />
                        </View>
                    ) : null}
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
        setWalletView('main');
        setExpenseAmount('');
        setExpenseNote('');
        setDebiturName('');
        router.setParams({ action: undefined } as any);
    };

    const openQueueSheet = () => {
        if (Platform.OS === 'web') {
            setQueueSheetIndex(0);
        } else {
            queueSheetRef.current?.expand();
            setQueueSheetIndex(0);
        }
    };

    const closeQueueSheet = () => {
        if (Platform.OS === 'web') {
            setQueueSheetIndex(-1);
        } else {
            queueSheetRef.current?.close();
            setQueueSheetIndex(-1);
        }
        setQueueSearchOpen(false);
        setQueueSearchQuery('');
    };

    const openQueueDateFilter = () => {
        setTempDateRange(dateRange);
        setIsDateModalVisible(true);
        if (Platform.OS !== 'web') {
            dateSheetRef.current?.expand();
        }
    };

    const openQueueTransactionMode = (mode: 'sparepart' | 'servis', item: any) => {
        closeQueueSheet();
        router.push({ pathname: '/bengkel/transaksi', params: { mode, transactionId: String(item.id) } } as any);
    };

    const openEditTransaction = (item: any) => {
        if (!item?.id) return;
        if (isBengkelTransactionLocked(item)) return;
        handleClosePress();
        router.push({ pathname: '/bengkel/order', params: { id: String(item.id) } } as any);
    };

    const renderQueueSheetContent = () => (
        <>
            <View className="flex-row justify-between items-start mb-6">
                <View className="flex-1 mr-3">
                    <View className="flex-row items-center">
                        <Typography variant="h3" weight="bold" className="text-textMain text-2xl tracking-tight">Antrian Hari Ini</Typography>
                        <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 ml-2">
                            <Typography className="text-emerald-700 text-[9px] font-bold uppercase tracking-widest">
                                {queueSheetItems.length} Order
                            </Typography>
                        </View>
                    </View>
                    <Typography variant="caption" className="text-textGray">
                        {dateRange.dari} s/d {dateRange.sampai}
                    </Typography>
                </View>
                <View className="flex-row items-center">
                    <Pressable
                        onPress={() => setQueueSearchOpen(prev => !prev)}
                        className={`w-10 h-10 rounded-full items-center justify-center border mr-2 ${queueSearchOpen ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100'}`}
                    >
                        <Search size={18} color={queueSearchOpen ? 'white' : '#6B7280'} />
                    </Pressable>
                    <Pressable onPress={closeQueueSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100">
                        <X size={20} color="#6B7280" />
                    </Pressable>
                </View>
            </View>

            {queueSearchOpen && (
                <View className="flex-row items-center mb-3 bg-gray-50 border border-gray-100 rounded-2xl px-3 h-11">
                    <Search size={16} color="#9CA3AF" />
                    <TextInput
                        value={queueSearchQuery}
                        onChangeText={setQueueSearchQuery}
                        placeholder="Cari plat, customer, nomor transaksi..."
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-2 text-xs font-semibold text-textMain"
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {queueSearchQuery.length > 0 && (
                        <Pressable onPress={() => setQueueSearchQuery('')} className="w-7 h-7 items-center justify-center">
                            <X size={15} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            )}

            <Pressable
                onPress={openQueueDateFilter}
                className="flex-row items-center justify-between mb-4 bg-gray-50 border border-gray-100 rounded-[20px] px-4 py-3"
            >
                <View className="flex-row items-center flex-1">
                    <View className="w-9 h-9 rounded-2xl bg-white items-center justify-center border border-gray-100 mr-3">
                        <Calendar size={16} color="#0F766E" />
                    </View>
                    <View className="flex-1">
                        <Typography className="text-textGray text-[9px] font-bold uppercase tracking-widest">Tanggal</Typography>
                        <Typography weight="bold" className="text-textMain text-xs mt-0.5">
                            {dateRange.dari === dateRange.sampai ? dateRange.dari : `${dateRange.dari} s/d ${dateRange.sampai}`}
                        </Typography>
                    </View>
                </View>
                <ChevronLeft size={18} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                {[
                    { id: 'ALL', label: 'Semua', count: queueWorkStatusStats.total, active: 'bg-primary border-primary', inactive: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
                    { id: 'antre', label: 'Antre', count: queueWorkStatusStats.antre, active: 'bg-amber-500 border-amber-500', inactive: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                    { id: 'proses', label: 'Proses', count: queueWorkStatusStats.proses, active: 'bg-blue-500 border-blue-500', inactive: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
                    { id: 'selesai', label: 'Selesai', count: queueWorkStatusStats.selesai, active: 'bg-emerald-500 border-emerald-500', inactive: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                ].map((filter) => {
                    const isActive = queueWorkStatusFilter === filter.id;
                    return (
                        <Pressable
                            key={filter.id}
                            onPress={() => setQueueWorkStatusFilter(filter.id as any)}
                            className={`px-3.5 py-2 rounded-full border mr-2 ${isActive ? filter.active : filter.inactive}`}
                        >
                            <Typography
                                variant="caption"
                                weight="bold"
                                className={isActive ? 'text-white' : filter.text}
                            >
                                {filter.label} ({filter.count})
                            </Typography>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {[
                    { id: 'ALL', label: 'Semua', count: queuePaymentStats.total, active: 'bg-primary border-primary', inactive: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
                    { id: 'LUNAS', label: 'Lunas', count: queuePaymentStats.LUNAS, active: 'bg-emerald-500 border-emerald-500', inactive: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                    { id: 'BELUM_LUNAS', label: 'Belum Lunas', count: queuePaymentStats.BELUM_LUNAS, active: 'bg-amber-500 border-amber-500', inactive: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                    { id: 'BELUM_BAYAR', label: 'Belum Bayar', count: queuePaymentStats.BELUM_BAYAR, active: 'bg-orange-500 border-orange-500', inactive: 'bg-orange-50 border-orange-100', text: 'text-orange-700' },
                    { id: 'BATAL', label: 'Dibatalkan', count: queuePaymentStats.BATAL, active: 'bg-rose-500 border-rose-500', inactive: 'bg-rose-50 border-rose-100', text: 'text-rose-700' },
                ].map((filter) => {
                    const isActive = queuePaymentFilter === filter.id;
                    return (
                        <Pressable
                            key={filter.id}
                            onPress={() => setQueuePaymentFilter(filter.id as any)}
                            className={`px-3.5 py-2 rounded-full border mr-2 ${isActive ? filter.active : filter.inactive}`}
                        >
                            <Typography
                                variant="caption"
                                weight="bold"
                                className={isActive ? 'text-white' : filter.text}
                            >
                                {filter.label} ({filter.count})
                            </Typography>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <View>
                {queueSheetItems.length === 0 ? (
                    <EmptyState
                        title="Antrian Masih Kosong"
                        description="Tidak ada data antrian untuk periode ini."
                        icon={Clock}
                    />
                ) : (
                    queueSheetItems.map((item: any) => (
                        <Pressable
                            key={item.id}
                            onPress={() => {
                                closeQueueSheet();
                                handlePresentModalPress('detail', item);
                            }}
                            className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm mb-3 flex-row items-center"
                        >
                            <View className="w-14 h-14 bg-emerald-50 rounded-2xl items-center justify-center mr-3 border border-emerald-100/70">
                                <Typography weight="bold" className="text-primary text-[10px] uppercase tracking-tighter">
                                    {item.nomor_plat?.split(' ')[0] || '-'}
                                </Typography>
                                <Typography weight="bold" className="text-primary/40 text-[8px] mt-0.5">
                                    KENDARAAN
                                </Typography>
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-start justify-between gap-2">
                                    <View className="flex-1 mr-2">
                                        <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>
                                            {item.nomor_plat}
                                        </Typography>
                                        <Typography className="text-textGray text-[11px] mt-0.5" numberOfLines={1}>
                                            {item.nama_customer || 'Umum'} • {item.jenis_kendaraan || '-'}
                                        </Typography>
                                        {isPendingSyncRow(item) ? (
                                            <View className="mt-1">
                                                <PendingSyncBadge show />
                                            </View>
                                        ) : null}
                                    </View>
                                    <Badge
                                        label={formatBengkelWorkStatusLabel(item.status_pengerjaan)}
                                        variant={item.status_pengerjaan === 'proses' ? 'info' : item.status_pengerjaan === 'selesai' ? 'success' : 'neutral'}
                                    />
                                </View>
                                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                    <Typography className="text-textGray text-[10px] font-semibold">
                                        {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: localeID }) : '-'}
                                    </Typography>
                                    <View className="flex-row items-center">
                                        {Number(item.jumlah_bayar || 0) > 0 && (
                                            <Typography className="text-emerald-600 text-[9px] font-bold mr-2">
                                                DP: {formatCurrency(item.jumlah_bayar)}
                                            </Typography>
                                        )}
                                        <Typography weight="bold" className="text-primary text-xs">
                                            {formatCurrency(item.grand_total || 0)}
                                        </Typography>
                                    </View>
                                </View>
                                {['antre', 'proses'].includes(String(item.status_pengerjaan || '').toLowerCase()) ? (
                                    <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
                                        {[
                                            { label: 'Sparepart', mode: 'sparepart', icon: Package, color: '#059669' },
                                            { label: 'Servis', mode: 'servis', icon: Settings, color: '#2563EB' },
                                        ].map((action) => {
                                            const ActionIcon = action.icon;
                                            return (
                                                <Pressable
                                                    key={action.label}
                                                    onPress={(event: any) => {
                                                        event?.stopPropagation?.();
                                                        openQueueTransactionMode(action.mode as 'sparepart' | 'servis', item);
                                                    }}
                                                    className="flex-1 mr-2 h-9 rounded-xl bg-gray-50 border border-gray-100 flex-row items-center justify-center"
                                                >
                                                    <ActionIcon size={13} color={action.color} />
                                                    <Typography weight="bold" className="text-[9px] text-textMain ml-1" numberOfLines={1}>
                                                        {action.label}
                                                    </Typography>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ) : null}
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </>
    );


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
            {walletView === 'main' && (
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
                                    <Typography className="text-rose-300 text-sm font-bold">{formatCurrency(-(summary?.total_dana_keluar || 0))}</Typography>
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

                    {/* Quick Actions Container */}
                    <View className="mb-8">
                        <Typography variant="caption" weight="bold" className="text-textGray/30 uppercase tracking-[2px] ml-1 mb-4 text-center">Penyesuaian, Hutang & Piutang Bengkel</Typography>

                        <View className="flex-row flex-wrap -m-1 mb-6">
                            {[
                                {
                                    key: 'KELUAR',
                                    label: 'Catat Biaya',
                                    sublabel: 'DANA KELUAR',
                                    icon: <TrendingDown size={16} color="#E11D48" />,
                                    iconBg: 'bg-rose-50',
                                    text: 'text-rose-600',
                                    onPress: () => {
                                        setExpenseMode('KELUAR');
                                        setWalletView('expense');
                                        setExpenseNote('');
                                        setExpensePaymentMethod('TUNAI');
                                    }
                                },
                                {
                                    key: 'MASUK',
                                    label: 'Terima Dana',
                                    sublabel: 'DANA MASUK',
                                    icon: <TrendingUp size={16} color="#10B981" />,
                                    iconBg: 'bg-emerald-50',
                                    text: 'text-emerald-600',
                                    onPress: () => {
                                        setExpenseMode('MASUK');
                                        setWalletView('expense');
                                        setExpenseNote('Terima Dana dari Akun Utama');
                                        setExpensePaymentMethod('TUNAI');
                                    }
                                },
                                {
                                    key: 'SETORAN',
                                    label: 'Setoran Unit',
                                    sublabel: 'SETOR KE PUSAT',
                                    icon: <ArrowUpCircle size={16} color="#2563EB" />,
                                    iconBg: 'bg-blue-50',
                                    text: 'text-blue-700',
                                    onPress: () => {
                                        setExpenseMode('SETORAN');
                                        setWalletView('expense');
                                        setExpenseNote('Setoran Tunai ke Akun Utama');
                                        setExpensePaymentMethod('KAS_UTAMA');
                                    }
                                },
                                {
                                    key: 'PIUTANG_CREATE',
                                    label: 'Kasbon/Piutang',
                                    sublabel: 'UANG KELUAR',
                                    icon: <CircleDollarSign size={16} color="#D97706" />,
                                    iconBg: 'bg-amber-50',
                                    text: 'text-amber-700',
                                    onPress: () => {
                                        setExpenseMode('PIUTANG');
                                        setWalletView('expense');
                                        setExpenseNote('');
                                        setDebiturName('');
                                        setExpensePaymentMethod('KAS_UNIT_BENGKEL');
                                    }
                                },
                                {
                                    key: 'HUTANG',
                                    label: 'Hutang',
                                    sublabel: `${bengkelHutangList.filter((item: any) => item.status !== 'LUNAS').length} AKTIF`,
                                    icon: <Banknote size={16} color="#7C3AED" />,
                                    iconBg: 'bg-violet-50',
                                    text: 'text-violet-700',
                                    onPress: () => {
                                        handleCloseWallet();
                                        router.push({ pathname: '/finance/hutang', params: { unit: 'BENGKEL', from: 'bengkel' } });
                                    }
                                },
                                {
                                    key: 'PIUTANG_LIST',
                                    label: 'Piutang',
                                    sublabel: `${bengkelPiutangList.filter((item: any) => item.status !== 'LUNAS').length} AKTIF`,
                                    icon: <Receipt size={16} color="#0891B2" />,
                                    iconBg: 'bg-cyan-50',
                                    text: 'text-cyan-700',
                                    onPress: () => {
                                        handleCloseWallet();
                                        router.push({ pathname: '/finance/piutang', params: { unit: 'BENGKEL', from: 'bengkel' } });
                                    }
                                },
                            ].map((action) => (
                                <View key={action.key} className="w-1/3 p-1">
                                    <Pressable
                                        onPress={action.onPress}
                                        className="bg-white p-3 rounded-2xl border border-gray-100 items-center justify-center shadow-sm active:bg-gray-50 min-h-[110px]"
                                    >
                                        <View className={`w-8 h-8 ${action.iconBg} rounded-xl items-center justify-center mb-2`}>
                                            {action.icon}
                                        </View>
                                        <Typography weight="bold" className={`${action.text} text-[8px] uppercase tracking-wider text-center`}>{action.label}</Typography>
                                        <Typography className="text-textGray/30 text-[6px] font-bold mt-0.5 text-center">{action.sublabel}</Typography>
                                    </Pressable>
                                </View>
                            ))}
                        </View>

                        <View className="flex-row items-center bg-blue-50/50 p-4 rounded-3xl border-dashed border border-blue-100">
                            <View className="flex-1">
                                <Typography className="text-blue-700 text-[9px] font-black uppercase tracking-wider mb-1">Akses cepat dompet bengkel:</Typography>
                                <Typography className="text-blue-600/60 text-[8px] font-bold leading-tight">
                                    Gunakan kartu Hutang dan Piutang untuk melihat transaksi kategori bengkel, serta tombol penyesuaian untuk mutasi uang tunai unit.
                                </Typography>
                            </View>
                        </View>
                    </View>
                    {/* Cash Activity History */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4 px-1">
                            <Typography variant="caption" weight="bold" className="text-textGray/40 uppercase tracking-[2px]">History Aktivitas Kas & Setoran</Typography>
                            <Pressable
                                onPress={() => {
                                    handleCloseWallet();
                                    router.push({ pathname: '/(tabs)/history', params: { unit: 'bengkel' } });
                                }}
                            >
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

                </View>
            )}

            {/* Expense Form View */}
            {walletView === 'expense' && (
                <View>
                    <View className="flex-row items-center mb-6">
                        <Pressable
                            onPress={() => {
                                setWalletView('main');
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

                        {expenseMode === 'PIUTANG' && (
                            <View>
                                <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Sumber Dana / Potong Dari</Typography>
                                <View className="flex-row -m-1">
                                    {[
                                        { id: 'KAS_UNIT_BENGKEL', label: 'Dompet', saldo: balances?.kas_unit_bengkel?.saldo || 0, icon: Wallet, color: '#D97706' },
                                        { id: 'KAS_UTAMA', label: 'Cash', saldo: balances?.kas_utama?.saldo || 0, icon: Banknote, color: '#059669' },
                                        { id: 'BANK_UTAMA', label: 'BCA', saldo: balances?.bank_utama?.saldo || 0, icon: CreditCard, color: '#2563EB' }
                                    ].map((opt) => {
                                        const OptIcon = opt.icon;
                                        const active = expensePaymentMethod === opt.id;
                                        return (
                                            <View key={opt.id} className="w-1/3 p-1">
                                                <Pressable
                                                    onPress={() => setExpensePaymentMethod(opt.id)}
                                                    className={`p-3 rounded-2xl border items-center justify-center ${active
                                                        ? 'bg-amber-600 border-amber-600 shadow-sm'
                                                        : 'bg-white border-gray-100'
                                                        }`}
                                                >
                                                    <OptIcon size={20} color={active ? 'white' : opt.color} />
                                                    <Typography weight="bold" className={`text-[9px] uppercase tracking-wider mt-1.5 ${active ? 'text-white' : 'text-textGray'}`}>
                                                        {opt.label}
                                                    </Typography>
                                                    <Typography className={`text-[8px] font-bold mt-0.5 ${active ? 'text-white/80' : 'text-textGray/50'}`} numberOfLines={1}>
                                                        {formatCurrency(opt.saldo)}
                                                    </Typography>
                                                </Pressable>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {expenseMode === 'SETORAN' && (
                            <View>
                                <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Tujuan Transfer / Mutasi</Typography>
                                <View className="flex-row flex-wrap -m-1">
                                    {[
                                        { id: 'KAS_UTAMA', label: 'Cash Utama' },
                                        { id: 'BANK_UTAMA', label: 'Bank Utama' }
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
                                    appAlert('Gagal', 'Mohon isi nominal dan keterangan');
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
                                            metode_pembayaran: expensePaymentMethod === 'BANK_UTAMA' ? 'TRANSFER' : 'TUNAI',
                                            catatan: expenseNote || `Pemberian ${expensePiutangType === 'KASBON' ? 'kasbon' : 'piutang umum'} dari Unit Bengkel`,
                                            payments: [{
                                                metode: expensePaymentMethod === 'BANK_UTAMA' ? 'TRANSFER' : 'TUNAI',
                                                nominal: parseNumber(expenseAmount),
                                                kas_jenis: expensePaymentMethod,
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
                                    setWalletView('main');
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
                                    const msg = e?.response?.data?.detail || 'Gagal mencatat transaksi';
                                    handleCloseWallet();
                                    setTimeout(() => appAlert('Gagal', msg), 300);
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
            {selectedItem ? (
                Platform.OS === 'web' ? (
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        <View className="px-5 pt-3 pb-24">
                            {renderDetailContent()}
                        </View>
                    </ScrollView>
                ) : (
                    <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        <View className="px-5 pt-3 pb-24">
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
                title="Bengkel" 
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
                className="pt-4"
            >
                <View className="px-6">
                <View className="hidden">
                    <View className="flex-row items-center justify-between mb-3">
                        <View>
                            <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Cari & Filter</Typography>
                            <Typography variant="caption" className="text-textGray">Pencarian dan filter antrian</Typography>
                        </View>
                        <View className="bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
                            <Typography className="text-primary text-[9px] font-bold uppercase tracking-widest">Quick</Typography>
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-11 rounded-2xl border border-gray-100">
                            <Search size={16} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-xs font-semibold text-textMain"
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
                                    <X size={16} color="#9CA3AF" />
                                </Pressable>
                            )}
                        </View>

                        <Pressable 
                            onPress={() => router.push('/bengkel/transaksi')}
                            className="ml-2 w-11 h-11 bg-emerald-50 items-center justify-center rounded-2xl border border-emerald-100 active:scale-95"
                        >
                            <ShoppingCart size={18} color="#059669" />
                        </Pressable>

                        <Pressable 
                            onPress={() => {
                                setShowWalletModal(true);
                                if (Platform.OS !== 'web') {
                                    walletSheetRef.current?.expand();
                                }
                            }}
                            className="ml-2 w-11 h-11 bg-gray-50 items-center justify-center rounded-2xl border border-gray-100 active:scale-95"
                        >
                            <Wallet size={18} color="#023C69" />
                        </Pressable>
                    </View>

                    <View className="mt-3 pt-3 border-t border-gray-100">
                        <View className="flex-row items-center justify-between mb-2 px-1">
                            <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest">
                                Status Pembayaran
                            </Typography>
                            <Typography variant="caption" className="text-textGray">
                                {paymentFilter === 'ALL'
                                    ? 'Semua'
                                    : paymentFilter === 'LUNAS'
                                        ? 'Lunas'
                                        : paymentFilter === 'PARTIAL'
                                            ? 'Belum Lunas'
                                            : paymentFilter === 'UNPAID'
                                                ? 'Belum Bayar'
                                                : 'Dibatalkan'}
                            </Typography>
                        </View>
                        <View className="flex-row flex-wrap">
                            {[
                                { key: 'ALL', label: 'Semua', count: stats.total, active: 'bg-slate-900 border-slate-900', inactive: 'bg-white border-gray-200 text-gray-600' },
                                { key: 'LUNAS', label: 'Lunas', count: stats.lunas, active: 'bg-emerald-600 border-emerald-600', inactive: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                                { key: 'PARTIAL', label: 'Belum Lunas', count: stats.partial, active: 'bg-blue-600 border-blue-600', inactive: 'bg-blue-50 border-blue-100 text-blue-700' },
                                { key: 'UNPAID', label: 'Belum Bayar', count: stats.unpaid, active: 'bg-amber-600 border-amber-600', inactive: 'bg-amber-50 border-amber-100 text-amber-700' },
                                { key: 'BATAL', label: 'Dibatalkan', count: stats.batal, active: 'bg-rose-600 border-rose-600', inactive: 'bg-rose-50 border-rose-100 text-rose-700' },
                            ].map((item) => {
                                const active = paymentFilter === item.key;
                                return (
                                    <Pressable
                                        key={item.key}
                                        onPress={() => setPaymentFilter(item.key as any)}
                                        className={`mr-2 mb-2 min-h-[40px] min-w-[106px] flex-1 flex-row items-center justify-between rounded-2xl border px-3 py-2 ${active ? item.active : item.inactive}`}
                                    >
                                        <Typography
                                            variant="caption"
                                            weight="bold"
                                            className={active ? 'text-white text-[10px]' : 'text-[10px]'}
                                        >
                                            {item.label}
                                        </Typography>
                                        <View className={`ml-2 rounded-full px-2 py-0.5 ${active ? 'bg-white/15' : 'bg-black/5'}`}>
                                            <Typography
                                                variant="caption"
                                                weight="bold"
                                                className={active ? 'text-white text-[10px]' : 'text-textMain text-[10px]'}
                                            >
                                                {item.count}
                                            </Typography>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>

                <View className="mt-2.5">
                    <View className="flex-row space-x-2 px-1">
                        {[
                            { label: 'Antre', key: 'antre', color: '#F59E0B', icon: Clock },
                            { label: 'Proses', key: 'proses', color: '#3B82F6', icon: Activity },
                            { label: 'Selesai', key: 'selesai', color: '#10B981', icon: CheckCircle2 },
                        ].map((stat) => (
                            <View key={stat.key} className="flex-1 bg-white px-3 py-2.5 rounded-2xl border border-gray-100">
                                <View className="flex-row items-center justify-between mb-1">
                                    <View style={{ backgroundColor: stat.color + '15' }} className="w-5 h-5 rounded-full items-center justify-center">
                                        <stat.icon size={10} color={stat.color} />
                                    </View>
                                    <Typography weight="bold" style={{ color: stat.color }} className="text-sm leading-none">
                                        {summary ? summary[stat.key] : 0}
                                    </Typography>
                                </View>
                                <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest">
                                    {stat.label}
                                </Typography>
                            </View>
                        ))}
                    </View>

                    <View className="mt-6">
                        <View className="flex-row flex-wrap">
                            {bengkelMenus.map((menu, index) => (
                                <BengkelServiceCard
                                    key={menu.id}
                                    menu={menu}
                                    index={index}
                                    onPress={() => handleMenuPress(menu)}
                                />
                            ))}
                        </View>
                    </View>
                </View>
            </View>

                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 16) }} />
            </ScrollView>



            {/* Bottom Sheet UI */}
            {/* Defer gorhom sheets — mounting 3 BottomSheets on first paint was a major lag source */}
            {(sheetsReady || showWalletModal || sheetIndex >= 0 || isDateModalVisible) && (
            Platform.OS === 'web' ? (
                <>
                <Modal visible={sheetIndex !== -1} transparent animationType="slide" onRequestClose={handleClosePress}>
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleClosePress} />
                        <View className="bg-white rounded-t-[48px] shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: 640, height: '85%', alignSelf: 'center' }}>
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            {renderBottomSheetContent()}
                        </View>
                    </View>
                </Modal>

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
                        <BoundedSheetPanel
                            maxHeightRatio={0.9}
                            bottomInset={insets.bottom}
                            style={{ maxWidth: 640, alignSelf: 'center' }}
                        >
                            <BoundedSheetScrollView
                                maxHeightRatio={0.9}
                                headerReserve={16}
                                bottomInset={insets.bottom}
                                showsVerticalScrollIndicator={false}
                            >
                                <View className="pt-16 px-9 pb-12">
                                    {renderWalletContent()}
                                </View>
                            </BoundedSheetScrollView>
                        </BoundedSheetPanel>
                    </View>
                </Modal>
                </>
            ) : (
                <>
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
                    {sheetIndex >= 0 ? renderBottomSheetContent() : null}
                </BottomSheet>

                <BottomSheet
                    ref={walletSheetRef}
                    index={-1}
                    snapPoints={walletSnapPoints}
                    enablePanDownToClose
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onClose={handleCloseWallet}
                >
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <View className="px-9 py-4 pb-12">
                            {showWalletModal || sheetsReady ? renderWalletContent() : null}
                        </View>
                    </BottomSheetScrollView>
                </BottomSheet>

                </>
            )
            )}

            {/* Floating Action Button (Design System) - Rendered last with high zIndex to ensure clickability on Android */}
            <Pressable
                onPress={() => router.push('/bengkel/order')}
                style={{ bottom: 100, right: 24, elevation: 5, zIndex: 999 }}
                className="absolute bg-primary w-16 h-16 rounded-full items-center justify-center shadow-xl border-4 border-white/20 active:scale-95 transition-transform"
            >
                <Plus size={32} color="white" strokeWidth={2.5} />
            </Pressable>

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


            {/* Payment Modal — only when opened */}
            {paymentModalVisible && selectedItem && (
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
                    unit="BENGKEL"
                    kas_jenis="KAS_UNIT_BENGKEL"
                />
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
