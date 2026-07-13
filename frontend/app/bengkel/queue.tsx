import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View, ScrollView, Pressable, TextInput, Modal, StatusBar, ActivityIndicator, Platform, Share, FlatList, RefreshControl as RNRefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { AlertDialog as AlertDialogComponent } from '../../components/ui/AlertDialog';
import { BoundedSheetPanel, BoundedSheetScrollView } from '../../components/ui/BottomSheetContainer';
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
    ChevronRight,
    CheckCircle2,
    Wallet,
    ListOrdered,
    Banknote,
    Car,
    TrendingUp,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, subDays, addDays } from 'date-fns';
import { BengkelPaymentModal, PaymentItem } from '../../components/BengkelPaymentModal';
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
import { formatCurrency, formatNumber } from '../../utils/format';
import {
    buildSoldMobilIdSet,
    formatBengkelWorkStatusLabel,
    formatBengkelPaymentStatusLabel,
    getBengkelQueuePaymentStatus,
    isBengkelTransactionLocked,
    isBengkelTransactionVoided,
} from '../../utils/bengkelTransaction';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { printReceipt } from '../../utils/printReceipt';
import { buildBengkelPrintData } from '../../utils/buildPrintReceiptData';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import {
    buildPublicReceiptShareUrl,
    sharePublicReceiptLink,
} from '../../utils/sharePublicReceipt';
import { getErrorMessage } from '../../utils/error';

export default function QueueScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Filters and search state
    const [date, setDate] = useState(new Date());
    const [queueSearchQuery, setQueueSearchQuery] = useState('');
    const [queueWorkStatusFilter, setQueueWorkStatusFilter] = useState<'ALL' | 'antre' | 'proses' | 'selesai' | 'batal'>('ALL');
    const [queuePaymentFilter, setQueuePaymentFilter] = useState<'ALL' | 'LUNAS' | 'BELUM_LUNAS' | 'BELUM_BAYAR' | 'BATAL'>('ALL');
    const [refreshing, setRefreshing] = useState(false);

    // Detail Modal State
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Print State
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [printing, setPrinting] = useState(false);

    // Payment State
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
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

    useEffect(() => {
        printSettingsService.getSettings()
            .then(setPrintSettings)
            .catch((error) => console.error('Failed to load print settings:', error));
    }, []);

    // Data fetching
    const { data: queueData, isLoading, refetch } = useTransaksiBengkelList({
        tanggal_dari: formattedDateString,
        tanggal_sampai: formattedDateString
    });

    const { data: summary, refetch: refetchSummary } = useTransaksiBengkelSummary({
        tanggal_dari: formattedDateString,
        tanggal_sampai: formattedDateString
    });

    const { data: mobilData } = useMobilList({ status: 'TERJUAL', limit: 500 });

    const updateStatsMutation = useUpdateTransaksiBengkelStatus();
    const voidTransaksiMutation = useVoidTransaksiBengkel();

    const handleVoidTransaction = (item: any) => {
        if (!item?.id) return;
        setDetailModalOpen(false);
        setDialogConfig({
            visible: true,
            title: 'Batalkan Transaksi?',
            message: `Transaksi ${item.nomor_transaksi} akan dibatalkan dan stok dikembalikan. Lanjutkan?`,
            variant: 'warning',
            onConfirm: async () => {
                try {
                    await voidTransaksiMutation.mutateAsync(item.id);
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

    // Mobil TERJUAL dipakai untuk menampilkan status bayar lunas (bukan menyembunyikan antrian).
    const soldCars = useMemo(() => {
        const rows = Array.isArray(mobilData) ? mobilData : (mobilData?.data || []);
        return buildSoldMobilIdSet(rows);
    }, [mobilData]);

    const queue = queueData?.data || [];
    const todayQueue = queue;

    const getQueuePaymentStatus = useCallback((item: any) => {
        return getBengkelQueuePaymentStatus(item, soldCars);
    }, [soldCars]);

    const getPaidSummary = useCallback((item: any) => {
        const paid = Number(item?.jumlah_bayar || 0);
        const total = Number(item?.grand_total || 0);
        const paymentStatus = getBengkelQueuePaymentStatus(item, soldCars);
        const isInternal = paymentStatus === 'INTERNAL';
        const isLunas = paymentStatus === 'LUNAS';
        return {
            paid: isLunas && paid < total ? total : paid,
            total,
            isLunas,
            isInternal,
            hasPartialPayment: paymentStatus === 'BELUM_LUNAS',
            remaining: isInternal || isLunas ? 0 : Math.max(0, total - paid),
        };
    }, [soldCars]);

    const queuePaymentStats = useMemo(() => {
        return todayQueue.reduce((acc: any, item: any) => {
            const status = getQueuePaymentStatus(item);
            acc.total += 1;
            if (status === 'BATAL') acc.BATAL += 1;
            else if (status === 'INTERNAL') acc.INTERNAL += 1;
            else if (status === 'LUNAS') acc.LUNAS += 1;
            else if (status === 'BELUM_LUNAS') acc.BELUM_LUNAS += 1;
            else acc.BELUM_BAYAR += 1;
            return acc;
        }, { total: 0, LUNAS: 0, BELUM_LUNAS: 0, BELUM_BAYAR: 0, BATAL: 0, INTERNAL: 0 });
    }, [getQueuePaymentStatus, todayQueue]);

    const queueWorkStatusStats = useMemo(() => {
        return todayQueue.reduce((acc: any, item: any) => {
            const status = String(item.status_pengerjaan || 'antre').toLowerCase();
            acc.total += 1;
            if (status === 'proses') acc.proses += 1;
            else if (status === 'selesai') acc.selesai += 1;
            else if (status === 'batal') acc.batal += 1;
            else acc.antre += 1;
            return acc;
        }, { total: 0, antre: 0, proses: 0, selesai: 0, batal: 0 });
    }, [todayQueue]);

    const queueSheetItems = useMemo(() => {
        return todayQueue.filter((item: any) => {
            const matchesPayment = queuePaymentFilter === 'ALL' || getQueuePaymentStatus(item) === queuePaymentFilter;
            const workStatus = String(item.status_pengerjaan || 'antre').toLowerCase();
            // ALL filter excludes batal; only show batal when explicitly selected
            const matchesWorkStatus = queueWorkStatusFilter === 'ALL'
                ? workStatus !== 'batal'
                : workStatus === queueWorkStatusFilter;
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

    const handlePrintReceipt = async (item: any) => {
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
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal mencetak struk'),
                variant: 'error',
            });
        } finally {
            setPrinting(false);
        }
    };

    const handleSharePublicReceipt = async (item: any) => {
        const receiptToken = item?.public_receipt_token;
        if (!receiptToken) {
            setDialogConfig({
                visible: true,
                title: 'Token Tidak Tersedia',
                message: 'Token struk publik belum tersedia untuk transaksi ini.',
                variant: 'error',
            });
            return;
        }

        try {
            const shareUrl = await buildPublicReceiptShareUrl('bengkel', receiptToken);
            await sharePublicReceiptLink({
                shareUrl,
                transactionNumber: item?.nomor_transaksi,
                receiptType: 'bengkel',
                receiptId: receiptToken,
                onCopied: () => {
                    setDialogConfig({
                        visible: true,
                        title: 'Berhasil',
                        message: 'Link struk publik telah disalin ke clipboard.',
                        variant: 'success',
                    });
                },
            });
        } catch (error: any) {
            setDialogConfig({
                visible: true,
                title: 'Gagal',
                message: getErrorMessage(error, 'Gagal membagikan link struk'),
                variant: 'error',
            });
        }
    };

    const openEditTransaction = (item: any) => {
        if (!item?.id) return;
        if (isBengkelTransactionLocked(item)) {
            setDialogConfig({
                visible: true,
                title: 'Tidak Dapat Diedit',
                message: 'Transaksi sudah lunas dan selesai.',
                variant: 'warning',
            });
            return;
        }
        setDetailModalOpen(false);
        router.push({ pathname: '/bengkel/transaksi', params: { mode: 'all', transactionId: String(item.id) } } as any);
    };

    const openQueueTransactionMode = (mode: 'sparepart' | 'servis', item: any) => {
        if (isBengkelTransactionLocked(item)) {
            setDialogConfig({
                visible: true,
                title: 'Tidak Dapat Diedit',
                message: 'Transaksi sudah lunas dan selesai.',
                variant: 'warning',
            });
            return;
        }
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

    const isSelectedToday = useMemo(() => format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'), [date]);

    const dayStats = useMemo(() => ({
        total: summary?.total_transaksi ?? todayQueue.length,
        omzet: summary?.total_penjualan ?? 0,
        piutang: summary?.piutang_nilai ?? 0,
        piutangCount: summary?.piutang_count ?? queuePaymentStats.BELUM_LUNAS + queuePaymentStats.BELUM_BAYAR,
        proses: summary?.proses ?? queueWorkStatusStats.proses,
    }), [summary, todayQueue.length, queuePaymentStats, queueWorkStatusStats.proses]);

    const getWorkStatusTheme = (status?: string | null) => {
        const normalized = String(status || 'antre').toLowerCase();
        if (normalized === 'proses') return { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', accent: '#2563EB' };
        if (normalized === 'selesai') return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', accent: '#059669' };
        if (normalized === 'batal') return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', accent: '#F43F5E' };
        return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', accent: '#D97706' };
    };

    const getPaymentBadgeVariant = (item: any): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
        const status = getQueuePaymentStatus(item);
        if (status === 'INTERNAL') return 'neutral';
        if (status === 'LUNAS') return 'success';
        if (status === 'BATAL') return 'error';
        if (status === 'BELUM_LUNAS') return 'warning';
        return 'info';
    };

    const renderQueueCard = (item: any) => {
        const workTheme = getWorkStatusTheme(item.status_pengerjaan);
        const payment = getPaidSummary(item);
        const itemCount = (item.detail_services?.length || 0) + (item.detail_parts?.length || 0);
        const isActiveWork = ['antre', 'proses'].includes(String(item.status_pengerjaan || '').toLowerCase());

        return (
            <Pressable
                onPress={() => {
                    setSelectedItem(item);
                    setDetailModalOpen(true);
                }}
                className="bg-white p-4 rounded-[28px] mb-4 border border-gray-50 shadow-sm active:scale-[0.98]"
            >
                <View className="flex-row items-start">
                    <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-3 border ${workTheme.bg} ${workTheme.border}`}>
                        <Car size={20} color={workTheme.accent} />
                        <Typography weight="bold" className={`text-[8px] mt-0.5 uppercase tracking-tighter ${workTheme.text}`} numberOfLines={1}>
                            {(item.nomor_plat || '-').slice(0, 8)}
                        </Typography>
                    </View>

                    <View className="flex-1">
                        <View className="flex-row items-start justify-between gap-2">
                            <View className="flex-1 mr-2">
                                <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>
                                    {item.nomor_plat || '-'}
                                </Typography>
                                <Typography className="text-textGray text-[11px] mt-0.5" numberOfLines={1}>
                                    {item.nama_customer || 'Umum'} • {item.jenis_kendaraan || '-'}
                                </Typography>
                                <Typography className="text-gray-400 text-[10px] mt-1" numberOfLines={1}>
                                    {item.nomor_transaksi || '-'}
                                </Typography>
                            </View>
                            <View className="items-end gap-1">
                                <Badge
                                    label={formatBengkelWorkStatusLabel(item.status_pengerjaan)}
                                    variant={
                                        item.status_pengerjaan === 'proses' ? 'info' :
                                        item.status_pengerjaan === 'selesai' ? 'success' :
                                        item.status_pengerjaan === 'batal' ? 'error' : 'warning'
                                    }
                                />
                                <Badge
                                    label={formatBengkelPaymentStatusLabel(getQueuePaymentStatus(item))}
                                    variant={getPaymentBadgeVariant(item)}
                                />
                            </View>
                        </View>

                        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
                            <View className="flex-row items-center">
                                <Clock size={12} color="#9CA3AF" />
                                <Typography className="text-textGray text-[10px] font-semibold ml-1">
                                    {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: localeID }) : '-'}
                                </Typography>
                                {itemCount > 0 && (
                                    <Typography className="text-gray-400 text-[10px] ml-2">
                                        • {itemCount} item
                                    </Typography>
                                )}
                            </View>
                            <View className="items-end">
                                {payment.hasPartialPayment && (
                                    <Typography className="text-amber-600 text-[9px] font-bold">
                                        Terbayar {formatCurrency(payment.paid)}
                                    </Typography>
                                )}
                                <Typography weight="bold" className="text-primary text-sm">
                                    {formatCurrency(item.grand_total || 0)}
                                </Typography>
                            </View>
                        </View>

                        {isActiveWork && !isBengkelTransactionLocked(item) && (
                            <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50 gap-2">
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
                                            className="flex-1 h-9 rounded-xl bg-gray-50 border border-gray-100 flex-row items-center justify-center active:scale-95"
                                        >
                                            <ActionIcon size={13} color={action.color} />
                                            <Typography weight="bold" className="text-[9px] text-textMain ml-1" numberOfLines={1}>
                                                {action.label}
                                            </Typography>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>
            </Pressable>
        );
    };

    const listHeader = (
        <View>
            <View className="flex-row gap-3 mb-4">
                {[
                    { label: 'Total Antrian', value: formatNumber(dayStats.total), icon: ListOrdered, color: '#023C69', bg: 'bg-primary/5' },
                    { label: 'Omzet', value: formatCurrency(dayStats.omzet), icon: TrendingUp, color: '#059669', bg: 'bg-emerald-50' },
                    { label: 'Piutang', value: formatCurrency(dayStats.piutang), icon: Banknote, color: '#D97706', bg: 'bg-amber-50', sub: `${dayStats.piutangCount} order` },
                ].map((stat) => {
                    const StatIcon = stat.icon;
                    return (
                        <View key={stat.label} className={`flex-1 ${stat.bg} rounded-2xl p-3 border border-gray-100`}>
                            <View className="flex-row items-center mb-2">
                                <StatIcon size={14} color={stat.color} />
                                <Typography className="text-[9px] font-bold text-gray-500 ml-1.5 uppercase tracking-wide">{stat.label}</Typography>
                            </View>
                            <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>{stat.value}</Typography>
                            {stat.sub ? (
                                <Typography className="text-[9px] text-gray-400 mt-0.5">{stat.sub}</Typography>
                            ) : null}
                        </View>
                    );
                })}
            </View>

            <View className="bg-white border border-gray-100 rounded-2xl p-3 mb-4">
                <View className="flex-row justify-between items-center">
                    <Pressable
                        onPress={handlePrev}
                        className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                    >
                        <ChevronLeft size={20} color="#1C1C1C" />
                    </Pressable>

                    <View className="items-center flex-1 mx-2">
                        <View className="flex-row items-center">
                            <Calendar size={16} color="#023C69" />
                            <Typography variant="body2" weight="bold" className="text-textMain ml-2">
                                {getFormattedDate()}
                            </Typography>
                        </View>
                        {isSelectedToday && (
                            <Typography className="text-primary text-[9px] font-bold uppercase tracking-widest mt-1">Hari Ini</Typography>
                        )}
                    </View>

                    <Pressable
                        onPress={handleNext}
                        className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                    >
                        <ChevronRight size={20} color="#1C1C1C" />
                    </Pressable>
                </View>
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 mb-3">
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

            <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest text-[10px] mb-2 ml-1">
                Status Pengerjaan
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                {[
                    { id: 'ALL', label: 'Semua', count: queueWorkStatusStats.total, active: 'bg-primary border-primary', inactive: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
                    { id: 'antre', label: 'Antre', count: queueWorkStatusStats.antre, active: 'bg-amber-500 border-amber-500', inactive: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                    { id: 'proses', label: 'Proses', count: queueWorkStatusStats.proses, active: 'bg-blue-500 border-blue-500', inactive: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
                    { id: 'selesai', label: 'Selesai', count: queueWorkStatusStats.selesai, active: 'bg-emerald-500 border-emerald-500', inactive: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                    { id: 'batal', label: 'Dibatalkan', count: queueWorkStatusStats.batal, active: 'bg-rose-500 border-rose-500', inactive: 'bg-rose-50 border-rose-100', text: 'text-rose-700' },
                ].map((filter) => {
                    const isActive = queueWorkStatusFilter === filter.id;
                    return (
                        <Pressable
                            key={filter.id}
                            onPress={() => setQueueWorkStatusFilter(filter.id as any)}
                            className={`px-4 py-2 rounded-full border mr-2 ${isActive ? filter.active : filter.inactive}`}
                        >
                            <Typography variant="caption" weight="bold" className={isActive ? 'text-white' : filter.text}>
                                {filter.label} ({filter.count})
                            </Typography>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest text-[10px] mb-2 ml-1">
                Status Pembayaran
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
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
                            <Typography variant="caption" weight="bold" className={isActive ? 'text-white' : filter.text}>
                                {filter.label} ({filter.count})
                            </Typography>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {dayStats.proses > 0 && queueWorkStatusFilter !== 'proses' && (
                <Pressable
                    onPress={() => setQueueWorkStatusFilter('proses')}
                    className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4 flex-row items-center active:opacity-90"
                >
                    <View className="bg-blue-500 p-2 rounded-full mr-3">
                        <Wrench size={18} color="white" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body2" weight="bold" className="text-blue-800">Sedang Dikerjakan</Typography>
                        <Typography variant="caption" className="text-blue-700/80">{dayStats.proses} order dalam proses — ketuk untuk filter</Typography>
                    </View>
                    <ChevronRight size={18} color="#2563EB" />
                </Pressable>
            )}

            <View className="flex-row items-center justify-between mb-3 px-1">
                <Typography className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Daftar Antrian
                </Typography>
                <Typography className="text-[10px] font-bold text-primary">
                    {queueSheetItems.length} order
                </Typography>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View>
                        <Typography variant="h2" weight="bold">Antrian Bengkel</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">Monitor order, status & pembayaran</Typography>
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

            {isLoading ? (
                <View className="flex-1 px-6 pt-6">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
            ) : (
                <FlatList
                    data={queueSheetItems}
                    keyExtractor={(item: any) => String(item.id)}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) }}
                    ListHeaderComponent={listHeader}
                    refreshControl={
                        <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                    }
                    renderItem={({ item }) => renderQueueCard(item)}
                    ListEmptyComponent={
                        <EmptyState
                            title="Antrian Masih Kosong"
                            description={queueSearchQuery || queueWorkStatusFilter !== 'ALL' || queuePaymentFilter !== 'ALL'
                                ? 'Tidak ada order yang cocok dengan filter saat ini.'
                                : 'Tidak ada data antrian untuk tanggal ini.'}
                            icon={Clock}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

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
                        <BoundedSheetPanel
                            maxHeightRatio={0.88}
                            bottomInset={insets.bottom}
                            style={{ paddingHorizontal: 24, paddingTop: 24 }}
                        >
                            <View className="flex-row justify-between items-center mb-4">
                                <View className="flex-1 mr-3">
                                    <Typography variant="h3" weight="bold">Detail Antrian</Typography>
                                    <Typography className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                                        {selectedItem.nomor_transaksi || '-'} • {selectedItem.nama_customer || 'Umum'}
                                    </Typography>
                                </View>
                                <Pressable onPress={() => setDetailModalOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <X size={18} color="#4B5563" />
                                </Pressable>
                            </View>

                            <BoundedSheetScrollView
                                maxHeightRatio={0.88}
                                headerReserve={72}
                                bottomInset={insets.bottom}
                            >
                                <View className="flex-row justify-between items-start mb-4">
                                    <View className="flex-1 mr-3">
                                        <Typography variant="h2" weight="bold" className="text-xl tracking-tight">{selectedItem.nomor_plat}</Typography>
                                        <Typography variant="caption" className="text-textGray mt-0.5">
                                            {selectedItem.jenis_kendaraan} - {selectedItem.nama_customer || 'Umum'}
                                        </Typography>
                                    </View>
                                    <Badge
                                        label={formatBengkelWorkStatusLabel(selectedItem.status_pengerjaan)}
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
                                            {(selectedItem?.detail_services?.length || 0) + (selectedItem?.detail_parts?.length || 0)} baris
                                        </Typography>
                                    </View>

                                    {((selectedItem?.detail_services) || []).map((s: any, idx: number) => (
                                        <View key={`svc-${idx}`} className="flex-row justify-between items-center py-1.5 border-t border-gray-100">
                                            <View className="flex-1 mr-3">
                                                <Typography variant="body2" weight="semibold" className="text-textMain" numberOfLines={1}>{s.nama_jasa}</Typography>
                                                <Typography variant="caption" className="text-textGray/70">Jasa</Typography>
                                            </View>
                                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(s.harga)}</Typography>
                                        </View>
                                    ))}

                                    {((selectedItem?.detail_parts) || []).map((p: any, idx: number) => (
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
                                    {(() => {
                                        const payment = getPaidSummary(selectedItem);
                                        if (payment.isLunas) {
                                            return (
                                                <View className="flex-row items-center justify-between pt-2 border-t border-emerald-200">
                                                    <Typography className="text-emerald-600 text-xs font-semibold uppercase">Status Pembayaran</Typography>
                                                    <Typography className="text-emerald-700 text-xs font-bold uppercase">Lunas</Typography>
                                                </View>
                                            );
                                        }
                                        if (!payment.hasPartialPayment) return null;
                                        return (
                                            <>
                                                <View className="flex-row items-center justify-between mb-1">
                                                    <Typography className="text-emerald-600 text-xs">Sudah Dibayar</Typography>
                                                    <Typography className="text-emerald-600 text-xs font-bold">-{formatCurrency(payment.paid)}</Typography>
                                                </View>
                                                <View className="flex-row items-center justify-between pt-2 border-t border-emerald-200">
                                                    <Typography variant="body2" weight="bold" className="text-emerald-800">Sisa Bayar</Typography>
                                                    <Typography variant="h4" weight="bold" className="text-emerald-800">
                                                        {formatCurrency(payment.remaining)}
                                                    </Typography>
                                                </View>
                                            </>
                                        );
                                    })()}
                                </Card>

                                {/* Action Buttons */}
                                <View className="flex-row space-x-3 mb-4">
                                    <Pressable
                                        onPress={() => openEditTransaction(selectedItem)}
                                        disabled={isBengkelTransactionLocked(selectedItem)}
                                        className={`flex-1 py-3 rounded-xl items-center justify-center flex-row ${
                                            isBengkelTransactionLocked(selectedItem)
                                                ? 'bg-gray-200 opacity-60'
                                                : 'bg-amber-500 active:opacity-90'
                                        }`}
                                    >
                                        <Edit2 size={16} color={isBengkelTransactionLocked(selectedItem) ? '#9CA3AF' : 'white'} />
                                        <Typography weight="bold" className={`text-xs ml-2 uppercase tracking-widest ${
                                            isBengkelTransactionLocked(selectedItem) ? 'text-gray-400' : 'text-white'
                                        }`}>
                                            Edit
                                        </Typography>
                                    </Pressable>

                                    {selectedItem.status_bayar !== 'LUNAS' && selectedItem.grand_total > 0 ? (
                                        <Pressable
                                            onPress={() => setPaymentSheetOpen(true)}
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
                                        onPress={() => handlePrintReceipt(selectedItem)}
                                        disabled={printing}
                                        className="flex-1 bg-primary py-3.5 rounded-xl items-center justify-center flex-row active:opacity-90 border border-primary/20"
                                    >
                                        {printing ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : (
                                            <Printer size={16} color="white" />
                                        )}
                                        <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                            {printing ? 'Mencetak...' : 'Print Struk'}
                                        </Typography>
                                    </Pressable>
                                </View>

                                {selectedItem?.public_receipt_token ? (
                                    <Pressable
                                        onPress={() => handleSharePublicReceipt(selectedItem)}
                                        className="bg-[#00ADEF] py-3.5 rounded-2xl items-center justify-center flex-row active:opacity-90 border border-sky-300/30"
                                    >
                                        <Share2 size={16} color="white" />
                                        <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                            Share Struk Public
                                        </Typography>
                                    </Pressable>
                                ) : null}

                                {!isBengkelTransactionVoided(selectedItem) ? (
                                    <Pressable
                                        onPress={() => handleVoidTransaction(selectedItem)}
                                        className="mt-3 bg-rose-600 py-3.5 rounded-2xl items-center justify-center flex-row active:opacity-90"
                                    >
                                        <Trash2 size={16} color="white" />
                                        <Typography weight="bold" className="text-white text-xs ml-2 uppercase tracking-widest">
                                            Batalkan Transaksi
                                        </Typography>
                                    </Pressable>
                                ) : null}
                            </BoundedSheetScrollView>
                        </BoundedSheetPanel>
                    </View>
                </Modal>
            )}

            {/* Bengkel Payment Modal */}
            {selectedItem && (
                <BengkelPaymentModal
                    visible={paymentSheetOpen}
                    onClose={() => setPaymentSheetOpen(false)}
                    onConfirm={async (paymentData) => {
                        try {
                            const { willBeLunas, ...paymentPayload } = paymentData;
                            await updateTransaksiMutation.mutateAsync({
                                id: selectedItem.id,
                                data: {
                                    ...paymentPayload,
                                    ...(willBeLunas ? { status_pengerjaan: 'SELESAI' } : {}),
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
                    loading={updateTransaksiMutation.isPending}
                    grandTotal={selectedItem.grand_total || 0}
                    existingDp={selectedItem.jumlah_bayar || 0}
                    nomorTransaksi={selectedItem.nomor_transaksi}
                />
            )}

            {/* Alert Dialog - rendered last for proper z-index */}
            <AlertDialogComponent
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type="alert"
                onClose={() => setDialogConfig((prev: any) => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}
