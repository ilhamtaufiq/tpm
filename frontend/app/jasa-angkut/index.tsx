import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl, Platform, Modal, TextInput, Share, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Plus,
    Search,
    Truck,
    Clock,
    CheckCircle,
    RotateCcw,
    Calendar,
    Users,
    Wallet,
    ArrowUpRight,
    MapPin,
    ArrowRight,
    RefreshCw,
    Edit,
    X,
    Trash2,
    Share2,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingDown,
    TrendingUp,
    CircleDollarSign,
    Banknote,
    Receipt
} from 'lucide-react-native';
import { useRouter, router } from 'expo-router';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, isValid, parse } from 'date-fns';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { formatCurrency, formatDate } from '../../utils/format';
import { Muatan, jasaAngkutService } from '../../services/jasaAngkut';
import { MuatanForm } from '../../components/jasa-angkut/MuatanForm';
import {
    useMuatanList,
    useMuatanSummary,
    useActiveArmada,
    usePayMuatanSplit,
    useUpdateMuatanStatus,
    useVoidMuatan,
    useDeleteMuatan
} from '../../hooks/useJasaAngkut';
import { useCreatePengeluaran } from '../../hooks/useBengkel';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { RelatedBengkelTransactions } from '../../components/RelatedBengkelTransactions';
import { PaymentModal } from '../../components/PaymentModal';
import { useKasBankBalances, useCreateTransaction, useTransfer, useKasBankList, useCreatePiutang, useHutangList, usePiutangList } from '../../hooks/useKeuangan';

import { formatNumber, parseNumber } from '../../utils/format';
import { FILE_URL } from '../../utils/api';

import { KaryawanSelector } from '../../components/ui/KaryawanSelector';
import { Karyawan } from '../../services/sdm';
import { Header } from '../../components/ui/Header';

export default function JasaAngkutScreen() {
    // UI States (Moved up to prevent use-before-declaration)
    const [searchQuery, setSearchQuery] = useState('');
    const [groupBy, setGroupBy] = useState<'armada' | 'supir'>('armada');
    const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'LUNAS' | 'PARTIAL' | 'UNPAID' | 'BATAL'>('ALL');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState<Muatan | null>(null);
    const [view, setView] = useState<'form' | 'detail'>('form');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [sheetIndex, setSheetIndex] = useState(-1);

    const handleSheetChanges = useCallback((index: number) => {
        setSheetIndex(index);
    }, []);

    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Inline Expense Form State
    const [isRecordingExpense, setIsRecordingExpense] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseNote, setExpenseNote] = useState('');
    const [expensePaymentMethod, setExpensePaymentMethod] = useState<string>('KAS_UTAMA');

    const [expenseMode, setExpenseMode] = useState<'KELUAR' | 'MASUK' | 'SETORAN' | 'PIUTANG'>('KELUAR');
    const [expensePiutangType, setExpensePiutangType] = useState<'UMUM' | 'KASBON'>('UMUM');
    const [debiturName, setDebiturName] = useState('');
    const [selectedKaryawan, setSelectedKaryawan] = React.useState<Karyawan | null>(null);


    // Filters
    const [dateRange, setDateRange] = useState({
        dari: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        sampai: format(new Date(), 'yyyy-MM-dd')
    });
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [tempDateRange, setTempDateRange] = useState({ ...dateRange });
    const dateSheetRef = useRef<BottomSheet>(null);
    const dateSnapPoints = useMemo(() => ['50%', '70%'], []);

    // API Hooks
    const { data: muatanData, isLoading, refetch } = useMuatanList({
        limit: 100,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 10000 // Polling every 10 seconds
    });
    const { data: summaryData, refetch: refetchSummary } = useMuatanSummary({
        search: searchQuery,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 10000 // Polling every 10 seconds
    });
    const { data: armadaData, isLoading: isLoadingArmada } = useActiveArmada();
    const updateStatusMutation = useUpdateMuatanStatus();
    const voidMuatanMutation = useVoidMuatan();
    const deleteMuatanMutation = useDeleteMuatan();
    const queryClient = useQueryClient();

    const { data: balances } = useKasBankBalances();
    const unitBalance = balances?.kas_unit_jasa_angkut?.saldo || 0;

    const { data: historyData, isLoading: isHistoryLoading } = useKasBankList({
        jenis: 'KAS_UNIT_JASA_ANGKUT',
        limit: 20,
        sort_by: 'tanggal',
        sort_order: 'desc',
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 5000
    });
    const { data: hutangData } = useHutangList({
        limit: 20,
        status: 'BELUM_LUNAS',
        unit: 'JASA_ANGKUT',
        sort_by: 'tanggal',
        sort_order: 'desc',
    });
    const { data: piutangData } = usePiutangList({
        limit: 20,
        status: 'BELUM_LUNAS',
        unit: 'JASA_ANGKUT',
        sort_by: 'tanggal',
        sort_order: 'desc',
    });

    const createPiutangMutation = useCreatePiutang();
    const createExpenseMutation = useCreatePengeluaran();
    const createTransactionMutation = useCreateTransaction();
    const transferMutation = useTransfer();


    const jasaAngkutHutangList = useMemo(() => (hutangData?.data || []).filter((item: any) => item.unit === 'JASA_ANGKUT'), [hutangData]);
    const jasaAngkutPiutangList = useMemo(() => (piutangData?.data || []).filter((item: any) => item.unit === 'JASA_ANGKUT'), [piutangData]);

    // Payment Filter Logic (Reactive)
    const stats = useMemo(() => {
        if (summaryData) {
            return {
                total: summaryData.total_transaksi || 0,
                lunas: summaryData.lunas_count || 0,
                partial: summaryData.partial_count || 0,
                unpaid: summaryData.unpaid_count || 0,
                batal: summaryData.batal_count || 0,
                revenue: summaryData.total_pendapatan || 0,
                profit: summaryData.laba_tpm || 0,
                saldo_bop: summaryData.saldo_bop || 0
            };
        }
        return { total: 0, lunas: 0, partial: 0, unpaid: 0, batal: 0, revenue: 0, profit: 0, saldo_bop: 0 };
    }, [summaryData]);

    const recentTrips = useMemo(() => {
        let trips = muatanData?.data || [];

        if (paymentFilter === 'LUNAS') {
            trips = trips.filter((t: any) => t.status_bayar === 'lunas' || t.status_bayar === 'LUNAS');
        } else if (paymentFilter === 'PARTIAL') {
            trips = trips.filter((t: any) =>
                (t.status_bayar === 'belum_lunas' || t.status_bayar === 'BELUM_LUNAS') &&
                (Number(t.jumlah_bayar) > 0)
            );
        } else if (paymentFilter === 'UNPAID') {
            trips = trips.filter((t: any) =>
                (t.status_bayar === 'belum_lunas' || t.status_bayar === 'BELUM_LUNAS') &&
                (Number(t.jumlah_bayar) === 0 || !t.jumlah_bayar)
            );
        } else if (paymentFilter === 'BATAL') {
            trips = trips.filter((t: any) => t.status_bayar === 'batal' || t.status_bayar === 'BATAL');
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            trips = trips.filter((t: any) =>
                t.asal?.toLowerCase().includes(query) ||
                t.tujuan?.toLowerCase().includes(query) ||
                t.supir_nama?.toLowerCase().includes(query) ||
                t.supir?.nama?.toLowerCase().includes(query) ||
                t.armada?.nama?.toLowerCase().includes(query) ||
                t.nopol?.toLowerCase().includes(query)
            );
        }
        return trips;
    }, [muatanData, searchQuery, paymentFilter]);


    // Group trips by armada type OR driver
    const groupedTrips = useMemo(() => {
        const map = new Map<string, {
            key: string;
            id?: number;
            title: string;
            subtitle?: string;
            trips: any[];
            totalRitase: number;
            totalPendapatanTPM: number;
        }>();

        // Initialize with all Armadas if grouping by armada
        if (groupBy === 'armada' && armadaData) {
            for (const armada of armadaData) {
                const key = `armada-${armada.id}`;
                map.set(key, {
                    key,
                    id: armada.id,
                    title: armada.nama,
                    subtitle: armada.nopol || armada.jenis,
                    trips: [],
                    totalRitase: 0,
                    totalPendapatanTPM: 0,
                });
            }
        }

        for (const trip of recentTrips) {
            let key = '';
            let title = '';
            let subtitle = '';

            if (groupBy === 'armada') {
                if (trip.armada) {
                    key = `armada-${trip.armada.id}`;
                    title = trip.armada.nama;
                    subtitle = trip.armada.nopol || trip.armada.jenis;
                } else {
                    key = 'manual-armada';
                    title = 'Armada Luar';
                    subtitle = trip.nopol || 'Tanpa Nopol';
                }
            } else {
                // Group by Supir
                if (trip.supir_id || trip.supir) {
                    const supir = trip.supir;
                    key = `supir-${trip.supir_id}`;
                    title = supir?.nama || trip.supir_nama || 'Supir Terdaftar';
                    subtitle = supir?.kode || 'Staff';
                } else {
                    key = 'manual-supir';
                    title = trip.supir_nama || trip.supir_nama_manual || 'Supir Lepas';
                    subtitle = 'Manual';
                }
            }

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    id: groupBy === 'armada' ? trip.armada?.id : trip.supir_id,
                    title,
                    subtitle,
                    trips: [],
                    totalRitase: 0,
                    totalPendapatanTPM: 0,
                });
            }

            const group = map.get(key)!;
            group.trips.push(trip);
            group.totalRitase += Number(trip.ritase || 1);
            group.totalPendapatanTPM += Number(trip.pendapatan_kotor || 0) - Number(trip.laba_supir || 0);
        }

        const result = Array.from(map.values());

        // If searching, only return groups with trips (unless group title matches search)
        if (searchQuery) {
            return result.filter(g => g.trips.length > 0 || g.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return result.sort((a, b) => {
            // Priority: groups with trips, then sorted by name
            if (a.trips.length !== b.trips.length) return b.trips.length - a.trips.length;
            return a.title.localeCompare(b.title);
        });
    }, [recentTrips, groupBy, armadaData, searchQuery]);

    const toggleGroupCollapse = useCallback((key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    // Dialog State
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const [actionLoading, setActionLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editData, setEditData] = useState<Muatan | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);



    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const handleShareLink = async (trip: any) => {
        const shareUrl = `${FILE_URL}/api/v1/public/receipt/view/jasa_angkut/${trip.id}`;
        const shareMessage = `Halo, ini adalah rincian ritase/angkutan Anda di Tiga Putra Motor: ${shareUrl}`;

        try {
            if (Platform.OS === 'web' && !navigator.share) {
                // Fallback for web browser that doesn't support Web Share API
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

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetch(), refetchSummary()]);
        setRefreshing(false);
    }, [refetch, refetchSummary]);

    const handleFormSuccess = () => {
        handleCloseSheet();
        refetch();
    };

    const handlePresentModal = (type: 'form' | 'detail' | 'armada_detail', item?: any) => {
        if (type === 'armada_detail') {
            router.push(`/jasa-angkut/armada/detail/${item.id}`);
            return;
        }

        setView(type);

        if (type === 'form') setEditData(null);
        if (type === 'detail') setSelectedTrip(item);

        if (Platform.OS === 'web') {
            if (type === 'form') setIsFormOpen(true);
            else if (type === 'detail') setIsDetailOpen(true);
        } else {
            setSheetIndex(0);
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = useCallback(() => {
        if (Platform.OS === 'web') {
            setIsFormOpen(false);
            setIsDetailOpen(false);
        } else {
            bottomSheetRef.current?.close();
            setSheetIndex(-1);
        }
        setSelectedTrip(null);
        setEditData(null);
    }, []);

    const handleEdit = (item: Muatan) => {
        setEditData(item);
        if (Platform.OS === 'web') {
            setIsDetailOpen(false);
            setTimeout(() => setIsFormOpen(true), 100);
        } else {
            // For mobile bottom sheet, we just switch view state
            setView('form');
            // Ensure sheet is open
            bottomSheetRef.current?.expand();
        }
    };


    const handleDelete = (item: Muatan) => {
        setDialogConfig({
            visible: true,
            title: "Hapus Muatan",
            message: "Apakah Anda yakin ingin menghapus data muatan ini? Data yang dihapus tidak dapat dikembalikan.",
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);

                    if (!onlineManager.isOnline()) {
                        jasaAngkutService.deleteMuatan(item.id);
                        handleCloseSheet();
                        refetch();
                        closeDialog();
                        Alert.alert('Offline Mode', 'Data muatan telah dijadwalkan untuk dihapus saat online.');
                        return;
                    }

                    await jasaAngkutService.deleteMuatan(item.id);
                    handleCloseSheet();
                    refetch();
                    closeDialog();
                } catch (error) {
                    console.error("Gagal menghapus:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: getErrorMessage(error, "Gagal menghapus data muatan"),
                            variant: 'error',
                            type: 'alert'
                        });
                    }, 500);
                } finally {
                    setActionLoading(false);
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


    const walletSheetRef = useRef<BottomSheet>(null);
    const walletSnapPoints = useMemo(() => ['85%', '95%'], []);

    const renderWalletContent = () => (
        <>
            <View className="flex-row justify-between items-center mb-8">
                <View>
                    <Typography variant="h3" weight="bold" className="text-primary text-2xl tracking-tight">Dompet Jasa Angkut</Typography>
                    <Typography className="text-textGray/40 text-[10px] uppercase font-black tracking-widest">Transport Cash Liquidity</Typography>
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
                                    <Typography className="text-white text-sm font-bold">{formatCurrency(summaryData?.total_dana_dari_utama || 0)}</Typography>
                                </View>
                                <View className="flex-1 items-end">
                                    <View className="flex-row items-center mb-1">
                                        <Typography variant="caption" className="text-white/50 font-black uppercase tracking-[1px] text-[7px]">Total Keluar (Biaya/Setor)</Typography>
                                        <View className="w-1.5 h-1.5 rounded-full bg-rose-400 ml-2" />
                                    </View>
                                    <Typography className="text-rose-300 text-sm font-bold">{formatCurrency(-(summaryData?.total_dana_keluar || 0))}</Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between pt-4 border-t border-white/5">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                                        <Typography variant="caption" className="text-white/50 font-black uppercase tracking-[1px] text-[7px]">Omzet Jasa (Tunai)</Typography>
                                    </View>
                                    <Typography className="text-white text-sm font-bold">{formatCurrency(summaryData?.total_tunai || 0)}</Typography>
                                </View>
                                <View className="flex-1 items-end">
                                    <View className="flex-row items-center mb-1 text-right">
                                        <Typography variant="caption" className="text-white/30 font-bold uppercase tracking-[1px] text-[7px]">Omzet (via Transfer)</Typography>
                                        <View className="w-1 h-1 rounded-full bg-gray-500 ml-2" />
                                    </View>
                                    <Typography className="text-white/40 text-[10px] font-bold italic">{formatCurrency(summaryData?.total_transfer || 0)}</Typography>
                                </View>
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
                                    router.push({ pathname: '/(tabs)/history', params: { unit: 'jasa_angkut' } });
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
                                {historyData?.data?.slice(0, 2).map((item: any) => (
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

                    {/* Quick Actions */}
                    <View>
                        <Typography variant="caption" weight="bold" className="text-textGray/30 uppercase tracking-[2px] ml-1 mb-4 text-center">Penyesuaian, Hutang, Piutang</Typography>
                        <View className="flex-row flex-wrap -mx-1 mb-6">
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
                                        setIsRecordingExpense(true);
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
                                        setIsRecordingExpense(true);
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
                                        setIsRecordingExpense(true);
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
                                        setIsRecordingExpense(true);
                                        setExpenseNote('');
                                        setDebiturName('');
                                        setExpensePaymentMethod('TUNAI');
                                    }
                                },
                                {
                                    key: 'HUTANG',
                                    label: 'Hutang',
                                    sublabel: `${jasaAngkutHutangList.filter((item: any) => item.status !== 'LUNAS').length} AKTIF`,
                                    icon: <Banknote size={16} color="#7C3AED" />,
                                    iconBg: 'bg-violet-50',
                                    text: 'text-violet-700',
                                    onPress: () => {
                                        handleCloseWallet();
                                        router.push({ pathname: '/finance/hutang', params: { unit: 'JASA_ANGKUT', from: 'jasa-angkut' } });
                                    }
                                },
                                {
                                    key: 'PIUTANG_LIST',
                                    label: 'Piutang',
                                    sublabel: `${jasaAngkutPiutangList.filter((item: any) => item.status !== 'LUNAS').length} AKTIF`,
                                    icon: <Receipt size={16} color="#0891B2" />,
                                    iconBg: 'bg-cyan-50',
                                    text: 'text-cyan-700',
                                    onPress: () => {
                                        handleCloseWallet();
                                        router.push({ pathname: '/finance/piutang', params: { unit: 'JASA_ANGKUT', from: 'jasa-angkut' } });
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
                                <Typography className="text-blue-700 text-[9px] font-black uppercase tracking-wider mb-1">Akses cepat dompet jasa angkut:</Typography>
                                <Typography className="text-blue-600/60 text-[8px] font-bold leading-tight">
                                    Gunakan kartu Hutang dan Piutang untuk melihat transaksi unit jasa angkut tanpa membuka data unit lain.
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
                                    <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">
                                        {expensePiutangType === 'KASBON' ? 'Pilih Karyawan' : 'Nama Penerima/Debitur'}
                                    </Typography>
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
                                        <TextInput
                                            placeholder="Contoh: Andi, Staff, dll..."
                                            value={debiturName}
                                            onChangeText={setDebiturName}
                                            className="bg-gray-50 p-5 rounded-3xl text-sm font-bold text-primary border border-gray-100"
                                        />
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
                                        { id: 'KAS_UNIT_BENGKEL', label: 'Unit Bengkel' }
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
                                            bisnis_kategori: 'jasa_angkut',
                                            kategori: 'BIAYA_OPERASIONAL',
                                            kas_jenis: 'KAS_UNIT_JASA_ANGKUT'
                                        });
                                    } else if (expenseMode === 'MASUK') {
                                        await transferMutation.mutateAsync({
                                            dari: 'KAS_UTAMA',
                                            ke: 'KAS_UNIT_JASA_ANGKUT',
                                            nominal: parseNumber(expenseAmount),
                                            tanggal: new Date().toISOString().split('T')[0],
                                            keterangan: expenseNote
                                        });
                                    } else if (expenseMode === 'PIUTANG') {
                                        await createPiutangMutation.mutateAsync({
                                            tanggal: new Date().toISOString().split('T')[0],
                                            sumber: expensePiutangType === 'KASBON' ? 'KASBON_KARYAWAN' : 'LAINNYA',
                                            unit: 'JASA_ANGKUT',
                                            nama_debitur: debiturName,
                                            referensi_id: expensePiutangType === 'KASBON' ? selectedKaryawan?.id : undefined,
                                            nominal_piutang: parseNumber(expenseAmount),
                                            metode_pembayaran: 'TUNAI',
                                            catatan: expenseNote || `Pemberian ${expensePiutangType === 'KASBON' ? 'kasbon' : 'piutang umum'} dari Unit Jasa Angkut`,
                                            payments: [{
                                                metode: 'TUNAI',
                                                nominal: parseNumber(expenseAmount),
                                                kas_jenis: 'KAS_UNIT_JASA_ANGKUT',
                                                catatan: `Disbursement for ${expensePiutangType}`
                                            }]
                                        });
                                    } else {
                                        const keAccount = expensePaymentMethod;
                                        await transferMutation.mutateAsync({
                                            dari: 'KAS_UNIT_JASA_ANGKUT',
                                            ke: keAccount as any,
                                            nominal: parseNumber(expenseAmount),
                                            tanggal: new Date().toISOString().split('T')[0],
                                            keterangan: expenseNote
                                        });
                                    }


                                    setExpenseAmount('');
                                    setExpenseNote('');
                                    setDebiturName('');
                                    setIsRecordingExpense(false);
                                    handleCloseWallet();

                                    setDialogConfig({
                                        visible: true,
                                        title: 'Sukses',
                                        message: expenseMode === 'KELUAR'
                                            ? 'Biaya operasional jasa angkut berhasil dicatat'
                                            : expenseMode === 'MASUK'
                                                ? 'Dana berhasil diterima dari akun utama'
                                                : expenseMode === 'PIUTANG'
                                                    ? 'Pemberian kasbon/piutang unit berhasil dicatat'
                                                    : 'Setoran ke akun utama berhasil dicatat',
                                        variant: 'success',
                                        type: 'alert'
                                    });
                                    refetch();
                                    refetchSummary();
                                } catch (e: any) {
                                    Alert.alert('Gagal', getErrorMessage(e, 'Gagal mencatat transaksi'));
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
            {view === 'form' ? (
                <MuatanForm onSuccess={handleFormSuccess} initialData={editData} />
            ) : selectedTrip ? (
                renderDetailContent(selectedTrip)
            ) : null}
        </View>
    );

    const handleUpdateStatus = async (tripId: number, currentStatus: string) => {
        const nextStatus = currentStatus === 'PROSES' ? 'SELESAI' : 'PROSES';
        const confirmMessage = currentStatus === 'PROSES'
            ? 'Tandai muatan ini sebagai Selesai? Armada akan tersedia kembali untuk ritase lain.'
            : 'Kembalikan status muatan ke Proses?';

        setDialogConfig({
            visible: true,
            title: "Update Status",
            message: confirmMessage,
            variant: 'info',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);
                    await updateStatusMutation.mutateAsync({ id: tripId, status: nextStatus as any });

                    // Update the local selected trip state if open
                    if (selectedTrip && selectedTrip.id === tripId) {
                        setSelectedTrip({ ...selectedTrip, status: nextStatus as any });
                    }

                    // Invalidate ALL related queries to ensure resource readiness (Armada/Supir) is recalculated
                    queryClient.invalidateQueries({ queryKey: ['muatan-list'] });
                    queryClient.invalidateQueries({ queryKey: ['muatan-summary'] });
                    queryClient.invalidateQueries({ queryKey: ['active-armada'] });
                    queryClient.invalidateQueries({ queryKey: ['active-drivers'] });

                    refetch();
                    refetchSummary();
                    closeDialog();
                } catch (error) {
                    console.error("Gagal update status:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: getErrorMessage(error, "Gagal memperbarui status muatan"),
                            variant: 'error',
                            type: 'alert'
                        });
                    }, 500);
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    const handleCancelMuatan = async (tripId: number) => {
        setDialogConfig({
            visible: true,
            title: "Batalkan Muatan",
            message: 'Apakah Anda yakin ingin membatalkan muatan ini? Seluruh catatan keuangan (Kas/Bank & Piutang) yang terkait dengan ritase ini akan dihapus/dibalikkan.',
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);
                    await voidMuatanMutation.mutateAsync(tripId);

                    // Update the local selected trip state if open
                    if (selectedTrip && selectedTrip.id === tripId) {
                        setSelectedTrip(null);
                        handleCloseSheet();
                    }

                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Sukses",
                            message: "Muatan berhasil dibatalkan",
                            variant: 'success',
                            type: 'alert'
                        });
                    }, 500);
                } catch (error) {
                    console.error("Gagal membatalkan muatan:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: getErrorMessage(error, "Gagal membatalkan muatan"),
                            variant: 'error',
                            type: 'alert'
                        });
                    }, 500);
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    function renderDetailContent(trip: Muatan) {
        const ScrollContainer = Platform.OS === 'web' ? ScrollView : BottomSheetScrollView;

        return (
            <ScrollContainer style={{ flex: 1 }}>
                <View className="p-8 pb-32">
                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{trip.tujuan}</Typography>
                            <Typography variant="body2" className="text-textGray mt-1">
                                #{trip.nomor_transaksi}
                            </Typography>
                        </View>
                        <View className="flex-row space-x-2">
                            <Badge
                                label={trip.status.toUpperCase()}
                                variant={trip.status === 'SELESAI' ? 'success' : 'info'}
                            />
                            <Badge
                                label={trip.status_bayar.toUpperCase()}
                                variant={trip.status_bayar === 'LUNAS' ? 'success' : 'warning'}
                            />
                        </View>
                    </View>

                    <Card variant="outlined" className="p-6 border-gray-100 mb-6 bg-gray-50/50 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-primary uppercase tracking-widest">Informasi Rute</Typography>
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-4">
                                <MapPin size={20} color="#10B981" />
                            </View>
                            <View>
                                <Typography variant="caption" className="text-textGray">Titik Asal</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.asal}</Typography>
                            </View>
                        </View>
                        <View className="w-[1px] h-6 bg-gray-200 ml-5 my-1" />
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-secondary/10 rounded-xl items-center justify-center mr-4">
                                <MapPin size={20} color="#3B82F6" />
                            </View>
                            <View>
                                <Typography variant="caption" className="text-textGray">Tujuan Akhir</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.tujuan}</Typography>
                            </View>
                        </View>
                        <View className="mt-4 pt-4 border-t border-gray-100 flex-row justify-between">
                            <View>
                                <Typography variant="caption" className="text-textGray">Nama Supir</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.supir_nama || trip.supir?.nama || trip.supir_nama_manual || '-'}</Typography>
                            </View>
                            <View className="items-end">
                                <Typography variant="caption" className="text-textGray">Tanggal Input</Typography>
                                <Typography weight="bold" className="text-textMain">{formatDate(trip.tanggal)}</Typography>
                            </View>
                        </View>
                    </Card>

                    {trip && <RelatedBengkelTransactions muatan_id={trip.id} />}

                    <Card variant="outlined" className="p-6 border-gray-100 mb-6 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-slate-500 uppercase tracking-widest">Analisa Laba Rugi</Typography>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-textGray">Pendapatan TPM (Gross)</Typography>
                            <Typography weight="bold" className="text-textMain">{formatCurrency(Number(trip.pendapatan_kotor) - Number(trip.laba_supir))}</Typography>
                        </View>

                        <View className="flex-row justify-between mb-3 bg-primary/5 p-3 rounded-xl mt-4">
                            <Typography variant="body2" weight="bold" className="text-primary text-[11px]">PENDAPATAN TPM (NET)</Typography>
                            <Typography weight="bold" className="text-primary">{formatCurrency(trip.laba_tpm)}</Typography>
                        </View>

                        {/* Driver share shown but secondary, as requested 'boleh di form' assuming detail is close to form context */}
                        <View className="flex-row justify-between px-3 py-1">
                            <Typography variant="caption" className="text-textGray/60">Hak Driver (Tidak Dicatat Kas)</Typography>
                            <Typography variant="caption" weight="bold" className="text-textGray/40">{formatCurrency(trip.laba_supir)}</Typography>
                        </View>
                    </Card>

                    <Card variant="outlined" className="p-6 border-gray-100 mb-8 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-slate-500 uppercase tracking-widest">Informasi Pembayaran</Typography>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-textGray">Total Tagihan (Net TPM)</Typography>
                            <Typography weight="bold" className="text-textMain">{formatCurrency(trip.laba_tpm)}</Typography>
                        </View>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-emerald-600">Telah Dibayar</Typography>
                            <Typography weight="bold" className="text-emerald-700">{formatCurrency(trip.jumlah_bayar || 0)}</Typography>
                        </View>
                        {trip.status_bayar === 'BELUM_LUNAS' && (
                            <View className="flex-row justify-between pt-3 border-t border-gray-100 mt-2">
                                <Typography variant="body2" weight="bold" className="text-rose-600">Sisa Tagihan (Piutang)</Typography>
                                <Typography weight="bold" className="text-rose-700">{formatCurrency(Number(trip.laba_tpm) - Number(trip.jumlah_bayar || 0))}</Typography>
                            </View>
                        )}

                        {trip.payment_history && trip.payment_history.length > 0 && (
                            <View className="mt-4 pt-4 border-t border-gray-100">
                                <Typography variant="caption" weight="bold" className="mb-3 text-textGray/60 uppercase tracking-widest">Riwayat Pembayaran</Typography>
                                {trip.payment_history.map((payment: any, index: number) => (
                                    <View key={index} className="flex-row justify-between items-center mb-2">
                                        <View>
                                            <Typography variant="caption" weight="bold" className="text-textMain">{formatDate(payment.tanggal)}</Typography>
                                            <Typography variant="caption" className="text-textGray/60 text-[10px]">{payment.metode_bayar}</Typography>
                                        </View>
                                        <Typography variant="caption" weight="bold" className="text-emerald-600">+{formatCurrency(payment.nominal)}</Typography>
                                    </View>
                                ))}
                            </View>
                        )}
                    </Card>

                    <View className="mb-4">
                        {trip.status === 'PROSES' ? (
                            <Pressable
                                onPress={() => handleUpdateStatus(trip.id, trip.status)}
                                className="flex-row items-center justify-center bg-emerald-100 py-4 rounded-3xl border border-emerald-200"
                            >
                                <CheckCircle size={20} color="#059669" />
                                <Typography weight="bold" className="text-emerald-700 ml-2">Selesaikan Ritase (Ready-kan Armada)</Typography>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={() => handleUpdateStatus(trip.id, trip.status)}
                                className="flex-row items-center justify-center bg-blue-50 py-4 rounded-3xl border border-blue-100"
                            >
                                <RotateCcw size={20} color="#2563EB" />
                                <Typography weight="bold" className="text-blue-700 ml-2">Reset ke Status Proses</Typography>
                            </Pressable>
                        )}
                    </View>

                    <View className="space-y-4">
                        <Button
                            variant="outline"
                            title="Edit Muatan"
                            onPress={() => handleEdit(trip)}
                            className="rounded-3xl h-14"
                            icon={<Edit size={20} color="#023C69" />}
                        />

                        {trip.status !== 'BATAL' && (
                            <TouchableOpacity
                                onPress={() => handleCancelMuatan(trip.id)}
                                className="flex-row items-center justify-center bg-rose-50 py-4 rounded-3xl border border-rose-100"
                            >
                                <X size={20} color="#E11D48" />
                                <Typography weight="bold" className="text-rose-600 ml-2">Batalkan Muatan</Typography>
                            </TouchableOpacity>
                        )}
                        {trip.piutang_id && trip.status_bayar !== 'LUNAS' && (
                            <Button
                                title="Pelunasan / Bayar Cicilan"
                                onPress={() => setPaymentModalVisible(true)}
                                className="rounded-2xl h-14 bg-emerald-600"
                                icon={<RefreshCw size={20} color="white" />}
                            />
                        )}

                        <Button
                            variant="primary"
                            title="Bagikan Link Struk"
                            onPress={() => handleShareLink(trip)}
                            icon={<Share2 size={20} color="white" />}
                            className="rounded-2xl h-14 bg-[#00ADEF] shadow-lg shadow-[#00ADEF]/30"
                        />
                        <Button
                            variant="ghost"
                            title="Tutup Panel"
                            onPress={handleCloseSheet}
                            className="rounded-2xl h-12"
                        />
                    </View>
                </View>
            </ScrollContainer>
        );
    }


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header
                title="Jasa Angkut"
                subtitle="Manajemen Ritase & Logistik"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            />

            {/* Filter Search Overlay */}
            {sheetIndex === -1 && (
                <View className="px-6 mt-4">
                    <View className="bg-white p-3 rounded-[24px] border border-gray-100 shadow-sm flex-col">
                        <View className="flex-row items-center">
                            <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-11 rounded-2xl border border-gray-100">
                                <Search size={16} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-xs font-semibold text-textMain"
                                    placeholder="Cari Ritase (Rute, Supir)..."
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
                className="flex-1 pt-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {/* Ritase Metrics (Metric Row) */}
                <View className="flex-row justify-between mb-8 mx-6">
                    {[
                        { label: 'RITASE', value: stats.total, color: '#3B82F6', icon: Truck },
                        { label: 'PROFIT', value: formatCurrency(stats.profit), color: '#10B981', icon: TrendingUp },
                        { label: 'SALDO', value: formatCurrency(stats.saldo_bop), color: '#F59E0B', icon: Wallet },
                    ].map((stat, idx) => (
                        <View key={idx} style={{ width: '31%' }} className="bg-white p-3 rounded-[32px] border border-gray-100 shadow-sm items-center">
                            <View style={{ backgroundColor: stat.color + '15' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-1.5">
                                <stat.icon size={16} color={stat.color} />
                            </View>
                            <Typography weight="bold" style={{ color: stat.color }} className={`${typeof stat.value === 'string' && stat.value.length > 10 ? 'text-[10px]' : 'text-sm'} leading-tight`} numberOfLines={1}>
                                {stat.value}
                            </Typography>
                            <Typography className="text-textGray/40 text-[7px] font-bold tracking-widest">{stat.label}</Typography>
                        </View>
                    ))}
                </View>

                {/* Service Grid Section (Bento Style) */}
                <View className="flex-row flex-wrap justify-between mb-8 mx-6">
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

                    {/* Item 2: Armada (Daftar Armada) */}
                    <Pressable
                        key="grid-armada"
                        onPress={() => router.push('/jasa-angkut/armada')}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-blue-500/10 border border-gray-50">
                            <Truck size={22} color="#3B82F6" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Armada</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>KENDARAAN</Typography>
                        </View>
                    </Pressable>

                    {/* Item 3: Supir (Daftar Supir) */}
                    <Pressable
                        key="grid-supir"
                        onPress={() => router.push('/jasa-angkut/supir')}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-amber-500/10 border border-gray-50">
                            <Users size={22} color="#F59E0B" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Supir</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>STAFF DRIVER</Typography>
                        </View>
                    </Pressable>

                    {/* Item 4: Register (Tambah Muatan) */}
                    <Pressable
                        key="grid-register"
                        onPress={() => handlePresentModal('form')}
                        style={{ width: '48.5%' }}
                        className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                    >
                        <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-indigo-500/10 border border-gray-50">
                            <Plus size={22} color="#6366F1" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Tambah Rit</Typography>
                            <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>MUAT BARU</Typography>
                        </View>
                    </Pressable>
                </View>

                {/* Section Header */}
                <View className="flex-row justify-between items-center mb-6 px-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Daftar Ritase Angkutan</Typography>
                        <Typography variant="caption" className="text-textGray">Management pengiriman dan logistik</Typography>
                    </View>
                </View>

                {/* Grouping Toggle */}
                <View className="flex-row bg-gray-100/50 p-1.5 rounded-[24px] mb-8 mx-6">
                    {[
                        { label: 'Berdasarkan Armada', key: 'armada' },
                        { label: 'Berdasarkan Supir', key: 'supir' },
                    ].map((mode) => (
                        <Pressable
                            key={mode.key}
                            onPress={() => setGroupBy(mode.key as any)}
                            className={`flex-1 py-3.5 rounded-[20px] items-center ${groupBy === mode.key ? 'bg-white shadow-sm shadow-black/5 border border-gray-200/50' : ''}`}
                        >
                            <Typography weight="bold" className={`text-xs ${groupBy === mode.key ? 'text-primary' : 'text-textGray'}`}>
                                {mode.label}
                            </Typography>
                        </Pressable>
                    ))}
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
                    className="flex-row items-center justify-between mb-8 bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 active:bg-gray-50 mx-6"
                >
                    <View className="flex-row items-center">
                        <Calendar size={18} color="#023C69" />
                        <Typography className="text-gray-800 text-xs font-bold ml-3">{dateRange.dari} s/d {dateRange.sampai}</Typography>
                    </View>
                    <View className="bg-primary/5 px-2 py-1 rounded-lg">
                        <Typography className="text-primary text-[10px] font-bold">Ubah Periode</Typography>
                    </View>
                </Pressable>

                {/* Main Content (Trips List) */}
                <View className="pb-32">
                    {isLoading || isLoadingArmada ? (
                        <View className="space-y-6 px-6">
                            <SkeletonCard className="rounded-[32px] h-32" />
                            <SkeletonCard className="rounded-[32px] h-32" />
                            <SkeletonCard className="rounded-[32px] h-32" />
                        </View>
                    ) : groupedTrips.length === 0 ? (
                        <View className="mt-10 px-6">
                            <EmptyState
                                title="Belum ada data"
                                description="Mulai catat transaksi muatan pertama Anda hari ini."
                                icon={Truck}
                            />
                        </View>
                    ) : (
                        groupedTrips.map((group) => {
                            const isCollapsed = !collapsedGroups.has(group.key); // Changed logic to be collapsed by default
                            return (
                                <View key={group.key} className="mb-2">
                                    {/* Group Header - Enhanced Card style */}
                                    <Pressable
                                        onPress={() => toggleGroupCollapse(group.key)}
                                        className={`bg-white p-5 border-b ${!isCollapsed ? 'border-primary/20 bg-primary/5' : 'border-gray-100 shadow-sm'} flex-row items-center justify-between`}
                                    >
                                        <View className="flex-row items-center flex-1">
                                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${groupBy === 'armada' ? (group.trips.length > 0 ? 'bg-primary/10 border-primary/10' : 'bg-gray-50 border-gray-100') : 'bg-orange-100 border-orange-200'}`}>
                                                {groupBy === 'armada' ? <Truck size={22} color={!isCollapsed ? '#023C69' : '#94A3B8'} /> : <Users size={22} color="#C2410C" />}
                                            </View>
                                            <View className="flex-1">
                                                <Typography weight="bold" className={`text-base tracking-tight ${!isCollapsed ? 'text-primary' : 'text-textMain'}`}>
                                                    {group.title}
                                                </Typography>
                                                <Typography variant="caption" className="text-textGray">
                                                    {group.subtitle ? `${group.subtitle} • ` : ''}{group.trips.length} Transaksi
                                                </Typography>
                                            </View>
                                        </View>
                                        <View className="flex-row items-center">
                                            {group.trips.length > 0 && (
                                                <View className="bg-primary/5 px-3 py-1.5 rounded-full mr-3 border border-primary/5">
                                                    <Typography variant="caption" weight="bold" className="text-primary text-[10px]">
                                                        {formatCurrency(group.totalPendapatanTPM)}
                                                    </Typography>
                                                </View>
                                            )}
                                            {groupBy === 'armada' && group.id && (
                                                <Pressable
                                                    onPress={() => handlePresentModal('armada_detail', { id: group.id })}
                                                    className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-2 border border-gray-100"
                                                >
                                                    <ArrowUpRight size={18} color="#023C69" />
                                                </Pressable>
                                            )}
                                            <ChevronLeft
                                                size={20}
                                                color={!isCollapsed ? "#023C69" : "#9CA3AF"}
                                                style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '90deg' }] }}
                                            />
                                        </View>
                                    </Pressable>

                                     {/* Group Content (Trips) */}
                                    {!isCollapsed && (
                                        <View className="space-y-0 pt-0">
                                            {group.trips.length === 0 ? (
                                                <View className="py-4 items-center bg-gray-50/50 border-b border-dashed border-gray-200">
                                                    <Typography variant="caption" className="text-gray-400 italic">Belum ada aktivitas transaksi</Typography>
                                                </View>
                                            ) : (
                                                group.trips.map((trip: any) => (
                                                    <Pressable
                                                        key={trip.id}
                                                        onPress={() => handlePresentModal('detail', trip)}
                                                        className="bg-white p-5 border-b border-gray-50 flex-row items-center"
                                                    >
                                                        {/* Visual ID Slot - Smaller for nested items */}
                                                        <View className="w-12 h-12 bg-gray-50 rounded-[16px] items-center justify-center mr-4 border border-gray-100">
                                                            <MapPin size={20} color="#6B7280" />
                                                        </View>

                                                        <View className="flex-1">
                                                            {/* Main Info + Status */}
                                                            <View className="flex-row items-center justify-between mb-1">
                                                                <View className="flex-1 mr-2 flex-row items-center">
                                                                    <Typography variant="body2" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                                                        {trip.asal} → {trip.tujuan}
                                                                    </Typography>
                                                                    <View className="mx-2 w-1 h-1 bg-gray-300 rounded-full" />
                                                                    <Typography variant="caption" weight="bold" className="text-primary italic">
                                                                        {trip.ritase} Rit
                                                                    </Typography>
                                                                </View>
                                                                <View className="flex-row space-x-1">
                                                                    <View className={trip.status === 'SELESAI' ? "bg-green-100 px-2 py-0.5 rounded-lg border border-green-200" : "bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200"}>
                                                                        <Typography weight="bold" className={trip.status === 'SELESAI' ? "text-green-700 text-[8px]" : "text-blue-700 text-[8px]"}>
                                                                            {trip.status.toUpperCase()}
                                                                        </Typography>
                                                                    </View>
                                                                    <View className={trip.status_bayar === 'LUNAS' ? "bg-emerald-50 px-2 py-0.5 rounded-lg" : "bg-amber-50 px-2 py-0.5 rounded-lg"}>
                                                                        <Typography weight="bold" className={trip.status_bayar === 'LUNAS' ? "text-emerald-600 text-[8px]" : "text-amber-600 text-[8px]"}>
                                                                            {trip.status_bayar.toUpperCase()}
                                                                        </Typography>
                                                                    </View>
                                                                </View>
                                                            </View>

                                                            {/* Trip Details */}
                                                            <Typography variant="caption" className="text-textGray mb-2 text-xs">
                                                                {trip.supir_nama || trip.supir_nama_manual} • {trip.jenis_muatan || 'Muatan Umum'}
                                                            </Typography>

                                                            {/* Footer Row */}
                                                            <View className="flex-row items-center justify-between pt-2 border-t border-gray-50/50">
                                                                <View className="flex-row items-center">
                                                                    <Clock size={10} color="#9CA3AF" />
                                                                    <Typography className="text-textGray/60 text-[9px] ml-1 font-bold uppercase tracking-widest">
                                                                        {formatDate(trip.tanggal)}
                                                                    </Typography>
                                                                </View>
                                                                <View className="items-end">
                                                                    <Typography weight="bold" className="text-primary text-xs">
                                                                        {formatCurrency(trip.laba_tpm)}
                                                                    </Typography>
                                                                    {trip.status_bayar === 'LUNAS' ? (
                                                                        <Typography variant="caption" className="text-emerald-600 text-[9px] font-bold mt-0.5">LUNAS</Typography>
                                                                    ) : (
                                                                        <Typography variant="caption" className="text-rose-600 text-[9px] font-bold mt-0.5">Sisa: {formatCurrency(Number(trip.laba_tpm) - Number(trip.jumlah_bayar || 0))}</Typography>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        </View>
                                                    </Pressable>
                                                ))
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <Pressable
                onPress={() => handlePresentModal('form')}
                style={{ bottom: 100, right: 24, elevation: 5, zIndex: 999 }}
                className="absolute bg-primary w-16 h-16 rounded-full items-center justify-center shadow-xl border-4 border-white/20 active:scale-95 transition-transform"
            >
                <Plus size={32} color="white" strokeWidth={2.5} />
            </Pressable>

            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <>
                    <Modal visible={isFormOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <Pressable className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <MuatanForm onSuccess={handleFormSuccess} initialData={editData} />
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={isDetailOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <Pressable className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                {selectedTrip && renderDetailContent(selectedTrip)}
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={showWalletModal} transparent animationType="slide" onRequestClose={handleCloseWallet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <Pressable className="absolute inset-0" onPress={handleCloseWallet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[85%] self-center p-8 overflow-hidden shadow-2xl relative">
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {renderWalletContent()}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={showHistoryModal} transparent animationType="fade" onRequestClose={() => setShowHistoryModal(false)}>
                        <View className="flex-1 bg-black/60 justify-center items-center p-6">
                            <View className="bg-white rounded-[40px] w-full max-w-md h-[80%] overflow-hidden shadow-2xl">
                                <View className="p-6 border-b border-gray-100 flex-row justify-between items-center">
                                    <Typography variant="h3" weight="bold">Riwayat Kas & Setoran</Typography>
                                    <Pressable onPress={() => setShowHistoryModal(false)} className="w-8 h-8 bg-gray-50 rounded-full items-center justify-center">
                                        <X size={18} color="#64748B" />
                                    </Pressable>
                                </View>
                                <ScrollView className="flex-1 p-6">
                                    {historyData?.data?.map((item: any) => (
                                        <View key={item.id} className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex-row items-center mb-4">
                                            <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${item.tipe === 'MASUK' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                                {item.tipe === 'MASUK' ? <TrendingUp size={20} color="#10B981" /> : <TrendingDown size={20} color="#E11D48" />}
                                            </View>
                                            <View className="flex-1">
                                                <Typography weight="bold" className="text-textMain text-sm">{item.keterangan || item.sumber}</Typography>
                                                <Typography variant="caption" className="text-textGray/60 mt-0.5">{format(new Date(item.tanggal), 'dd MMM yyyy')}</Typography>
                                            </View>
                                            <View className="items-end">
                                                <Typography weight="bold" className={`text-sm ${item.tipe === 'MASUK' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {item.tipe === 'MASUK' ? '+' : '-'}{formatCurrency(item.nominal)}
                                                </Typography>
                                            </View>
                                        </View>
                                    ))}
                                    {historyData?.data?.length === 0 && (
                                        <View className="py-20 items-center">
                                            <CircleDollarSign size={48} color="#CBD5E1" />
                                            <Typography className="text-gray-400 mt-4 italic">Belum ada riwayat aktivitas</Typography>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
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
                        {renderBottomSheetContent()}
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
                            <View className="px-8 py-2">
                                {renderWalletContent()}
                            </View>
                        </BottomSheetScrollView>
                    </BottomSheet>

                    {/* History Modal for Mobile */}
                    <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
                        <View className="flex-1 bg-black/60 justify-end">
                            <Pressable className="flex-1" onPress={() => setShowHistoryModal(false)} />
                            <View className="bg-white rounded-t-[48px] h-[85%] overflow-hidden">
                                <View className="p-8 border-b border-gray-100 flex-row justify-between items-center">
                                    <View>
                                        <Typography variant="h2" weight="bold">Riwayat Aktivitas Kas</Typography>
                                        <Typography variant="caption" className="text-textGray">Jasa Angkut • {dateRange.dari} s/d {dateRange.sampai}</Typography>
                                    </View>
                                    <Pressable onPress={() => setShowHistoryModal(false)} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                                        <X size={20} color="#64748B" />
                                    </Pressable>
                                </View>
                                <ScrollView className="flex-1 p-8">
                                    {historyData?.data?.map((item: any) => (
                                        <View key={item.id} className="bg-gray-50/50 p-5 rounded-[32px] border border-gray-100 flex-row items-center mb-4">
                                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.tipe === 'MASUK' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                                {item.tipe === 'MASUK' ? <TrendingUp size={24} color="#10B981" /> : <TrendingDown size={24} color="#E11D48" />}
                                            </View>
                                            <View className="flex-1">
                                                <Typography weight="bold" className="text-textMain text-base">{item.keterangan || item.sumber}</Typography>
                                                <Typography variant="caption" className="text-textGray/60 mt-0.5">{format(new Date(item.tanggal), 'dd MMM yyyy')}</Typography>
                                            </View>
                                            <View className="items-end">
                                                <Typography weight="bold" className={`text-base ${item.tipe === 'MASUK' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {item.tipe === 'MASUK' ? '+' : '-'}{formatCurrency(item.nominal)}
                                                </Typography>
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                </>
            )
            }

            {/* Date Selection Modal (Hybrid) */}
            {Platform.OS === 'web' ? (
                <Modal visible={isDateModalVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/50 justify-center items-center p-6">
                        <View className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
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

            {/* Floating Action Button matching Bento style */}
            {/* <View style={{ position: 'absolute', bottom: 40, right: 24, zIndex: 999 }}>
                <Pressable
                    onPress={() => handlePresentModal('form')}
                    className="w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20 active:scale-95 transition-transform"
                >
                    <Plus size={32} color="white" strokeWidth={2.5} />
                </Pressable>
            </View> */}

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={closeDialog}
                onConfirm={dialogConfig.onConfirm}
                loading={actionLoading}
            />

            {selectedTrip && selectedTrip.piutang_id && (
                <PaymentModal
                    visible={paymentModalVisible}
                    onClose={() => setPaymentModalVisible(false)}
                    onSuccess={() => {
                        setPaymentModalVisible(false);
                        handleCloseSheet();
                        setTimeout(() => {
                            setDialogConfig({
                                visible: true,
                                title: 'Sukses',
                                message: 'Pembayaran berhasil dicatat',
                                variant: 'success',
                                type: 'alert'
                            });
                        }, 400);
                        refetch();
                    }}
                    id={selectedTrip.piutang_id}
                    initialAmount={Number(selectedTrip.pendapatan_kotor) - Number(selectedTrip.laba_supir) - Number(selectedTrip.jumlah_bayar || 0)}
                    title="Pelunasan Jasa Angkut"
                    allowedMethods={['TUNAI', 'TRANSFER']}
                    unit="JASA_ANGKUT"
                    kas_jenis="KAS_UNIT_JASA_ANGKUT"
                />
            )}

        </View>
    );
}
