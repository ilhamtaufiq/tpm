import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, TextInput, Image, StatusBar, Modal } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { getFileUrl } from '../../utils/image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import {
    Search,
    Wrench,
    CarFront,
    Truck,
    Receipt,
    Wallet,
    HelpCircle,
    Filter,
    Calendar,
    User,
    ChevronLeft,
    ChevronRight,
    X
} from 'lucide-react-native';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import { useUnitWalletHistory, useRecentActivity } from '../../hooks/useKeuangan';
import { format, formatDistanceToNow, subDays, addDays, subMonths, addMonths, subYears, addYears } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { ActivityItem, KasBankTransaction } from '../../services/keuangan';
import { formatCurrency } from '../../utils/format';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

const getSourceConfig = (source: string, title?: string) => {
    const s = source?.toLowerCase() || '';
    const t = title?.toLowerCase() || '';

    // Priority 1: Title detection for specific keywords (robust fallback)
    if (t.includes('transfer') || t.includes('antar dompet') || t.includes('mutasi') || s.includes('mutasi') || s.includes('transfer')) {
        return { icon: Wallet, color: '#3B82F6', label: 'Transfer' };
    }
    if (t.includes('spare part') || t.includes('pembelian part') || t.includes('pbl')) {
        return { icon: Receipt, color: '#6366F1', label: 'Inventory' };
    }
    if (t.includes('repair') || t.includes('bengkel') || t.includes('bgl')) {
        return { icon: Wrench, color: '#3B82F6', label: 'Bengkel' };
    }
    if (t.includes('mobil') || t.includes('mbl')) {
        return { icon: CarFront, color: '#F59E0B', label: 'Mobil' };
    }
    if (t.includes('angkut') || t.includes('muatan') || t.includes('jas')) {
        return { icon: Truck, color: '#10B981', label: 'Jasa Angkut' };
    }
    if (t.includes('gaji') || t.includes('kantor') || t.includes('sdm') || t.includes('kasbon')) {
        return { icon: User, color: '#8B5CF6', label: 'SDM' };
    }

    // Priority 2: Source-based mapping (normalized)
    switch (s) {
        case 'bengkel':
            return { icon: Wrench, color: '#3B82F6', label: 'Bengkel' };
        case 'jual_beli_mobil':
        case 'pembelian_mobil':
            return { icon: CarFront, color: '#F59E0B', label: 'Mobil' };
        case 'jasa_angkut':
            return { icon: Truck, color: '#10B981', label: 'Jasa Angkut' };
        case 'pembelian_part':
            return { icon: Receipt, color: '#6366F1', label: 'Inventory' };
        case 'pengeluaran':
            return { icon: Wallet, color: '#EF4444', label: 'Biaya Ops' };
        case 'gaji':
        case 'kasbon':
            return { icon: User, color: '#8B5CF6', label: 'SDM' };
        case 'piutang':
            return { icon: Receipt, color: '#7C3AED', label: 'Piutang' };
        case 'hutang':
            return { icon: Receipt, color: '#EA580C', label: 'Hutang' };
        case 'modal':
            return { icon: Wallet, color: '#059669', label: 'Modal' };
        case 'prive':
            return { icon: Wallet, color: '#DC2626', label: 'Prive' };
        default:
            return { icon: HelpCircle, color: '#6B7280', label: 'Sistem' };
    }
};

const getStatusBadge = (status: string): { variant: 'success' | 'warning' | 'info' | 'error' | 'neutral', label: string } => {
    const s = status.toUpperCase();
    if (s.includes('LUNAS') || s === 'SELESAI') return { variant: 'success', label: 'LUNAS' };
    if (s.includes('PROSES') || s === 'ANTRE') return { variant: 'info', label: 'PROSES' };
    if (s.includes('BELUM') || s === 'PENDING') return { variant: 'warning', label: 'PENDING' };
    if (s === 'BATAL') return { variant: 'error', label: 'BATAL' };
    return { variant: 'neutral', label: s.replace('BANK_', '') };
};

const FILTER_SOURCES = [
    { label: 'Semua', value: 'all' },
    { label: 'Bengkel', value: 'bengkel' },
    { label: 'Jasa Angkut', value: 'jasa_angkut' },
    { label: 'Mobil', value: 'jual_beli_mobil' },
    { label: 'Biaya Ops', value: 'pengeluaran' },
    { label: 'SDM', value: 'gaji' },
] as const;

const FILTER_TYPES = [
    { label: 'Semua Transaksi', value: 'all' },
    { label: 'Uang Masuk', value: 'in' },
    { label: 'Uang Keluar', value: 'out' },
] as const;

export default function HistoryTab() {
    const themeColors = useUIStore((s) => s.themeColors);
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<'all' | 'in' | 'out'>('all');
    const [date, setDate] = useState(new Date());
    const [dateMode, setDateMode] = useState<'all' | 'daily' | 'monthly' | 'yearly'>('all');
    const [datePickerModalOpen, setDatePickerModalOpen] = useState(false);

    const handlePrevDate = () => {
        if (dateMode === 'monthly') setDate(curr => subMonths(curr, 1));
        else if (dateMode === 'yearly') setDate(curr => subYears(curr, 1));
        else setDate(curr => subDays(curr, 1));
    };

    const handleNextDate = () => {
        if (dateMode === 'monthly') setDate(curr => addMonths(curr, 1));
        else if (dateMode === 'yearly') setDate(curr => addYears(curr, 1));
        else setDate(curr => addDays(curr, 1));
    };

    const getFormattedDateText = () => {
        if (dateMode === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        if (dateMode === 'yearly') return `Tahun ${format(date, 'yyyy')}`;
        return format(date, 'dd MMMM yyyy', { locale: localeID });
    };
    const { user } = useAuthStore();
    const { unit, focus_id, focus_entity } = useLocalSearchParams<{ unit?: string; focus_id?: string; focus_entity?: string }>();
    const unitKey = Array.isArray(unit) ? unit[0] : unit;
    const focusId = Array.isArray(focus_id) ? focus_id[0] : focus_id;
    const focusEntity = Array.isArray(focus_entity) ? focus_entity[0] : focus_entity;

    const walletFilters = {
        bengkel: {
            label: 'Bengkel',
            jenis: 'KAS_UNIT_BENGKEL',
            sumber: 'BENGKEL',
        },
        mobil: {
            label: 'Jual Beli Mobil',
            jenis: 'KAS_UNIT_MOBIL',
            sumber: 'JUAL_BELI_MOBIL',
        },
        jasa_angkut: {
            label: 'Jasa Angkut',
            jenis: 'KAS_UNIT_JASA_ANGKUT',
            sumber: 'JASA_ANGKUT',
        },
    } as const;

    const walletFilter = walletFilters[unitKey as keyof typeof walletFilters];
    
    // Removed strict admin guard to allow unit roles to see their filtered history
    // if (!(user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
    //     return <Redirect href="/(tabs)/home" />;
    // }

    const [refreshing, setRefreshing] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Fetch either the generic activity feed or the exact wallet ledger requested by a unit screen.
    const {
        data: recentTransactions,
        isLoading: isRecentLoading,
        refetch: refetchRecent,
    } = useRecentActivity(100, selectedSource, {
        enabled: !walletFilter,
    });

    const {
        data: walletHistoryData,
        isLoading: isWalletLoading,
        refetch: refetchWallet,
    } = useUnitWalletHistory(
        walletFilter?.jenis ?? '',
        walletFilter?.sumber ?? '',
        {
            limit: 100,
            sort_by: 'tanggal',
            sort_order: 'desc',
        },
        {
            enabled: !!walletFilter,
        }
    );

    const walletTransactions = useMemo<ActivityItem[]>(() => {
        if (!walletHistoryData?.data) return [];

        return walletHistoryData.data.map((item: KasBankTransaction) => ({
            type: 'financial',
            id: `kas_${item.id}`,
            original_id: item.id,
            title: item.keterangan || item.sumber,
            subtitle: item.nomor_transaksi,
            amount: Number(item.nominal),
            is_incoming: item.tipe === 'MASUK',
            status: item.jenis,
            timestamp: item.created_at,
            source: item.sumber,
            ref_number: item.nomor_referensi,
        }));
    }, [walletHistoryData]);

    const transactions = walletFilter ? walletTransactions : recentTransactions;
    const isLoading = walletFilter ? isWalletLoading : isRecentLoading;
    const refetch = walletFilter ? refetchWallet : refetchRecent;

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const handleBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/home');
    };

    const filteredList = transactions?.filter((item: ActivityItem) => {
        // Generic history still respects role isolation. Wallet mode is already scoped
        // to a specific unit ledger so transfer/setoran rows with source "LAINNYA" remain visible.
        const role = user?.role;
        if (!walletFilter && selectedSource === 'all' && role !== 'ADMIN' && role !== 'MANAGER') {
            const source = item.source?.toLowerCase();
            if (role === 'BENGKEL' && source !== 'bengkel' && source !== 'pembelian_part') return false;
            if (role === 'JASA_ANGKUT' && source !== 'jasa_angkut') return false;
            if (role === 'MOBIL' && source !== 'jual_beli_mobil' && source !== 'pembelian_mobil') return false;
        }

        // Apply Date Filter
        if (dateMode !== 'all' && item.timestamp) {
            const itemDate = new Date(item.timestamp);
            if (dateMode === 'daily') {
                const isSameDay = itemDate.getFullYear() === date.getFullYear() &&
                                  itemDate.getMonth() === date.getMonth() &&
                                  itemDate.getDate() === date.getDate();
                if (!isSameDay) return false;
            } else if (dateMode === 'monthly') {
                const isSameMonth = itemDate.getFullYear() === date.getFullYear() &&
                                    itemDate.getMonth() === date.getMonth();
                if (!isSameMonth) return false;
            } else if (dateMode === 'yearly') {
                const isSameYear = itemDate.getFullYear() === date.getFullYear();
                if (!isSameYear) return false;
            }
        }

        // Apply Source Filter
        if (selectedSource !== 'all') {
            const itemSource = item.source?.toLowerCase() || '';
            const itemTitle = (item.title || '').toLowerCase();
            const itemRef = (item.ref_number || '').toLowerCase();
            if (selectedSource === 'gaji') {
                const itemSubtitle = (item.subtitle || '').toLowerCase();
                const isSdm = itemSource === 'gaji' || itemSource === 'kasbon' ||
                              itemTitle.includes('kasbon') || itemTitle.includes('gaji') ||
                              itemRef.includes('ksb') || itemRef.includes('gji') ||
                              itemSubtitle.includes('ksb') || itemSubtitle.includes('gji');
                if (!isSdm) return false;
            } else if (selectedSource === 'jual_beli_mobil') {
                if (itemSource !== 'jual_beli_mobil' && itemSource !== 'pembelian_mobil') return false;
            } else {
                if (itemSource !== selectedSource) return false;
            }
        }

        // Apply Type Filter
        if (selectedType !== 'all') {
            const isIncoming = item.is_incoming;
            if (selectedType === 'in' && !isIncoming) return false;
            if (selectedType === 'out' && isIncoming) return false;
        }

        // Then apply search filter
        return (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
               (item.subtitle || '').toLowerCase().includes(search.toLowerCase()) ||
               (item.source || '').toLowerCase().includes(search.toLowerCase()) ||
               (item.ref_number && item.ref_number.toLowerCase().includes(search.toLowerCase()))
    }) || [];

    useEffect(() => {
        if (!focusId || !transactions || transactions.length === 0) return;
        const numericFocusId = Number(focusId);

        const target = transactions.find((item: ActivityItem) => {
            if (Number.isFinite(numericFocusId) && item.original_id === numericFocusId) return true;
            if (focusEntity === 'kas_bank' && item.type === 'financial' && Number.isFinite(numericFocusId) && item.original_id === numericFocusId) return true;
            return item.id === focusId;
        });

        if (target) {
            setSelectedItem(target);
            setModalVisible(true);
        }
    }, [focusId, focusEntity, transactions]);

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <StatusBar barStyle="dark-content" />

            {/* Background Image (User Custom) */}
            {user?.home_background && (
                <Image 
                    source={{ uri: getFileUrl(user.home_background) as string }} 
                    className="absolute inset-0 w-full h-full opacity-10" 
                    resizeMode="cover"
                />
            )}
            <Header
                title={walletFilter ? `Aktivitas ${walletFilter.label}` : 'Aktivitas Bisnis'}
                subtitle={walletFilter ? 'Kas & Setoran' : 'Log Transaksi'}
                showBackButton
                onBackButtonPress={handleBack}
            />

            {/* Search */}
            <View className="px-6 mt-4">
                <View className="bg-surface p-2 rounded-[24px] flex-row items-center border border-transparent shadow-sm">
                    <View className="flex-1 flex-row items-center px-4 h-12 rounded-2xl bg-background">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            placeholder="Cari transaksi, ref, unit, atau kategori..."
                            placeholderTextColor="#9CA3AF"
                            className="flex-1 ml-3 text-sm font-semibold text-textMain"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>
            </View>

            {/* Date Filter Bar */}
            <View className="mt-3">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
                    {[
                        { id: 'all', label: 'Semua' },
                        { id: 'daily', label: 'Harian' },
                        { id: 'monthly', label: 'Bulanan' },
                        { id: 'yearly', label: 'Tahunan' },
                    ].map((m) => (
                        <Pressable
                            key={m.id}
                            onPress={() => {
                                setDateMode(m.id as any);
                                if (m.id !== 'all' && !date) setDate(new Date());
                            }}
                            className={`px-4 py-2 rounded-xl border ${dateMode === m.id ? 'bg-primary border-primary shadow-sm' : 'bg-surface border-transparent active:bg-background'}`}
                        >
                            <Typography className={`text-xs font-bold ${dateMode === m.id ? 'text-white' : 'text-textGray'}`}>
                                {m.label}
                            </Typography>
                        </Pressable>
                    ))}
                </ScrollView>

                {dateMode !== 'all' && (
                    <View className="px-6 mt-2">
                        <View className="bg-surface border border-transparent rounded-2xl p-2 flex-row justify-between items-center shadow-sm">
                            <Pressable
                                onPress={handlePrevDate}
                                className="w-9 h-9 bg-background rounded-xl items-center justify-center border border-transparent active:scale-95"
                            >
                                <ChevronLeft size={18} color="#1C1C1C" />
                            </Pressable>

                            <Pressable
                                onPress={() => setDatePickerModalOpen(true)}
                                className="items-center flex-1 mx-2 py-1 flex-row justify-center active:opacity-70"
                            >
                                <Calendar size={15} color={themeColors.primary} />
                                <Typography variant="body2" weight="bold" className="text-textMain ml-2 text-xs">
                                    {getFormattedDateText()}
                                </Typography>
                                <ChevronRight size={14} color="#9CA3AF" className="ml-1" />
                            </Pressable>

                            <Pressable
                                onPress={handleNextDate}
                                className="w-9 h-9 bg-background rounded-xl items-center justify-center border border-transparent active:scale-95"
                            >
                                <ChevronRight size={18} color="#1C1C1C" />
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>

            {/* Type & Source Filters */}
            <View className="mt-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
                    {FILTER_TYPES.map((t) => (
                        <Pressable
                            key={t.value}
                            onPress={() => setSelectedType(t.value)}
                            className={`px-4 py-2 rounded-xl border ${selectedType === t.value ? 'bg-primary border-primary shadow-sm' : 'bg-surface border-transparent active:bg-background'}`}
                        >
                            <Typography className={`text-xs font-bold ${selectedType === t.value ? 'text-white' : 'text-textGray'}`}>
                                {t.label}
                            </Typography>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {!walletFilter && (
                <View className="mt-3">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
                        {FILTER_SOURCES.map((s) => (
                            <Pressable
                                key={s.value}
                                onPress={() => setSelectedSource(s.value)}
                                className={`px-4 py-2 rounded-xl border ${selectedSource === s.value ? 'bg-primary border-primary shadow-sm' : 'bg-surface border-transparent active:bg-background'}`}
                            >
                                <Typography className={`text-xs font-bold ${selectedSource === s.value ? 'text-white' : 'text-textGray'}`}>
                                    {s.label}
                                </Typography>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}

            <ScrollView
                className="flex-1 mt-4"
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 40) }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
            >
                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color={themeColors.primary} />
                        <Typography className="text-textGray text-xs mt-4 font-bold tracking-widest">MENYINGKRONKAN DATA...</Typography>
                    </View>
                ) : filteredList.length === 0 ? (
                    <View className="items-center justify-center py-20 bg-surface rounded-[24px] border border-dashed border-transparent mx-6">
                        <View className="w-24 h-24 bg-background rounded-full items-center justify-center mb-6 opacity-30">
                            <Calendar size={40} color="#9CA3AF" />
                        </View>
                        <Typography className="text-textGray font-bold uppercase tracking-[6px]">Spiii...</Typography>
                        <Typography variant="caption" className="text-textGray mt-2 text-center px-10">Tidak ditemukan aktivitas yang sesuai dengan kriteria pencarian Anda.</Typography>
                    </View>
                ) : (
                    filteredList.map((item: ActivityItem) => {
                        const config = getSourceConfig(item.source, item.title);
                        const Icon = config.icon;
                        const badge = getStatusBadge(item.status);

                        return (
                            <Pressable
                                key={item.id}
                                className="bg-surface px-6 py-5 border-b border-transparent flex-row items-center active:bg-background"
                                onPress={() => {
                                    setSelectedItem(item);
                                    setModalVisible(true);
                                }}
                            >
                                {/* Left: Source Icon */}
                                <View
                                    style={{ backgroundColor: `${config.color}10` }}
                                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3 border border-transparent flex-shrink-0"
                                >
                                    <Icon size={20} color={config.color} strokeWidth={2.5} />
                                </View>

                                {/* Middle: Main Details */}
                                <View className="flex-1 min-w-0">
                                    <View className="flex-row items-center mb-0.5">
                                        <Typography variant="body2" weight="bold" className="text-textMain tracking-tight flex-1" numberOfLines={1}>
                                            {(!item.title || item.title.trim() === '-' || item.title.trim() === '—')
                                                ? (item.ref_number || item.subtitle || 'Transaksi')
                                                : item.title}
                                        </Typography>
                                    </View>

                                    <Typography variant="caption" className="text-textGray italic leading-4 mb-1" numberOfLines={1}>
                                        {item.subtitle && item.subtitle.trim() !== '-' ? item.subtitle : (item.ref_number || '')}
                                    </Typography>

                                    <View className="flex-row items-center">
                                        <Badge
                                            label={badge.label}
                                            variant={badge.variant as any}
                                            className="px-1.5 py-0.5 h-auto"
                                            textClassName="text-[8px]"
                                        />
                                        <View className="w-1 h-1 rounded-full bg-gray-200 mx-1.5" />
                                        <Typography className="text-[10px] text-textGray font-medium">
                                            {format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: localeID })}
                                        </Typography>
                                    </View>
                                </View>

                                {/* Right: Amount & Status */}
                                <View className="items-end ml-2 pl-3 border-l border-transparent flex-shrink-0 min-w-[100px]">
                                    <Typography
                                        weight="bold"
                                        className={`text-[13px] mb-1 ${item.type === 'financial' ? (item.is_incoming ? "text-emerald-600" : "text-rose-500") : "text-textMain"}`}
                                        numberOfLines={1}
                                    >
                                        {item.type === 'financial' ? (item.is_incoming ? '+' : '-') : ''} {formatCurrency(item.amount)}
                                    </Typography>

                                    <View className="flex-row items-center">
                                        <View className={`px-1.5 py-0.5 rounded-md mr-1.5 ${item.type === 'financial' ? (item.is_incoming ? "bg-emerald-50" : "bg-rose-50") : "bg-blue-50"}`}>
                                            <Typography weight="bold" className={item.type === 'financial' ? (item.is_incoming ? "text-emerald-600 text-[8px]" : "text-rose-600 text-[8px]") : "text-blue-600 text-[8px]"}>
                                                {item.type === 'financial' ? (item.is_incoming ? 'IN' : 'OUT') : 'TRX'}
                                            </Typography>
                                        </View>
                                        <Typography className="text-[8px] text-textGray uppercase font-black tracking-tighter">
                                            {config.label}
                                        </Typography>

                                    </View>
                                </View>
                            </Pressable>
                        );
                    })
                )}
                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 16) }} />
            </ScrollView>

            <TransactionDetailModal
                item={selectedItem}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />

            {/* Date Filter Modal */}
            <Modal
                visible={datePickerModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setDatePickerModalOpen(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 px-6">
                    <View className="bg-surface rounded-3xl p-6 w-full max-w-md shadow-xl border border-transparent">
                        <View className="flex-row justify-between items-center mb-4">
                            <Typography variant="h3" weight="bold">Filter Tanggal & Periode</Typography>
                            <Pressable onPress={() => setDatePickerModalOpen(false)} className="w-8 h-8 bg-background rounded-full items-center justify-center">
                                <X size={18} color="#4B5563" />
                            </Pressable>
                        </View>

                        {/* Mode Selector */}
                        <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest text-[10px] mb-2">
                            Tipe Filter
                        </Typography>
                        <View className="flex-row gap-2 mb-5">
                            {[
                                { id: 'all', label: 'Semua' },
                                { id: 'daily', label: 'Harian' },
                                { id: 'monthly', label: 'Bulanan' },
                                { id: 'yearly', label: 'Tahunan' },
                            ].map((m) => (
                                <Pressable
                                    key={m.id}
                                    onPress={() => {
                                        setDateMode(m.id as any);
                                        if (m.id !== 'all' && !date) setDate(new Date());
                                    }}
                                    className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${dateMode === m.id ? 'bg-primary border-primary' : 'bg-background border-transparent'}`}
                                >
                                    <Typography weight="bold" className={`text-xs ${dateMode === m.id ? 'text-white' : 'text-textGray'}`}>
                                        {m.label}
                                    </Typography>
                                </Pressable>
                            ))}
                        </View>

                        {/* Month Selector Grid for Monthly */}
                        {dateMode === 'monthly' && (
                            <View className="mb-4">
                                <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest text-[10px] mb-2">
                                    Pilih Bulan ({format(date, 'yyyy')})
                                </Typography>
                                <View className="flex-row flex-wrap gap-2">
                                    {Array.from({ length: 12 }, (_, i) => {
                                        const monthDate = new Date(date.getFullYear(), i, 1);
                                        const isSelected = date.getMonth() === i;
                                        return (
                                            <Pressable
                                                key={i}
                                                onPress={() => setDate(monthDate)}
                                                className={`w-[30%] py-2.5 rounded-xl border items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-background border-transparent'}`}
                                            >
                                                <Typography weight="bold" className={`text-xs ${isSelected ? 'text-white' : 'text-textMain'}`}>
                                                    {format(monthDate, 'MMM', { locale: localeID })}
                                                </Typography>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Year Selector for Monthly/Yearly */}
                        {(dateMode === 'monthly' || dateMode === 'yearly') && (
                            <View className="mb-4">
                                <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest text-[10px] mb-2">
                                    Pilih Tahun
                                </Typography>
                                <View className="flex-row gap-2">
                                    {[2024, 2025, 2026, 2027, 2028].map((yr) => {
                                        const isSelected = date.getFullYear() === yr;
                                        return (
                                            <Pressable
                                                key={yr}
                                                onPress={() => setDate(new Date(yr, date.getMonth(), 1))}
                                                className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'bg-background border-transparent'}`}
                                            >
                                                <Typography weight="bold" className={`text-xs ${isSelected ? 'text-white' : 'text-textMain'}`}>
                                                    {yr}
                                                </Typography>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Quick Presets */}
                        <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest text-[10px] mb-2">
                            Pintas Cepat
                        </Typography>
                        <View className="flex-row gap-2 mb-5">
                            <Pressable
                                onPress={() => {
                                    setDate(new Date());
                                    setDateMode('daily');
                                }}
                                className="flex-1 py-2 bg-blue-50 border border-blue-100 rounded-xl items-center"
                            >
                                <Typography className="text-blue-700 text-xs font-bold">Hari Ini</Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    setDate(new Date());
                                    setDateMode('monthly');
                                }}
                                className="flex-1 py-2 bg-emerald-50 border border-emerald-100 rounded-xl items-center"
                            >
                                <Typography className="text-emerald-700 text-xs font-bold">Bulan Ini</Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    setDate(new Date());
                                    setDateMode('yearly');
                                }}
                                className="flex-1 py-2 bg-amber-50 border border-amber-100 rounded-xl items-center"
                            >
                                <Typography className="text-amber-700 text-xs font-bold">Tahun Ini</Typography>
                            </Pressable>
                        </View>

                        <Button
                            variant="primary"
                            onPress={() => setDatePickerModalOpen(false)}
                            className="w-full py-3 rounded-2xl"
                        >
                            Terapkan Filter
                        </Button>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
