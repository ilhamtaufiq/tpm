import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, TextInput, Image, StatusBar } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { getFileUrl } from '../../utils/image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
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
    User
} from 'lucide-react-native';
import { useRouter, router, Redirect, useLocalSearchParams } from 'expo-router';
import { useKasBankList, useRecentActivity } from '../../hooks/useKeuangan';
import { format, formatDistanceToNow } from 'date-fns';
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
    if (t.includes('gaji') || t.includes('kantor') || t.includes('sdm')) {
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
    { label: 'Semua Rans', value: 'all' },
    { label: 'Uang Masuk', value: 'in' },
    { label: 'Uang Keluar', value: 'out' },
] as const;

export default function HistoryTab() {
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<'all' | 'in' | 'out'>('all');
    const { user } = useAuthStore();
    const { unit, focus_id, focus_entity } = useLocalSearchParams<{ unit?: string; focus_id?: string; focus_entity?: string }>();
    const unitKey = Array.isArray(unit) ? unit[0] : unit;
    const focusId = Array.isArray(focus_id) ? focus_id[0] : focus_id;
    const focusEntity = Array.isArray(focus_entity) ? focus_entity[0] : focus_entity;

    const walletFilters = {
        bengkel: {
            label: 'Bengkel',
            jenis: 'KAS_UNIT_BENGKEL',
        },
        mobil: {
            label: 'Jual Beli Mobil',
            jenis: 'KAS_UNIT_MOBIL',
        },
        jasa_angkut: {
            label: 'Jasa Angkut',
            jenis: 'KAS_UNIT_JASA_ANGKUT',
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
    } = useRecentActivity(100, {
        enabled: !walletFilter,
    });

    const {
        data: walletHistoryData,
        isLoading: isWalletLoading,
        refetch: refetchWallet,
    } = useKasBankList(
        walletFilter
            ? {
                jenis: walletFilter.jenis,
                limit: 100,
                sort_by: 'tanggal',
                sort_order: 'desc',
            }
            : undefined,
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
        if (!walletFilter && role !== 'ADMIN' && role !== 'MANAGER') {
            const source = item.source?.toLowerCase();
            if (role === 'BENGKEL' && source !== 'bengkel' && source !== 'pembelian_part') return false;
            if (role === 'JASA_ANGKUT' && source !== 'jasa_angkut') return false;
            if (role === 'MOBIL' && source !== 'jual_beli_mobil' && source !== 'pembelian_mobil') return false;
        }

        // Apply Source Filter
        if (selectedSource !== 'all') {
            const itemSource = item.source?.toLowerCase();
            if (selectedSource === 'gaji') {
                if (itemSource !== 'gaji' && itemSource !== 'kasbon') return false;
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
        return item.title.toLowerCase().includes(search.toLowerCase()) ||
               item.subtitle.toLowerCase().includes(search.toLowerCase()) ||
               item.source.toLowerCase().includes(search.toLowerCase()) ||
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
                rightElement={
                    <View className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Typography className="text-textGray uppercase text-[8px] font-bold tracking-widest">ARCHIVE</Typography>
                    </View>
                }
            />

            {/* Search */}
            <View className="px-6 mt-4">
                <View className="bg-white p-2 rounded-[24px] flex-row items-center border border-gray-100 shadow-sm">
                    <View className="flex-1 flex-row items-center px-4 h-12 rounded-2xl bg-gray-50">
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

            {/* Type & Source Filters */}
            <View className="mt-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
                    {FILTER_TYPES.map((t) => (
                        <Pressable
                            key={t.value}
                            onPress={() => setSelectedType(t.value)}
                            className={`px-4 py-2 rounded-xl border ${selectedType === t.value ? 'bg-primary border-primary shadow-sm' : 'bg-white border-gray-100 active:bg-gray-50'}`}
                        >
                            <Typography className={`text-xs font-bold ${selectedType === t.value ? 'text-white' : 'text-gray-500'}`}>
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
                                className={`px-4 py-2 rounded-xl border ${selectedSource === s.value ? 'bg-primary border-primary shadow-sm' : 'bg-white border-gray-100 active:bg-gray-50'}`}
                            >
                                <Typography className={`text-xs font-bold ${selectedSource === s.value ? 'text-white' : 'text-gray-500'}`}>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color="#023C69" />
                        <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MENYINGKRONKAN DATA...</Typography>
                    </View>
                ) : filteredList.length === 0 ? (
                    <View className="items-center justify-center py-20 bg-white rounded-[24px] border border-dashed border-gray-100 mx-6">
                        <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6 opacity-30">
                            <Calendar size={40} color="#9CA3AF" />
                        </View>
                        <Typography className="text-textGray font-bold uppercase tracking-[6px]">Spiii...</Typography>
                        <Typography variant="caption" className="text-textGray/40 mt-2 text-center px-10">Tidak ditemukan aktivitas yang sesuai dengan kriteria pencarian Anda.</Typography>
                    </View>
                ) : (
                    filteredList.map((item: ActivityItem) => {
                        const config = getSourceConfig(item.source, item.title);
                        const Icon = config.icon;
                        const badge = getStatusBadge(item.status);

                        return (
                            <Pressable
                                key={item.id}
                                className="bg-white px-6 py-5 border-b border-gray-100 flex-row items-center active:bg-gray-50"
                                onPress={() => {
                                    setSelectedItem(item);
                                    setModalVisible(true);
                                }}
                            >
                                {/* Left: Source Icon */}
                                <View
                                    style={{ backgroundColor: `${config.color}10` }}
                                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3 border border-gray-50 flex-shrink-0"
                                >
                                    <Icon size={20} color={config.color} strokeWidth={2.5} />
                                </View>

                                {/* Middle: Main Details */}
                                <View className="flex-1 min-w-0">
                                    <View className="flex-row items-center mb-0.5">
                                        <Typography variant="body2" weight="bold" className="text-textMain tracking-tight flex-1" numberOfLines={1}>
                                            {item.title}
                                        </Typography>
                                    </View>

                                    <Typography variant="caption" className="text-textGray/60 italic leading-4 mb-1" numberOfLines={1}>
                                        {item.subtitle}
                                    </Typography>

                                    <View className="flex-row items-center">
                                        <Badge
                                            label={badge.label}
                                            variant={badge.variant as any}
                                            className="px-1.5 py-0.5 h-auto"
                                            textClassName="text-[8px]"
                                        />
                                        <View className="w-1 h-1 rounded-full bg-gray-200 mx-1.5" />
                                        <Typography className="text-[10px] text-textGray/60 font-medium">
                                            {format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: localeID })}
                                        </Typography>
                                    </View>
                                </View>

                                {/* Right: Amount & Status */}
                                <View className="items-end ml-2 pl-3 border-l border-gray-50 flex-shrink-0 min-w-[100px]">
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
                                        <Typography className="text-[8px] text-textGray/40 uppercase font-black tracking-tighter">
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
        </View>
    );
}
