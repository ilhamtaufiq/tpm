import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Search,
    Plus,
    Car,
    Filter,
    Info,
    Calendar,
    GaugeCircle,
    CircleDollarSign,
    Calculator,
    TrendingUp,
    TrendingDown,
    Trash2,
    X,
    Wallet,
    ArrowUpRight,
    ArrowUpCircle,
    ArrowDownCircle,
    Clock,
    Share2,
    RefreshCw
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import BottomSheet, { BottomSheetView, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MobilForm } from '../../components/MobilForm';
import { MobilDetail } from '../../components/MobilDetail';
import { MobilSalesForm } from '../../components/MobilSalesForm';
import { MobilCostForm } from '../../components/MobilCostForm';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { format, startOfMonth, isValid, parse } from 'date-fns';
import { useMobilList, useDeleteMobil, usePenjualanSummary, useInventorySummary } from '../../hooks/useMobil';
import { FILE_URL } from '../../utils/api';
import { useKasBankBalances, useKasBankList, useCreateTransaction, useTransfer, useCreatePiutang } from '../../hooks/useKeuangan';

import { useCreatePengeluaran } from '../../hooks/useBengkel';
import { formatCurrency, formatNumber, parseNumber, formatDate } from '../../utils/format';
import { Platform, Modal, TouchableOpacity } from 'react-native';
import { KaryawanSelector } from '../../components/ui/KaryawanSelector';
import { Karyawan } from '../../services/sdm';
import { Header } from '../../components/ui/Header';

export default function MobilInventoryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    // Filters
    const [dateRange, setDateRange] = useState({
        dari: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        sampai: format(new Date(), 'yyyy-MM-dd')
    });
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [tempDateRange, setTempDateRange] = useState({ ...dateRange });
    const dateSheetRef = useRef<BottomSheetModal>(null);
    const dateSnapPoints = useMemo(() => ['50%', '75%'], []);

    const [activeTab, setActiveTab] = useState('tersedia');
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'LUNAS' | 'PARTIAL' | 'UNPAID' | 'BATAL'>('ALL');
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [selectedDetailUnit, setSelectedDetailUnit] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
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
    const [expenseMode, setExpenseMode] = React.useState<'KELUAR' | 'MASUK' | 'SETORAN' | 'PIUTANG'>('KELUAR');
    const [expensePiutangType, setExpensePiutangType] = React.useState<'UMUM' | 'KASBON'>('UMUM');
    const [debiturName, setDebiturName] = React.useState('');
    const [selectedKaryawan, setSelectedKaryawan] = React.useState<Karyawan | null>(null);


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

    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    // API Hooks
    const { data, isLoading, refetch } = useMobilList({
        status: activeTab,
        status_bayar: paymentFilter,
        search: searchQuery,
        // Only apply date range for Sold/Booking, show all available inventory
        tanggal_dari: activeTab === 'tersedia' ? undefined : dateRange.dari,
        tanggal_sampai: activeTab === 'tersedia' ? undefined : dateRange.sampai
    }, {
        refetchInterval: 15000 // Polling every 15 seconds
    });

    const { data: inventorySummary, refetch: refetchInventorySum } = useInventorySummary({
        refetchInterval: 15000
    });

    const { data: summaryData, refetch: refetchSummary } = usePenjualanSummary({
        search: searchQuery,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 15000 // Polling every 15 seconds
    });

    const { data: balancesData } = useKasBankBalances();
    const unitBalance = balancesData?.kas_unit_mobil?.saldo || 0;

    const { data: historyData, isLoading: isHistoryLoading } = useKasBankList({
        jenis: 'KAS_UNIT_MOBIL',
        limit: 20,
        sort_by: 'tanggal',
        sort_order: 'desc',
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    });

    const createPiutangMutation = useCreatePiutang();
    const createExpenseMutation = useCreatePengeluaran();
    const createTransactionMutation = useCreateTransaction();
    const transferMutation = useTransfer();


    const deleteMutation = useDeleteMobil();

    const mobilsData = data?.data || [];

    const stats = useMemo(() => {
        if (summaryData) {
            return {
                total: summaryData.total_transaksi || 0,
                lunas: summaryData.lunas_count || 0,
                partial: summaryData.partial_count || 0,
                unpaid: summaryData.unpaid_count || 0,
                batal: summaryData.batal_count || 0,
                total_penjualan: summaryData.total_penjualan || 0,
                laba_tpm: summaryData.total_laba_tpm || 0,
                saldo_bop: summaryData.saldo_bop || 0
            };
        }
        return { total: 0, lunas: 0, partial: 0, unpaid: 0, batal: 0, total_penjualan: 0, laba_tpm: 0, saldo_bop: 0 };
    }, [summaryData]);

    const mobils = mobilsData;


    // Bottom Sheet Logic (Registration)
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['90%'], []);
    const detailSnapPoints = useMemo(() => ['95%'], []);

    // Bottom Sheet Logic (Sales)
    const salesBottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Bottom Sheet Logic (Costs)
    const costBottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Bottom Sheet Logic (Edit)
    const editBottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Bottom Sheet Logic (Detail)
    const detailBottomSheetModalRef = useRef<BottomSheetModal>(null);


    // Derived state for reactive updates
    const selectedUnitData = useMemo(() => {
        if (!selectedUnit) return null;
        return mobils.find((m: any) => m.id === selectedUnit.id) || selectedUnit;
    }, [selectedUnit, mobils]);

    const [webModal, setWebModal] = useState<'new' | 'edit' | 'sales' | 'cost' | 'detail' | null>(null);
    const [editingUnit, setEditingUnit] = useState<any>(null);

    const handlePresentModalPress = useCallback(() => {
        if (Platform.OS === 'web') {
            setWebModal('new');
        } else {
            bottomSheetModalRef.current?.present();
        }
    }, [bottomSheetModalRef]);

    const handlePresentSalesModal = useCallback((unit: any) => {
        setSelectedUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('sales');
        } else {
            salesBottomSheetModalRef.current?.present();
        }
    }, [salesBottomSheetModalRef]);

    const handlePresentCostModal = useCallback((unit: any) => {
        setSelectedUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('cost');
        } else {
            costBottomSheetModalRef.current?.present();
        }
    }, [costBottomSheetModalRef]);

    const handlePresentDetailModal = useCallback((unit: any) => {
        setSelectedDetailUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('detail');
        } else {
            detailBottomSheetModalRef.current?.present();
        }
    }, [detailBottomSheetModalRef]);

    const handlePresentEditModal = useCallback((unit: any) => {
        setEditingUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('edit');
        } else {
            editBottomSheetModalRef.current?.present();
        }
    }, [editBottomSheetModalRef]);

    const handleDeleteMobil = (unit: any) => {
        setDialogConfig({
            visible: true,
            title: "Hapus Unit",
            message: `Apakah Anda yakin ingin menghapus ${unit.merek} ${unit.model} (${unit.nomor_plat})? Data yang dihapus tidak dapat dikembalikan.`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);

                    if (!onlineManager.isOnline()) {
                        deleteMutation.mutate(unit.id);
                        refetch();
                        closeDialog();
                        Alert.alert('Offline Mode', 'Unit mobil telah dijadwalkan untuk dihapus saat online.');
                        return;
                    }

                    await deleteMutation.mutateAsync(unit.id);
                    refetch();
                    closeDialog();
                } catch (error) {
                    console.error("Gagal menghapus mobil:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: "Gagal menghapus unit mobil",
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

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'tersedia': return '#023C69';
            case 'booking': return '#FF9500';
            case 'terjual': return '#8E8E93';
            default: return '#EE2737';
        }
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
            dateSheetRef.current?.dismiss();
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
                        onPress={() => {
                            setIsDateModalVisible(false);
                            if (Platform.OS !== 'web') dateSheetRef.current?.dismiss();
                        }}
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
            walletSheetRef.current?.dismiss();
        }
        setIsRecordingExpense(false);
        setExpenseAmount('');
        setExpenseNote('');
        setDebiturName('');
    };


    const walletSheetRef = useRef<BottomSheetModal>(null);
    const walletSnapPoints = useMemo(() => ['85%', '95%'], []);

    const renderWalletContent = () => (
        <>
            <View className="flex-row justify-between items-center mb-8">
                <View>
                    <Typography variant="h3" weight="bold" className="text-primary text-2xl tracking-tight">Dompet Unit Mobil</Typography>
                    <Typography className="text-textGray/40 text-[10px] uppercase font-black tracking-widest">Inventory Cash Liquidity</Typography>
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
                                    <Typography className="text-rose-300 text-sm font-bold">{formatCurrency((summaryData?.total_dana_dari_utama || 0) + (summaryData?.total_tunai || 0) - unitBalance)}</Typography>
                                </View>
                            </View>

                            <View className="flex-row justify-between pt-4 border-t border-white/5">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                                        <Typography variant="caption" className="text-white/50 font-black uppercase tracking-[1px] text-[7px]">Unit Jual (Tunai)</Typography>
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
                                        { id: 'KAS_UNIT_JASA_ANGKUT', label: 'Jasa Angkut' },
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
                                            bisnis_kategori: 'penjualan_mobil',
                                            kategori: 'BIAYA_OPERASIONAL',
                                            kas_jenis: 'KAS_UNIT_MOBIL'
                                        });
                                    } else if (expenseMode === 'MASUK') {
                                        await transferMutation.mutateAsync({
                                            dari: 'KAS_UTAMA',
                                            ke: 'KAS_UNIT_MOBIL',
                                            nominal: parseNumber(expenseAmount),
                                            tanggal: new Date().toISOString().split('T')[0],
                                            keterangan: expenseNote
                                        });
                                    } else if (expenseMode === 'PIUTANG') {
                                        // CREATE PIUTANG (Money out from Unit)
                                         await createPiutangMutation.mutateAsync({
                                            tanggal: new Date().toISOString().split('T')[0],
                                            sumber: expensePiutangType === 'KASBON' ? 'KASBON_KARYAWAN' : 'JUAL_BELI_MOBIL',
                                            nama_debitur: debiturName,
                                            referensi_id: expensePiutangType === 'KASBON' ? selectedKaryawan?.id : undefined,
                                            nominal_piutang: parseNumber(expenseAmount),
                                            metode_pembayaran: 'TUNAI',
                                            catatan: expenseNote || `Pemberian kasbon/piutang dari Unit Mobil`,
                                            payments: [{
                                                metode: 'TUNAI',
                                                nominal: parseNumber(expenseAmount),
                                                kas_jenis: 'KAS_UNIT_MOBIL',
                                                catatan: 'Disbursement from Unit Cash'
                                            }]
                                        });
                                    } else {
                                        const keAccount = expensePaymentMethod;
                                        await transferMutation.mutateAsync({
                                            dari: 'KAS_UNIT_MOBIL',
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
                                } catch (error) {
                                    Alert.alert('Gagal', getErrorMessage(error, 'Gagal mencatat transaksi'));
                                }
                            }}
                            className={`h-16 rounded-[28px] mt-2 ${expenseMode === 'KELUAR' ? 'bg-rose-600 shadow-rose-600/30' : expenseMode === 'MASUK' ? 'bg-emerald-600 shadow-emerald-600/30' : expenseMode === 'PIUTANG' ? 'bg-amber-600 shadow-amber-600/30' : 'bg-blue-600 shadow-blue-600/30'} shadow-xl`}
                        />
                    </View>
                </View>
            )}
        </>
    );

    const getErrorMessage = (error: any, defaultMsg: string) => {

        if (typeof error === 'string') return error;
        return error?.response?.data?.detail || error?.message || defaultMsg;
    };

    const unitStats = useMemo(() => {
        if (inventorySummary) {
            return {
                total: inventorySummary.total_mobil || 0,
                tersedia: inventorySummary.per_status?.TERSEDIA || inventorySummary.per_status?.tersedia || 0,
                terjual: inventorySummary.per_status?.TERJUAL || inventorySummary.per_status?.terjual || 0
            };
        }
        return { total: 0, tersedia: 0, terjual: 0 };
    }, [inventorySummary]);

    return (
        <BottomSheetModalProvider>
            <View className="flex-1 bg-surface">
                <StatusBar barStyle="light-content" />

                <Header 
                    title="Jual Beli Mobil" 
                    subtitle="Manajemen Unit" 
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
                                        placeholder="Cari Unit (Plat, Model)..."
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
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#023C69" />
                    }
                >
                    {/* Inventory Status (Metric Row) */}
                    <View className="flex-row justify-between mb-8">
                        {[
                            { label: 'TERSEDIA', key: 'tersedia', color: '#023C69', icon: Car },
                            { label: 'BOOKING', key: 'booking', color: '#F59E0B', icon: Clock },
                            { label: 'TERJUAL', key: 'terjual', color: '#10B981', icon: RefreshCw },
                        ].map((stat) => (
                            <View key={stat.key} style={{ width: '31%' }} className="bg-white p-3 rounded-[32px] border border-gray-100 shadow-sm items-center">
                                <View style={{ backgroundColor: stat.color + '15' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-1.5">
                                    <stat.icon size={16} color={stat.color} />
                                </View>
                                <Typography weight="bold" style={{ color: stat.color }} className="text-xl leading-tight">
                                    {inventorySummary ? (inventorySummary.per_status?.[stat.key.toUpperCase()] || inventorySummary.per_status?.[stat.key] || 0) : 0}
                                </Typography>
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
                                    walletSheetRef.current?.present();
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

                        {/* Item 2: Laporan (Penjualan) */}
                        <Pressable
                            key="grid-laporan"
                            onPress={() => router.push({ pathname: '/laporan/pembelian-mobil' })}
                            style={{ width: '48.5%' }}
                            className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                        >
                            <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-blue-500/10 border border-gray-50">
                                <TrendingUp size={22} color="#3B82F6" strokeWidth={2.5} />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Laporan</Typography>
                                <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>PENJUALAN</Typography>
                            </View>
                        </Pressable>

                        {/* Item 3: Master Data (Database) */}
                        <Pressable
                            key="grid-database"
                            onPress={() => router.push('/master-data')}
                            style={{ width: '48.5%' }}
                            className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                        >
                            <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-amber-500/10 border border-gray-50">
                                <RefreshCw size={22} color="#F59E0B" strokeWidth={2.5} />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Database</Typography>
                                <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>MASTER DATA</Typography>
                            </View>
                        </Pressable>

                        {/* Item 4: Register (Tambah Unit) */}
                        <Pressable
                            key="grid-register"
                            onPress={handlePresentModalPress}
                            style={{ width: '48.5%' }}
                            className="bg-white p-4 rounded-[32px] border border-gray-100 flex-row items-center shadow-sm mb-3 active:bg-gray-50"
                        >
                            <View className="w-11 h-11 bg-white rounded-2xl items-center justify-center mr-3 shadow-md shadow-indigo-500/10 border border-gray-50">
                                <Plus size={22} color="#6366F1" strokeWidth={2.5} />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-textMain text-[11px]" numberOfLines={1}>Tambah Unit</Typography>
                                <Typography className="text-textGray/40 text-[7px] uppercase font-bold tracking-widest" numberOfLines={1}>REGISTRASI</Typography>
                            </View>
                        </Pressable>
                    </View>

                    {/* Section Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Daftar Inventaris Mobil</Typography>
                            <Typography variant="caption" className="text-textGray">Management stok dan penjualan unit</Typography>
                        </View>
                    </View>

                    {/* Tab Shifters */}
                    <View className="flex-row bg-gray-100/50 p-1.5 rounded-[24px] mb-8">
                        {[
                            { label: 'Tersedia', key: 'tersedia' },
                            { label: 'Booking', key: 'booking' },
                            { label: 'Terjual', key: 'terjual' },
                        ].map((tab) => (
                            <Pressable
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3.5 rounded-[20px] items-center ${activeTab === tab.key ? 'bg-white shadow-sm shadow-black/5 border border-gray-200/50' : ''}`}
                            >
                                <Typography weight="bold" className={`text-xs ${activeTab === tab.key ? 'text-primary' : 'text-textGray'}`}>
                                    {tab.label}
                                </Typography>
                            </Pressable>
                        ))}
                    </View>

                    {/* Date Filter Selection */}
                    {activeTab !== 'tersedia' && (
                        <Pressable
                            onPress={() => {
                                setTempDateRange(dateRange);
                                setIsDateModalVisible(true);
                                if (Platform.OS !== 'web') {
                                    dateSheetRef.current?.present();
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
                    )}


                    {/* Car List */}
                    <View className="space-y-6 pb-20">
                        {isLoading && mobils.length === 0 ? (
                            <View className="space-y-4">
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </View>
                        ) : mobils.length === 0 ? (
                        <EmptyState
                            title="Mobil tidak ditemukan"
                            description={searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : "Belum ada unit mobil dalam kategori ini."}
                            icon={Car}
                        />
                    ) : (
                        mobils.map((item: any) => (
                            <Pressable
                                key={item.id}
                                onPress={() => handlePresentDetailModal(item)}
                                className="mb-6"
                            >
                                <Card className="overflow-hidden border-0 shadow-lg bg-white rounded-[32px]">
                                    {/* Image Section */}
                                    <View className="h-56 bg-gray-100">
                                        {item.media && item.media.length > 0 ? (
                                            <Image
                                                source={{
                                                    uri: `${(FILE_URL || '').replace(/\/$/, '')}/uploads/${item.media[0].file_path.replace(/^\//, '')}?t=${Date.now()}`
                                                }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center bg-emerald-50">
                                                <Car size={64} color="#10B981" opacity={0.2} />
                                            </View>
                                        )}
                                        {/* Glassmorphism Badges */}
                                        <View className="absolute top-4 left-4 right-4 flex-row justify-between flex-wrap gap-2">
                                            <View className="flex-row gap-2">
                                                <View className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                    <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                        {item.status}
                                                    </Typography>
                                                </View>
                                                {item.status_bayar_beli !== 'LUNAS' && (
                                                    <View className="bg-rose-600/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                        <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                            HUTANG
                                                        </Typography>
                                                    </View>
                                                )}
                                                {item.status === 'booking' && (
                                                    <View className="bg-amber-500/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                        <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                            PIUTANG
                                                        </Typography>
                                                    </View>
                                                )}
                                            </View>
                                            <View className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm self-start">
                                                <Typography variant="caption" weight="bold" className="text-primary text-[10px]">
                                                    {item.tahun}
                                                </Typography>
                                            </View>
                                        </View>
                                        <View className="absolute bottom-4 left-4 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                                            <Typography variant="caption" weight="bold" className="text-white text-[10px]">
                                                {item.nomor_plat}
                                            </Typography>
                                        </View>
                                    </View>

                                    <View className="p-5">
                                        <View className="flex-row justify-between items-start mb-4">
                                            <View className="flex-1 mr-4">
                                                <Typography variant="h3" weight="bold" className="text-xl tracking-tight text-textMain">
                                                    {item.merek} {item.model}
                                                </Typography>
                                                <Typography variant="caption" className="text-textGray font-medium mt-1">
                                                    {item.transmisi} • {item.tipe_kepemilikan}
                                                </Typography>
                                            </View>
                                            <View className="items-end">
                                                <Typography variant="h3" weight="bold" className="text-primary text-xl">
                                                    {formatCurrency(Number(item.harga_beli || 0) + Number(item.total_biaya || 0) + Number(item.total_part_service || 0))}
                                                </Typography>
                                                <Typography variant="caption" className="text-textGray mt-1">Estimasi Modal</Typography>
                                            </View>
                                        </View>

                                        <View className="flex-row items-center justify-between pt-4 border-t border-gray-50">
                                            <View className="flex-row items-center space-x-4">
                                                <View className="flex-row items-center">
                                                    <GaugeCircle size={14} color="#9CA3AF" />
                                                    <Typography className="ml-1.5 text-xs text-textGray font-bold">
                                                        {item.kilometer?.toLocaleString()} KM
                                                    </Typography>
                                                </View>
                                            </View>
                                            <View className="flex-row items-center space-x-3">
                                                {(item.status === 'tersedia' || item.status === 'booking') && (
                                                    <Pressable
                                                        className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center border border-emerald-100"
                                                        onPress={() => handlePresentSalesModal(item)}
                                                    >
                                                        <CircleDollarSign size={18} color="#10B981" />
                                                    </Pressable>
                                                )}
                                                <Pressable
                                                    className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center border border-blue-100"
                                                    onPress={() => handlePresentCostModal(item)}
                                                >
                                                    <TrendingUp size={18} color="#3B82F6" />
                                                </Pressable>
                                                <Pressable
                                                    className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100"
                                                    onPress={() => handleDeleteMobil(item)}
                                                >
                                                    <Trash2 size={18} color="#EF4444" />
                                                </Pressable>
                                            </View>
                                        </View>
                                    </View>
                                </Card>
                            </Pressable>
                        ))
                    )}
                    </View>
                    <View className="h-32" />
                </ScrollView>

                {/* FAB matching Home */}
                <Pressable
                    onPress={handlePresentModalPress}
                    className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20 active:scale-95 transition-transform"
                >
                    <Plus size={32} color="white" strokeWidth={2.5} />
                </Pressable>

                {/* Hybrid UI Logic modals (Web & Native) */}
                {Platform.OS === 'web' ? (
                    <>
                        <Modal visible={!!webModal} transparent animationType="slide" onRequestClose={() => setWebModal(null)}>
                            <View className="flex-1 justify-end bg-black/40">
                                <Pressable className="absolute inset-0" onPress={() => setWebModal(null)} />
                                <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                    <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                                    {webModal === 'new' && <MobilForm onSuccess={() => { setWebModal(null); refetch(); }} />}
                                    {webModal === 'edit' && editingUnit && <MobilForm initialData={editingUnit} onSuccess={() => { setWebModal(null); refetch(); }} />}
                                    {webModal === 'sales' && selectedUnitData && <MobilSalesForm unit={selectedUnitData} onSuccess={() => { setWebModal(null); refetch(); }} />}
                                    {webModal === 'cost' && selectedUnitData && <MobilCostForm unit={selectedUnitData} onSuccess={() => { setWebModal(null); refetch(); }} />}
                                    {webModal === 'detail' && selectedDetailUnit && <MobilDetail unit={selectedDetailUnit} onClose={() => setWebModal(null)} onSell={(u) => { setWebModal('sales'); setSelectedUnit(u); }} onEdit={() => { setWebModal('edit'); setEditingUnit(selectedDetailUnit); }} />}
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
                                        {(!historyData?.data || historyData.data.length === 0) && (
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
                        <BottomSheetModal
    ref={bottomSheetModalRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onChange={handleSheetChanges}
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
>
                            <View className="flex-1">
                                <MobilForm onSuccess={() => { bottomSheetModalRef.current?.dismiss(); refetch(); }} />
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal
    ref={salesBottomSheetModalRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onChange={handleSheetChanges}
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
>
                            <View className="flex-1">
                                {selectedUnitData && <MobilSalesForm unit={selectedUnitData} onSuccess={() => { salesBottomSheetModalRef.current?.dismiss(); refetch(); }} />}
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal
    ref={costBottomSheetModalRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onChange={handleSheetChanges}
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
>
                            <View className="flex-1">
                                {selectedUnitData && <MobilCostForm unit={selectedUnitData} onSuccess={() => { costBottomSheetModalRef.current?.dismiss(); refetch(); }} />}
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal
    ref={detailBottomSheetModalRef}
    index={0}
    snapPoints={detailSnapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onChange={handleSheetChanges}
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
>
                            <View className="flex-1">
                                {selectedDetailUnit && <MobilDetail unit={selectedDetailUnit} onClose={() => detailBottomSheetModalRef.current?.dismiss()} onSell={(u) => { detailBottomSheetModalRef.current?.dismiss(); handlePresentSalesModal(u); }} onEdit={() => { detailBottomSheetModalRef.current?.dismiss(); handlePresentEditModal(selectedDetailUnit); }} />}
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal
    ref={editBottomSheetModalRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onChange={handleSheetChanges}
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
>
                            <View className="flex-1">
                                {editingUnit && <MobilForm initialData={editingUnit} onSuccess={() => { editBottomSheetModalRef.current?.dismiss(); refetch(); }} />}
                            </View>
                        </BottomSheetModal>

                        <BottomSheetModal
    ref={walletSheetRef}
    index={0}
    snapPoints={walletSnapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onDismiss={handleCloseWallet}
    onChange={handleSheetChanges}
    keyboardBehavior="interactive"
    keyboardBlurBehavior="restore"
>
                            <BottomSheetView className="flex-1 px-8 py-2">
                                {renderWalletContent()}
                            </BottomSheetView>
                        </BottomSheetModal>

                        <BottomSheetModal
    ref={dateSheetRef}
    index={0}
    snapPoints={dateSnapPoints}
    enablePanDownToClose
    topInset={insets.top}
    backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
    onDismiss={() => setIsDateModalVisible(false)}
    onChange={handleSheetChanges}
>
                            <BottomSheetView className="flex-1 px-8 py-2">
                                <Typography variant="h2" weight="bold" className="mb-6">Pilih Periode</Typography>
                                {renderDateContent()}
                            </BottomSheetView>
                        </BottomSheetModal>

                        {/* History Modal for Mobile */}
                        <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
                            <View className="flex-1 bg-black/60 justify-end">
                                <Pressable className="flex-1" onPress={() => setShowHistoryModal(false)} />
                                <View className="bg-white rounded-t-[48px] h-[85%] overflow-hidden">
                                    <View className="p-8 border-b border-gray-100 flex-row justify-between items-center">
                                        <View>
                                            <Typography variant="h2" weight="bold">Riwayat Aktivitas Kas</Typography>
                                            <Typography variant="caption" className="text-textGray">Unit Mobil • {dateRange.dari} s/d {dateRange.sampai}</Typography>
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
                                        {(!historyData?.data || historyData.data.length === 0) && (
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
                )}

                {/* Date Modal for Web */}
                {Platform.OS === 'web' && isDateModalVisible && (
                    <Modal visible={true} transparent animationType="fade">
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
                )}
            </View>
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
        </BottomSheetModalProvider>
    );
}
