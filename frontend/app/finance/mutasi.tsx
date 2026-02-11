import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, FlatList, ActivityIndicator, RefreshControl, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    ChevronLeft,
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    Building2,
    ArrowRightLeft,
    Filter,
    RefreshCw,
    Plus,
    PlusCircle,
    ArrowDownLeft,
    ArrowUpRight,
    Search,
    Calendar
} from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { KasBankTransaction, KasBankAllBalances, KasBankJenis } from '../../services/keuangan';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import { useKasBankList, useKasBankBalances, useTransfer, useCreateTransaction } from '../../hooks/useKeuangan';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tabs } from '../../components/ui/Tabs';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

const ACCOUNT_FILTERS: { label: string; value: KasBankJenis | 'all' }[] = [
    { label: 'Semua', value: 'all' },
    { label: 'Cash', value: 'cash' },
    { label: 'BCA', value: 'bank_bca' },
];

const JENIS_LABEL: Record<KasBankJenis, string> = {
    cash: 'Cash',
    bank_bca: 'Bank BCA',
    bank_mandiri: 'Bank Mandiri',
    bank_bri: 'Bank BRI',
    bank_lainnya: 'Bank Lainnya',
};

export default function MutasiKasScreen() {
    const { action } = useLocalSearchParams<{ action?: string }>();
    const [selectedFilter, setSelectedFilter] = useState<KasBankJenis | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [mode, setMode] = useState<'transfer' | 'modal'>('transfer');
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // API Hooks
    const { data: txData, isLoading: isLoadingTx, refetch: refetchTx } = useKasBankList({
        limit: 50,
        jenis: selectedFilter === 'all' ? undefined : selectedFilter,
    });
    const { data: balances, isLoading: isLoadingBalances, refetch: refetchBalances } = useKasBankBalances();
    const transferMutation = useTransfer();
    const createTxMutation = useCreateTransaction();

    // Effect to handle direct action from navigation
    useEffect(() => {
        if (action === 'modal') {
            setMode('modal');
            setTimeout(() => bottomSheetRef.current?.expand(), 200);
        }
    }, [action]);

    const transactions = txData?.data || [];
    const summary = {
        total_masuk: txData?.total_masuk || 0,
        total_keluar: txData?.total_keluar || 0,
        saldo_akhir: txData?.saldo_akhir || 0,
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/finance');
        }
    };

    // Form states
    const [transferForm, setTransferForm] = useState({
        dari: 'cash' as KasBankJenis,
        ke: 'bank_bca' as KasBankJenis,
        nominal: '',
        keterangan: '',
    });

    const [modalForm, setModalForm] = useState({
        jenis: 'cash' as KasBankJenis,
        nominal: '',
        keterangan: 'Setoran Modal',
    });

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['65%', '85%'], []);
    const [actionLoading, setActionLoading] = useState(false);
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

    const [sheetVisible, setSheetVisible] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchTx(), refetchBalances()]);
        setRefreshing(false);
    }, [refetchTx, refetchBalances]);

    const handleOpenSheet = (m: 'transfer' | 'modal') => {
        setMode(m);
        setIsSheetOpen(true);
        if (Platform.OS === 'web') {
            setSheetVisible(true);
        } else {
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = () => {
        setIsSheetOpen(false);
        if (Platform.OS === 'web') {
            setSheetVisible(false);
        } else {
            bottomSheetRef.current?.close();
        }
    };

    const handleTransfer = async () => {
        if (!transferForm.nominal || !transferForm.keterangan) return;
        try {
            await transferMutation.mutateAsync({
                dari: transferForm.dari,
                ke: transferForm.ke,
                nominal: parseNumber(transferForm.nominal),
                tanggal: new Date().toISOString().split('T')[0],
                keterangan: transferForm.keterangan,
            });
            handleCloseSheet();
            setTransferForm({ dari: 'cash', ke: 'bank_bca', nominal: '', keterangan: '' });
            setDialogConfig({
                visible: true,
                title: "Sukses",
                message: "Transfer berhasil dilakukan",
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            console.error('Transfer failed:', error);
            setDialogConfig({
                visible: true,
                title: "Transfer Gagal",
                message: getErrorMessage(error, "Gagal melakukan transfer"),
                variant: 'error',
                type: 'alert'
            });
        }
    };

    const handleCreateModal = async () => {
        if (!modalForm.nominal || !modalForm.keterangan) return;
        try {
            await createTxMutation.mutateAsync({
                tanggal: new Date().toISOString().split('T')[0],
                jenis: modalForm.jenis,
                tipe: 'masuk',
                nominal: parseNumber(modalForm.nominal),
                sumber: 'modal',
                keterangan: modalForm.keterangan,
            });
            handleCloseSheet();
            setModalForm({ jenis: 'cash', nominal: '', keterangan: 'Setoran Modal' });
            setDialogConfig({
                visible: true,
                title: "Sukses",
                message: "Setoran modal berhasil disimpan",
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            console.error('Modal entry failed:', error);
            setDialogConfig({
                visible: true,
                title: "Gagal",
                message: getErrorMessage(error, "Gagal menyimpan setoran modal"),
                variant: 'error',
                type: 'alert'
            });
        }
    };

    const renderTransaction = ({ item }: { item: KasBankTransaction }) => {
        const isIncome = item.tipe === 'masuk';
        return (
            <Card className="mb-3 p-4">
                <View className="flex-row items-center">
                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isIncome ? 'bg-green-50' : 'bg-red-50'}`}>
                        {isIncome ? (
                            <ArrowDownCircle size={20} color="#10B981" />
                        ) : (
                            <ArrowUpCircle size={20} color="#EF4444" />
                        )}
                    </View>
                    <View className="flex-1">
                        <View className="flex-row justify-between items-start">
                            <View className="flex-1 mr-2">
                                <Typography variant="body2" weight="medium" numberOfLines={1}>
                                    {item.keterangan}
                                </Typography>
                                <Typography variant="caption" className="text-gray-400 mt-0.5">
                                    {new Date(item.tanggal).toLocaleDateString('id-ID')} • {JENIS_LABEL[item.jenis]}
                                </Typography>
                            </View>
                            <View className="items-end">
                                <Typography
                                    variant="body2"
                                    weight="bold"
                                    className={isIncome ? 'text-green-600' : 'text-red-600'}
                                >
                                    {isIncome ? '+' : '-'}{formatCurrency(item.nominal)}
                                </Typography>
                                <Typography variant="caption" className="text-gray-400">
                                    {formatCurrency(item.saldo_sesudah)}
                                </Typography>
                            </View>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    const renderSheetContent = () => (
        <View className="p-6">
            {/* Tab Toggle */}
            <Tabs
                items={[
                    { label: 'Transfer', value: 'transfer', icon: ArrowRightLeft },
                    { label: 'Setoran Modal', value: 'modal', icon: PlusCircle },
                ]}
                value={mode}
                onChange={(v) => setMode(v as 'transfer' | 'modal')}
                className="mb-8"
            />

            {mode === 'transfer' ? (
                <>
                    <Typography variant="h2" weight="bold" className="mb-6">Transfer Antar Akun</Typography>

                    <Typography variant="caption" weight="medium" className="mb-2 text-gray-500">Dari Akun</Typography>
                    <View className="flex-row flex-wrap mb-4">
                        {(['cash', 'bank_bca'] as KasBankJenis[]).map((jenis) => (
                            <TouchableOpacity
                                key={jenis}
                                onPress={() => setTransferForm((p) => ({ ...p, dari: jenis }))}
                                className={`px-4 py-2 rounded-full mr-2 mb-2 border ${transferForm.dari === jenis ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight={transferForm.dari === jenis ? 'bold' : 'medium'}
                                    className={transferForm.dari === jenis ? 'text-white' : 'text-gray-600'}
                                >
                                    {JENIS_LABEL[jenis]}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Typography variant="caption" weight="medium" className="mb-2 text-gray-500">Ke Akun</Typography>
                    <View className="flex-row flex-wrap mb-4">
                        {(['cash', 'bank_bca'] as KasBankJenis[]).filter(j => j !== transferForm.dari).map((jenis) => (
                            <TouchableOpacity
                                key={jenis}
                                onPress={() => setTransferForm((p) => ({ ...p, ke: jenis }))}
                                className={`px-4 py-2 rounded-full mr-2 mb-2 border ${transferForm.ke === jenis ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight={transferForm.ke === jenis ? 'bold' : 'medium'}
                                    className={transferForm.ke === jenis ? 'text-white' : 'text-gray-600'}
                                >
                                    {JENIS_LABEL[jenis]}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Input
                        label="Nominal (Rp)"
                        keyboardType="numeric"
                        placeholder="0"
                        value={transferForm.nominal}
                        onChangeText={(v) => setTransferForm((p) => ({ ...p, nominal: formatNumber(v) }))}
                    />

                    <Input
                        label="Keterangan"
                        placeholder="Contoh: Setor ke bank"
                        value={transferForm.keterangan}
                        onChangeText={(v) => setTransferForm((p) => ({ ...p, keterangan: v }))}
                    />

                    <Button
                        title={transferMutation.isPending ? 'Memproses...' : 'Transfer'}
                        onPress={handleTransfer}
                        disabled={transferMutation.isPending || !transferForm.nominal || !transferForm.keterangan}
                        loading={transferMutation.isPending}
                        className="mt-4"
                    />
                </>
            ) : (
                <>
                    <Typography variant="h2" weight="bold" className="mb-6">Setoran Modal Owner</Typography>

                    <Typography variant="caption" weight="medium" className="mb-2 text-gray-500">Simpan ke Akun</Typography>
                    <View className="flex-row flex-wrap mb-4">
                        {(['cash', 'bank_bca'] as KasBankJenis[]).map((jenis) => (
                            <TouchableOpacity
                                key={jenis}
                                onPress={() => setModalForm((p) => ({ ...p, jenis }))}
                                className={`px-4 py-2 rounded-full mr-2 mb-2 border ${modalForm.jenis === jenis ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-200'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight={modalForm.jenis === jenis ? 'bold' : 'medium'}
                                    className={modalForm.jenis === jenis ? 'text-white' : 'text-gray-600'}
                                >
                                    {JENIS_LABEL[jenis]}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Input
                        label="Nominal Modal (Rp)"
                        keyboardType="numeric"
                        placeholder="0"
                        value={modalForm.nominal}
                        onChangeText={(v) => setModalForm((p) => ({ ...p, nominal: formatNumber(v) }))}
                    />

                    <Input
                        label="Keterangan / Catatan"
                        placeholder="Contoh: Tambah modal awal tahun"
                        value={modalForm.keterangan}
                        onChangeText={(v) => setModalForm((p) => ({ ...p, keterangan: v }))}
                    />

                    <Button
                        title={createTxMutation.isPending ? 'Memproses...' : 'Simpan Modal'}
                        onPress={handleCreateModal}
                        disabled={createTxMutation.isPending || !modalForm.nominal || !modalForm.keterangan}
                        loading={createTxMutation.isPending}
                        className="mt-4"
                        variant="primary"
                    />
                </>
            )}
        </View>
    );


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Mutasi Kas</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Ringkasan Arus Keuangan</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <RefreshCw size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Balance Insight Card (Glassmorphism) */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Total Likuiditas</Typography>
                        </View>
                        <Typography className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Saldo Saat Ini</Typography>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View>
                            <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter">
                                {formatCurrency((balances?.cash?.saldo || 0) + (balances?.bank_bca?.saldo || 0))}
                            </Typography>
                            <Typography className="text-white/40 text-xs mt-1">Akumulasi Seluruh Akun</Typography>
                        </View>
                        <View className="bg-white/10 p-4 rounded-2xl border border-white/10">
                            <Wallet size={24} color="white" />
                        </View>
                    </View>

                    {/* Bento Stats Row Inside Header */}
                    <View className="h-[1px] bg-white/10 my-6" />
                    <View className="flex-row justify-between">
                        <View className="flex-1">
                            <View className="flex-row items-center mb-1">
                                <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                                <Typography className="text-white/30 text-[9px] uppercase font-bold tracking-widest">Total Masuk</Typography>
                            </View>
                            <Typography weight="bold" className="text-white text-sm">{formatCurrency(summary.total_masuk)}</Typography>
                        </View>
                        <View className="flex-1 items-end pl-4 border-l border-white/5">
                            <View className="flex-row items-center mb-1">
                                <View className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
                                <Typography className="text-white/30 text-[9px] uppercase font-bold tracking-widest">Total Keluar</Typography>
                            </View>
                            <Typography weight="bold" className="text-rose-300 text-sm">{formatCurrency(summary.total_keluar)}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Account & Search Navigator Overlay */}
            {!isSheetOpen && (
                <View className="px-6 -mt-8 z-10">
                    <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-col">
                        <Tabs
                            items={ACCOUNT_FILTERS}
                            value={selectedFilter}
                            onChange={(v) => setSelectedFilter(v as KasBankJenis | 'all')}
                            className="mb-2"
                        />

                        <View className="flex-row items-center px-4 bg-gray-50 h-14 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <Typography className="ml-3 text-sm text-gray-400 font-medium">Cari riwayat transaksi...</Typography>
                        </View>
                    </View>
                </View>
            )}

            {/* Transaction List */}
            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                    const isIncome = item.tipe === 'masuk';
                    return (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            {/* Visual Indicator Slot */}
                            <View className={`w-14 h-14 rounded-[20px] items-center justify-center mr-4 border ${isIncome ? 'bg-emerald-50 border-emerald-100/50' : 'bg-rose-50 border-rose-100/50'}`}>
                                {isIncome ? (
                                    <ArrowDownLeft size={24} color="#10B981" strokeWidth={2.5} />
                                ) : (
                                    <ArrowUpRight size={24} color="#EF4444" strokeWidth={2.5} />
                                )}
                            </View>

                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-1 mr-2">
                                        <Typography variant="body1" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                            {item.keterangan}
                                        </Typography>
                                    </View>
                                    <View className={isIncome ? "bg-emerald-50 px-2 py-1 rounded-lg" : "bg-rose-50 px-2 py-1 rounded-lg"}>
                                        <Typography weight="bold" className={isIncome ? "text-emerald-600 text-[9px]" : "text-rose-600 text-[9px]"}>
                                            {isIncome ? 'MASUK' : 'KELUAR'}
                                        </Typography>
                                    </View>
                                </View>

                                <Typography variant="caption" className="text-textGray mb-3">
                                    {JENIS_LABEL[item.jenis]} • Ref: #{item.id}
                                </Typography>

                                {/* Footer Financial Row */}
                                <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
                                    <View className="flex-row items-center">
                                        <Calendar size={12} color="#9CA3AF" />
                                        <Typography className="text-textGray/60 text-[10px] ml-1.5 font-bold uppercase tracking-widest">
                                            {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Typography>
                                    </View>
                                    <Typography weight="bold" className={isIncome ? "text-emerald-600 text-sm" : "text-rose-600 text-sm"}>
                                        {isIncome ? '+' : '-'}{formatCurrency(item.nominal)}
                                    </Typography>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
                ListHeaderComponent={
                    isLoadingTx ? (
                        <View className="space-y-6">
                            <SkeletonCard className="rounded-[32px] h-32" />
                            <SkeletonCard className="rounded-[32px] h-32" />
                            <SkeletonCard className="rounded-[32px] h-32" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    isLoadingTx ? null : (
                        <View className="mt-10">
                            <EmptyState
                                title="Belum ada transaksi"
                                description={selectedFilter !== 'all' ? `Belum ada riwayat untuk ${JENIS_LABEL[selectedFilter as KasBankJenis]}` : "Belum ada riwayat transaksi kas & bank."}
                                icon={ArrowRightLeft}
                            />
                        </View>
                    )
                }
            />

            {/* Premium FAB */}
            <TouchableOpacity
                onPress={() => handleOpenSheet('transfer')}
                activeOpacity={0.8}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary border-4 border-white/20"
            >
                <Plus size={32} color="white" strokeWidth={3} />
            </TouchableOpacity>

            {/* Entry UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                    <View className="flex-1 justify-end bg-black/40">
                        <TouchableOpacity className="absolute inset-0" onPress={handleCloseSheet} />
                        <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[85%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView className="flex-1">
                                {renderSheetContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onChange={(index) => setIsSheetOpen(index !== -1)}
                >
                    <BottomSheetScrollView>
                        {renderSheetContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={() => setDialogConfig(p => ({ ...p, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
                loading={actionLoading}
            />
        </View>
    );
}
