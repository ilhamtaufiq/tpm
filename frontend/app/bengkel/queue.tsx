import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    View,
    ScrollView,
    Pressable,
    TextInput,
    StatusBar,
    ActivityIndicator,
    Modal,
    Platform,
    RefreshControl as RNRefreshControl
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog as AlertDialogComponent } from '../../components/ui/AlertDialog';
import {
    ChevronLeft,
    Search,
    X,
    Calendar,
    Clock,
    Plus,
    Package,
    Wrench,
    Receipt,
    Printer,
    Share2,
    Trash2,
    Edit2,
    Banknote,
    Wallet,
    CheckCircle2,
    ChevronRight
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, subDays, addDays } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';
import {
    useTransaksiBengkelList,
    useTransaksiBengkelSummary,
    useUpdateTransaksiBengkelStatus,
    useUpdateTransaksiBengkelPayment,
    useVoidTransaksiBengkel,
    useSparePartsList
} from '../../hooks/useBengkel';
import { useMobilList } from '../../hooks/useMobil';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

export default function QueueScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Filters and search state
    const [date, setDate] = useState(new Date());
    const [queueSearchOpen, setQueueSearchOpen] = useState(false);
    const [queueSearchQuery, setQueueSearchQuery] = useState('');
    const [queueWorkStatusFilter, setQueueWorkStatusFilter] = useState<'ALL' | 'antre' | 'proses' | 'selesai'>('ALL');
    const [queuePaymentFilter, setQueuePaymentFilter] = useState<'ALL' | 'LUNAS' | 'BELUM_LUNAS' | 'BELUM_BAYAR' | 'BATAL'>('ALL');
    const [refreshing, setRefreshing] = useState(false);

    // Detail Modal State
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Payment State
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'TUNAI' | 'TRANSFER' | 'SPLIT'>('TUNAI');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [splitTunai, setSplitTunai] = useState('');
    const [splitTransfer, setSplitTransfer] = useState('');
    const [diskonValue, setDiskonValue] = useState('');
    const [showDiskonInReceipt, setShowDiskonInReceipt] = useState(true);
    const updateTransaksiMutation = useUpdateTransaksiBengkelPayment();
    const queryClient = useQueryClient();

    // Dialog State
    const [dialogConfig, setDialogConfig] = useState<any>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    const formattedDateString = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);

    // Data fetching
    const { data: queueData, isLoading, refetch } = useTransaksiBengkelList({
        tanggal_dari: formattedDateString,
        tanggal_sampai: formattedDateString
    });

    const { data: summary, refetch: refetchSummary } = useTransaksiBengkelSummary({
        tanggal_dari: formattedDateString,
        tanggal_sampai: formattedDateString
    });

    const { data: mobilData } = useMobilList({ status: 'TERJUAL', limit: 100 });

    const updateStatsMutation = useUpdateTransaksiBengkelStatus();
    const voidTransaksiMutation = useVoidTransaksiBengkel();

    const handleVoidTransaction = (item: any) => {
        if (!item?.id) return;
        setDialogConfig({
            visible: true,
            title: 'Batalkan Transaksi?',
            message: `Transaksi ${item.nomor_transaksi} akan dibatalkan dan stok dikembalikan. Lanjutkan?`,
            variant: 'warning',
            onConfirm: async () => {
                try {
                    await voidTransaksiMutation.mutateAsync(item.id);
                    setDetailModalOpen(false);
                    setSelectedItem(null);
                    refetch();
                    refetchSummary();
                    setDialogConfig({
                        visible: true,
                        title: 'Transaksi Dibatalkan',
                        message: `Transaksi ${item.nomor_transaksi} berhasil dibatalkan.`,
                        variant: 'success'
                    });
                } catch (error) {
                    console.error('Failed to void transaction:', error);
                    setDialogConfig({
                        visible: true,
                        title: 'Gagal',
                        message: 'Gagal membatalkan transaksi.',
                        variant: 'error'
                    });
                }
            }
        });
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        await refetchSummary();
        setRefreshing(false);
    }, [refetch, refetchSummary]);

    useFocusEffect(
        useCallback(() => {
            refetch();
            refetchSummary();
        }, [refetch, refetchSummary])
    );

    // Sold cars set to filter out sold items (JB Mobil category)
    const soldCars = useMemo(() => {
        const soldSet = new Set<string>();
        if (mobilData) {
            const rows = Array.isArray(mobilData) ? mobilData : (mobilData.data || []);
            rows.forEach((m: any) => {
                if (m.status?.toUpperCase() === 'TERJUAL') {
                    soldSet.add(String(m.id));
                }
            });
        }
        return soldSet;
    }, [mobilData]);

    const queue = queueData?.data || [];
    const todayQueue = useMemo(() => {
        return queue.filter((item: any) => {
            const kategori = String(item.kategori || '').toLowerCase();
            if (kategori === 'jual_beli_mobil' && item.mobil_id && soldCars.has(String(item.mobil_id))) {
                return false;
            }
            return true;
        });
    }, [queue, soldCars]);

    const getQueuePaymentStatus = useCallback((item: any) => {
        const status = String(item.status_bayar || '').toUpperCase();
        const paidAmount = Number(item.jumlah_bayar || 0);

        if (status === 'BATAL') return 'BATAL';
        if (status === 'LUNAS') return 'LUNAS';
        if (paidAmount > 0) return 'BELUM_LUNAS';
        return 'BELUM_BAYAR';
    }, []);

    const queuePaymentStats = useMemo(() => {
        return todayQueue.reduce((acc: any, item: any) => {
            const status = getQueuePaymentStatus(item);
            acc.total += 1;
            if (status === 'BATAL') acc.BATAL += 1;
            else if (status === 'LUNAS') acc.LUNAS += 1;
            else if (status === 'BELUM_LUNAS') acc.BELUM_LUNAS += 1;
            else acc.BELUM_BAYAR += 1;
            return acc;
        }, { total: 0, LUNAS: 0, BELUM_LUNAS: 0, BELUM_BAYAR: 0, BATAL: 0 });
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

    const handlePrev = () => {
        setDate(curr => subDays(curr, 1));
    };

    const handleNext = () => {
        setDate(curr => addDays(curr, 1));
    };

    const getFormattedDate = () => {
        return format(date, 'dd MMMM yyyy', { locale: localeID });
    };

    const openEditTransaction = (item: any) => {
        if (!item?.id) return;
        setDetailModalOpen(false);
        router.push({ pathname: '/bengkel/order', params: { id: String(item.id) } } as any);
    };

    const openQueueTransactionMode = (mode: 'sparepart' | 'servis', item: any) => {
        setDetailModalOpen(false);
        router.push({ pathname: '/bengkel/transaksi', params: { mode, transactionId: String(item.id) } } as any);
    };

    const updateStatus = async (id: number, newStatus: string) => {
        try {
            await updateStatsMutation.mutateAsync({ id, status: newStatus });
            refetch();
            refetchSummary();
            setDetailModalOpen(false);
            setDialogConfig({
                visible: true,
                title: 'Status Diperbarui',
                message: `Status pengerjaan unit berhasil diubah menjadi ${newStatus.toUpperCase()}`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Failed to update status:', error);
            setDialogConfig({
                visible: true,
                title: 'Gagal Update',
                message: 'Gagal merubah status pengerjaan.',
                variant: 'error'
            });
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View>
                        <Typography variant="h2" weight="bold">Antrian Hari Ini</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">Daftar order & pengerjaan aktif</Typography>
                    </View>
                </View>
                <Pressable
                    onPress={() => router.push('/bengkel/order')}
                    className="bg-primary px-4 py-2 rounded-xl flex-row items-center active:opacity-90"
                >
                    <Plus size={16} color="white" />
                    <Typography weight="bold" className="text-white text-xs ml-1">Order Baru</Typography>
                </Pressable>
            </View>

            {/* Date Picker & Search Row */}
            <View className="p-6 bg-white border-b border-gray-50">
                <View className="flex-row justify-between items-center mb-4">
                    <Pressable
                        onPress={handlePrev}
                        className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                    >
                        <ChevronLeft size={20} color="#1C1C1C" />
                    </Pressable>

                    <View className="flex-row items-center">
                        <Calendar size={18} color="#023C69" className="mr-2" />
                        <Typography variant="body1" weight="bold" className="text-textMain">
                            {getFormattedDate()}
                        </Typography>
                    </View>

                    <Pressable
                        onPress={handleNext}
                        className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                    >
                        <ChevronRight size={20} color="#1C1C1C" />
                    </Pressable>
                </View>

                {/* Search Toggle */}
                <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        value={queueSearchQuery}
                        onChangeText={setQueueSearchQuery}
                        placeholder="Cari plat, customer, nomor transaksi..."
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-3 text-sm font-medium text-textMain"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {queueSearchQuery.length > 0 && (
                        <Pressable onPress={() => setQueueSearchQuery('')} className="p-1">
                            <X size={16} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Scrollable Filters */}
            <View className="bg-white py-3 border-b border-gray-100">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mb-2">
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
                                className={`px-4 py-2 rounded-full border mr-2 ${isActive ? filter.active : filter.inactive}`}
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

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
                    {[
                        { id: 'ALL', label: 'Semua Bayar', count: queuePaymentStats.total, active: 'bg-primary border-primary', inactive: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
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
                                className={`px-4 py-2 rounded-full border mr-2 ${isActive ? filter.active : filter.inactive}`}
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
            </View>

            {/* List View */}
            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color="#023C69" />
                        <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MEMUAT DATA...</Typography>
                    </View>
                ) : queueSheetItems.length === 0 ? (
                    <EmptyState
                        title="Antrian Masih Kosong"
                        description="Tidak ada data antrian untuk periode ini."
                        icon={Clock}
                    />
                ) : (
                    queueSheetItems.map((item: any) => {
                        const paymentStatus = getQueuePaymentStatus(item);
                        return (
                            <Pressable
                                key={item.id}
                                onPress={() => {
                                    setSelectedItem(item);
                                    setDetailModalOpen(true);
                                }}
                                className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center active:scale-[0.98] transition-transform"
                            >
                                <View className="w-14 h-14 bg-emerald-50 rounded-2xl items-center justify-center mr-4 border border-emerald-100/70">
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
                                        </View>
                                        <Badge
                                            label={(item.status_pengerjaan || '').toUpperCase()}
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
                                                { label: 'Servis', mode: 'servis', icon: Wrench, color: '#2563EB' },
                                            ].map((action) => {
                                                const ActionIcon = action.icon;
                                                return (
                                                    <Pressable
                                                        key={action.label}
                                                        onPress={(event: any) => {
                                                            event?.stopPropagation?.();
                                                            openQueueTransactionMode(action.mode as 'sparepart' | 'servis', item);
                                                        }}
                                                        className="flex-1 mr-2 h-9 rounded-xl bg-gray-50 border border-gray-100 flex-row items-center justify-center active:scale-95"
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
                        );
                    })
                )}
                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 24) }} />
            </ScrollView>

            {/* Queue Detail Modal */}
            {selectedItem && (
                <Modal
                    visible={detailModalOpen}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setDetailModalOpen(false)}
                    statusBarTranslucent
                >
                    <View className="flex-1 justify-end bg-black/50">
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setDetailModalOpen(false)} />
                        <View className="bg-white rounded-t-[48px] p-6 max-h-[85%] overflow-hidden">
                            <View className="flex-row justify-between items-center mb-6">
                                <View>
                                    <Typography variant="h3" weight="bold">Detail Antrian</Typography>
                                    <Typography className="text-gray-400 text-xs mt-0.5">Rincian status & transaksi customer</Typography>
                                </View>
                                <Pressable onPress={() => setDetailModalOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <X size={18} color="#4B5563" />
                                </Pressable>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="flex-row justify-between items-start mb-4">
                                    <View className="flex-1 mr-3">
                                        <Typography variant="h2" weight="bold" className="text-xl tracking-tight">{selectedItem.nomor_plat}</Typography>
                                        <Typography variant="caption" className="text-textGray mt-0.5">
                                            {selectedItem.jenis_kendaraan} - {selectedItem.nama_customer || 'Umum'}
                                        </Typography>
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

                                {/* Item Order Card */}
                                <Card variant="outlined" className="p-4 border-gray-100 mb-4 bg-gray-50/60 rounded-2xl">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <View className="flex-row items-center">
                                            <Receipt size={15} color="#023C69" />
                                            <Typography variant="caption" weight="bold" className="ml-2 text-primary uppercase tracking-widest">Rincian Item</Typography>
                                        </View>
                                        <Typography variant="caption" className="text-textGray">
                                            {(selectedItem?.detail_services?.length || selectedItem?.detail_services?.length || 0) + (selectedItem?.detail_parts?.length || selectedItem?.detail_parts?.length || 0)} baris
                                        </Typography>
                                    </View>

                                    {((selectedItem?.detail_services || selectedItem?.detail_services) || []).map((s: any, idx: number) => (
                                        <View key={`svc-${idx}`} className="flex-row justify-between items-center py-1.5 border-t border-gray-100">
                                            <View className="flex-1 mr-3">
                                                <Typography variant="body2" weight="semibold" className="text-textMain" numberOfLines={1}>{s.nama_jasa}</Typography>
                                                <Typography variant="caption" className="text-textGray/70">Jasa</Typography>
                                            </View>
                                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(s.harga)}</Typography>
                                        </View>
                                    ))}

                                    {((selectedItem?.detail_parts || selectedItem?.detail_parts) || []).map((p: any, idx: number) => (
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
                                </Card>

                                {/* Customer Details Card */}
                                <Card variant="outlined" className="p-4 border-gray-100 mb-4 bg-white rounded-2xl">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <View className="flex-row items-center">
                                            <Typography variant="caption" weight="bold" className="text-primary uppercase tracking-widest">Detail Pelanggan</Typography>
                                        </View>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography variant="caption" className="text-textGray">Nama</Typography>
                                        <Typography variant="body2" weight="medium" className="text-textMain">
                                            {selectedItem?.nama_customer || selectedItem?.customer_nama || '-'}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography variant="caption" className="text-textGray">No. Polisi</Typography>
                                        <Typography variant="body2" weight="medium" className="text-textMain">
                                            {selectedItem?.nomor_plat || '-'}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography variant="caption" className="text-textGray">Jenis Kendaraan</Typography>
                                        <Typography variant="body2" weight="medium" className="text-textMain">
                                            {selectedItem?.jenis_kendaraan || '-'}
                                        </Typography>
                                    </View>
                                </Card>

                                {/* Status Update */}
                                {['antre', 'proses'].includes(String(selectedItem.status_pengerjaan || '').toLowerCase()) && (
                                    <View className="mb-4">
                                        <Typography variant="caption" weight="bold" className="mb-2 text-textGray uppercase tracking-widest px-1">Ubah Status</Typography>
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
                                )}

                                {/* Payment Summary Card */}
                                <Card variant="outlined" className="p-4 border-gray-100 mb-4 bg-emerald-50/60 rounded-2xl">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Typography variant="body2" weight="bold" className="text-emerald-800">Total Tagihan</Typography>
                                        <Typography variant="h4" weight="bold" className="text-emerald-800">{formatCurrency((selectedItem?.grand_total ?? selectedItem?.grand_total) || 0)}</Typography>
                                    </View>
                                    {(selectedItem?.jumlah_bayar || selectedItem?.jumlah_bayar || 0) > 0 && (
                                        <>
                                            <View className="flex-row items-center justify-between mb-1">
                                                <Typography className="text-emerald-600 text-xs">DP Dibayar</Typography>
                                                <Typography className="text-emerald-600 text-xs font-bold">-{formatCurrency(selectedItem?.jumlah_bayar || selectedItem?.jumlah_bayar || 0)}</Typography>
                                            </View>
                                            <View className="flex-row items-center justify-between pt-2 border-t border-emerald-200">
                                                <Typography variant="body2" weight="bold" className="text-emerald-800">Sisa Bayar</Typography>
                                                <Typography variant="h4" weight="bold" className="text-emerald-800">
                                                    {formatCurrency(Math.max(0, ((selectedItem?.grand_total ?? selectedItem?.grand_total) || 0) - (selectedItem?.jumlah_bayar || selectedItem?.jumlah_bayar || 0)))}
                                                </Typography>
                                            </View>
                                        </>
                                    )}
                                </Card>

                                {/* Action Buttons */}
                                <View className="flex-row space-x-3 mb-4">
                                    {selectedItem.status_bayar !== 'LUNAS' && (
                                        <Pressable
                                            onPress={() => openEditTransaction(selectedItem)}
                                            className="flex-1 bg-amber-500 py-3 rounded-xl items-center justify-center flex-row active:opacity-90"
                                        >
                                            <Edit2 size={16} color="white" />
                                            <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                                Edit
                                            </Typography>
                                        </Pressable>
                                    )}

                                    {selectedItem.status_bayar !== 'LUNAS' && selectedItem.grand_total > 0 ? (
                                        <Pressable
                                            onPress={() => { setPaymentAmount(''); setSplitTunai(''); setSplitTransfer(''); setPaymentMode('TUNAI'); setDiskonValue(''); setShowDiskonInReceipt(true); setPaymentSheetOpen(true); }}
                                            className="flex-1 bg-emerald-600 py-3 rounded-xl items-center justify-center flex-row active:opacity-90"
                                        >
                                            <Wallet size={16} color="white" />
                                            <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                                Pelunasan
                                            </Typography>
                                        </Pressable>
                                    ) : (
                                        <View className="flex-1 py-3 rounded-xl items-center justify-center flex-row bg-gray-100">
                                            <CheckCircle2 size={16} color="#10B981" />
                                            <Typography weight="bold" className="text-emerald-600 text-xs ml-2 uppercase tracking-widest">
                                                LUNAS
                                            </Typography>
                                        </View>
                                    )}
                                </View>

                                <View className="flex-row space-x-3 mb-4">
                                    <Pressable
                                        onPress={() => {
                                            setDetailModalOpen(false);
                                            router.push(`/receipt/bengkel/${selectedItem?.public_receipt_token || selectedItem.public_receipt_token}`);
                                        }}
                                        className="flex-1 bg-primary py-3.5 rounded-xl items-center justify-center flex-row active:opacity-90 border border-primary/20"
                                    >
                                        <Printer size={16} color="white" />
                                        <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                            Print Struk
                                        </Typography>
                                    </Pressable>
                                </View>

                                {/* Share Struk Public */}
                                {(selectedItem?.public_receipt_token || selectedItem.public_receipt_token) && (
                                    <Pressable
                                        onPress={() => {
                                            setDetailModalOpen(false);
                                            router.push(`/receipt/bengkel/${selectedItem?.public_receipt_token || selectedItem.public_receipt_token}`);
                                        }}
                                        className="bg-primary py-3.5 rounded-2xl items-center justify-center flex-row active:opacity-90 border border-primary/20"
                                    >
                                        <Share2 size={16} color="white" />
                                        <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                            Share Struk Public
                                        </Typography>
                                    </Pressable>
                                )}

                                <Pressable
                                    onPress={() => handleVoidTransaction(selectedItem)}
                                    className="mt-3 bg-rose-600 py-3.5 rounded-2xl items-center justify-center flex-row active:opacity-90"
                                >
                                    <Trash2 size={16} color="white" />
                                    <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                        Void Transaksi
                                    </Typography>
                                </Pressable>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Payment Sheet Modal */}
            {selectedItem && (
                <Modal visible={paymentSheetOpen} transparent animationType="slide" onRequestClose={() => setPaymentSheetOpen(false)} statusBarTranslucent>
                    <View className="flex-1 justify-end bg-black/50">
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setPaymentSheetOpen(false)} />
                        <View className="bg-white rounded-t-[48px] p-6 max-h-[85%] overflow-hidden">
                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h3" weight="bold">Pembayaran</Typography>
                                <Pressable onPress={() => setPaymentSheetOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <X size={18} color="#4B5563" />
                                </Pressable>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="bg-emerald-50 p-4 rounded-2xl mb-5">
                                    <Typography className="text-emerald-700 text-xs">Total Tagihan</Typography>
                                    <Typography variant="h3" weight="bold" className="text-emerald-800">{formatCurrency(selectedItem.grand_total || 0)}</Typography>
                                    {(selectedItem.jumlah_bayar || 0) > 0 && (
                                        <View className="flex-row justify-between mt-2 pt-2 border-t border-emerald-200">
                                            <Typography className="text-emerald-600 text-xs">DP: {formatCurrency(selectedItem.jumlah_bayar)}</Typography>
                                            <Typography className="text-emerald-700 text-xs font-bold">
                                                Sisa: {formatCurrency(Math.max(0, (selectedItem.grand_total || 0) - (selectedItem.jumlah_bayar || 0)))}
                                            </Typography>
                                        </View>
                                    )}
                                </View>

                                {/* Diskon Field + Toggle Struk */}
                                <View className="mb-5">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Typography variant="caption" weight="semibold" className="text-gray-600 ml-1">Diskon (Rp)</Typography>
                                        <Pressable onPress={() => setShowDiskonInReceipt(!showDiskonInReceipt)} className="flex-row items-center">
                                            <View className={`w-5 h-5 rounded border-2 items-center justify-center mr-1 ${showDiskonInReceipt ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                                {showDiskonInReceipt && <CheckCircle2 size={14} color="white" />}
                                            </View>
                                            <Typography className="text-gray-500 text-[10px]">Tampilkan di struk</Typography>
                                        </Pressable>
                                    </View>
                                    <TextInput
                                        placeholder="0"
                                        keyboardType="number-pad"
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 text-sm font-bold"
                                        value={diskonValue}
                                        onChangeText={(t) => {
                                            const cleaned = t.replace(/[^0-9]/g, '');
                                            setDiskonValue(cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                        }}
                                    />
                                </View>

                                {/* Payment Summary with Diskon */}
                                {diskonValue && parseNumber(diskonValue) > 0 && (
                                    <View className="bg-amber-50 p-4 rounded-2xl mb-5 border border-amber-100">
                                        <View className="flex-row justify-between mb-1">
                                            <Typography className="text-amber-700 text-xs">Total Tagihan</Typography>
                                            <Typography className="text-amber-800 text-xs font-bold">{formatCurrency(selectedItem.grand_total || 0)}</Typography>
                                        </View>
                                        <View className="flex-row justify-between mb-1">
                                            <Typography className="text-amber-700 text-xs">Diskon</Typography>
                                            <Typography className="text-amber-700 text-xs font-bold">-{formatCurrency(parseNumber(diskonValue))}</Typography>
                                        </View>
                                        <View className="flex-row justify-between mb-1">
                                            <Typography className="text-amber-700 text-xs">DP Sebelumnya</Typography>
                                            <Typography className="text-amber-700 text-xs font-bold">{formatCurrency(selectedItem.jumlah_bayar || 0)}</Typography>
                                        </View>
                                        <View className="flex-row justify-between pt-2 border-t border-amber-200">
                                            <Typography className="text-amber-800 text-xs font-bold">Sisa Bayar</Typography>
                                            <Typography className="text-amber-800 text-xs font-bold">
                                                {formatCurrency(Math.max(0, (selectedItem.grand_total || 0) - parseNumber(diskonValue) - (selectedItem.jumlah_bayar || 0)))}
                                            </Typography>
                                        </View>
                                    </View>
                                )}

                                {/* Payment Mode Selector */}
                                <Typography variant="caption" weight="semibold" className="text-gray-600 mb-2 ml-1">Metode Pembayaran</Typography>
                                <View className="flex-row space-x-2 mb-4">
                                    {[
                                        { id: 'TUNAI', label: 'Tunai', icon: Banknote },
                                        { id: 'TRANSFER', label: 'Transfer', icon: Wallet },
                                        { id: 'SPLIT', label: 'Split', icon: ChevronRight },
                                    ].map((mode) => {
                                        const Icon = mode.icon;
                                        const aktif = paymentMode === mode.id;
                                        return (
                                            <Pressable key={mode.id} onPress={() => { setPaymentMode(mode.id as any); }} className={`flex-1 py-3 rounded-2xl border items-center ${aktif ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}>
                                                <Icon size={18} color={aktif ? 'white' : '#64748B'} />
                                                <Typography weight="bold" className={`text-[10px] mt-1 ${aktif ? 'text-white' : 'text-gray-500'}`}>{mode.label}</Typography>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {/* Hitung sisa dulu */}
                                {(() => {
                                    const diskonAmt = parseNumber(diskonValue);
                                    const grandTotal = (selectedItem.grand_total || 0) - diskonAmt;
                                    const sisa = Math.max(0, grandTotal - (selectedItem.jumlah_bayar || 0));
                                    return null;
                                })()}

                                {paymentMode === 'SPLIT' ? (
                                    <>
                                        <View className="mb-3">
                                            <Typography variant="caption" weight="semibold" className="text-gray-600 mb-1 ml-1">Tunai (Rp)</Typography>
                                            <TextInput
                                                placeholder="0" keyboardType="number-pad"
                                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 text-sm font-bold"
                                                value={splitTunai}
                                                onChangeText={(t) => {
                                                    const cleaned = t.replace(/[^0-9]/g, '');
                                                    setSplitTunai(cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                                }}
                                            />
                                        </View>
                                        <View className="mb-4">
                                            <Typography variant="caption" weight="semibold" className="text-gray-600 mb-1 ml-1">Transfer (Rp)</Typography>
                                            <TextInput
                                                placeholder="0" keyboardType="number-pad"
                                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 text-sm font-bold"
                                                value={splitTransfer}
                                                onChangeText={(t) => {
                                                    const cleaned = t.replace(/[^0-9]/g, '');
                                                    setSplitTransfer(cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                                }}
                                            />
                                        </View>
                                    </>
                                ) : (
                                    <View className="mb-4">
                                        <Typography variant="caption" weight="semibold" className="text-gray-600 mb-1 ml-1">Nominal Pembayaran (Rp)</Typography>
                                        <TextInput
                                            placeholder="0" keyboardType="number-pad"
                                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 text-sm font-bold"
                                            value={paymentAmount}
                                            onChangeText={(t) => {
                                                const cleaned = t.replace(/[^0-9]/g, '');
                                                setPaymentAmount(cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                            }}
                                        />
                                    </View>
                                )}

                                {/* Kembalian preview */}
                                {paymentMode !== 'SPLIT' && paymentAmount && parseNumber(paymentAmount) > 0 && (() => {
                                    const diskonAmt = parseNumber(diskonValue);
                                    const grandTotal = (selectedItem.grand_total || 0) - diskonAmt;
                                    const sisa = Math.max(0, grandTotal - (selectedItem.jumlah_bayar || 0));
                                    const dibayar = parseNumber(paymentAmount);
                                    const kembalian = dibayar - sisa;
                                    return kembalian > 0 ? (
                                        <View className="bg-blue-50 p-3 rounded-2xl mb-5 border border-blue-100 flex-row justify-between">
                                            <Typography className="text-blue-700 text-xs font-bold">Kembalian</Typography>
                                            <Typography className="text-blue-800 text-xs font-bold">{formatCurrency(kembalian)}</Typography>
                                        </View>
                                    ) : null;
                                })()}

                                <Button
                                    title="Konfirmasi Pembayaran"
                                    className="mb-4"
                                    loading={updateTransaksiMutation.isPending}
                                    onPress={async () => {
                                        const diskonAmt = parseNumber(diskonValue);
                                        const grandTotal = (selectedItem.grand_total || 0) - diskonAmt;
                                        if (grandTotal < 0) {
                                            setDialogConfig({ visible: true, title: 'Validasi', message: 'Diskon melebihi total tagihan.', variant: 'warning' });
                                            return;
                                        }
                                        const sudahBayar = selectedItem.jumlah_bayar || 0;
                                        const sisa = Math.max(0, grandTotal - sudahBayar);
                                        let paymentItems: { metode: string; jumlah: number }[] = [];

                                        if (paymentMode === 'SPLIT') {
                                            const tunaiAmt = parseNumber(splitTunai);
                                            const trfAmt = parseNumber(splitTransfer);
                                            if (tunaiAmt > 0) paymentItems.push({ metode: 'TUNAI', jumlah: tunaiAmt });
                                            if (trfAmt > 0) paymentItems.push({ metode: 'TRANSFER', jumlah: trfAmt });
                                            if (paymentItems.length === 0) {
                                                setDialogConfig({ visible: true, title: 'Validasi', message: 'Masukkan nominal Tunai dan/atau Transfer untuk Split Payment.', variant: 'warning' });
                                                return;
                                            }
                                            if (paymentItems.reduce((a, p) => a + p.jumlah, 0) < sisa) {
                                                setDialogConfig({ visible: true, title: 'Validasi', message: 'Jumlah pembayaran split kurang dari sisa tagihan.', variant: 'warning' });
                                                return;
                                            }
                                        } else {
                                            const amt = parseNumber(paymentAmount);
                                            if (amt < sisa) {
                                                setDialogConfig({ visible: true, title: 'Validasi', message: 'Jumlah pembayaran kurang dari sisa tagihan.', variant: 'warning' });
                                                return;
                                            }
                                            paymentItems.push({
                                                metode: paymentMode === 'TUNAI' ? 'TUNAI' : 'TRANSFER',
                                                jumlah: amt,
                                            });
                                        }

                                        if (paymentItems.length === 0) {
                                            setDialogConfig({ visible: true, title: 'Validasi', message: 'Masukkan nominal pembayaran.', variant: 'warning' });
                                            return;
                                        }
                                        try {
                                            const totalBayar = paymentItems.reduce((a, p) => a + p.jumlah, 0);
                                            await updateTransaksiMutation.mutateAsync({
                                                id: selectedItem.id,
                                                data: {
                                                    jumlah_bayar: sudahBayar + totalBayar,
                                                    metode_bayar: paymentMode === 'SPLIT' ? 'SPLIT' : paymentMode,
                                                    diskon: diskonAmt > 0 ? diskonAmt : null,
                                                    payments: paymentItems,
                                                    status_pengerjaan: 'SELESAI',
                                                }
                                            });
                                            setPaymentSheetOpen(false);
                                            setDetailModalOpen(false);
                                            queryClient.invalidateQueries({ queryKey: ['transaksi_bengkel_detail', selectedItem.id] });
                                            refetch();
                                            refetchSummary();
                                            setDialogConfig({
                                                visible: true, title: 'Pembayaran Berhasil',
                                                message: `Transaksi ${selectedItem.nomor_transaksi} berhasil dibayar.`,
                                                variant: 'success'
                                            });
                                        } catch (e) {
                                            setDialogConfig({ visible: true, title: 'Gagal', message: 'Gagal memproses pembayaran.', variant: 'error' });
                                        }
                                    }}
                                />
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Alert Dialog */}
            <Modal
                visible={dialogConfig.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setDialogConfig((prev: any) => ({ ...prev, visible: false }))}
            >
                <AlertDialogComponent
                    visible={dialogConfig.visible}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    variant={dialogConfig.variant}
                    type="alert"
                    onClose={() => setDialogConfig((prev: any) => ({ ...prev, visible: false }))}
                />
            </Modal>
        </SafeAreaView>
    );
}
