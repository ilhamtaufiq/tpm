import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useRouter, router } from 'expo-router';
import { useRecentActivity } from '../../hooks/useKeuangan';
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { ActivityItem } from '../../services/keuangan';
import { formatCurrency } from '../../utils/format';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';

const getSourceConfig = (source: string, title?: string) => {
    const s = source?.toLowerCase() || '';
    const t = title?.toLowerCase() || '';

    // Priority 1: Title detection for specific keywords (robust fallback)
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
        return { icon: Truck, color: '#10B981', label: 'Logistik' };
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
            return { icon: Truck, color: '#10B981', label: 'Logistik' };
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

export default function HistoryTab() {
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Fetch more items for the history page (limit 100)
    const { data: transactions, isLoading, refetch } = useRecentActivity(100);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const handleBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/home');
    };

    const filteredList = transactions?.filter((item: ActivityItem) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(search.toLowerCase()) ||
        item.source.toLowerCase().includes(search.toLowerCase()) ||
        (item.ref_number && item.ref_number.toLowerCase().includes(search.toLowerCase()))
    ) || [];

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="Aktivitas Bisnis"
                subtitle="Log Transaksi"
                showBackButton
                onBackButtonPress={handleBack}
                rightElement={
                    <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                        <Typography className="text-white uppercase text-[8px] font-bold tracking-widest">ARCHIVE</Typography>
                    </View>
                }
            >
                {/* Search & Filter (Glassmorphism) */}
                <View className="bg-white/10 p-2 rounded-3xl border border-white/10 flex-row items-center">
                    <View className="flex-1 flex-row items-center px-4 bg-white/5 h-12 rounded-2xl border border-white/5">
                        <Search size={18} color="white" opacity={0.5} />
                        <TextInput
                            placeholder="Cari transaksi, ref, unit, atau kategori..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            className="flex-1 ml-3 text-sm font-medium text-white"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity className="ml-2 w-12 h-12 bg-white/10 rounded-2xl items-center justify-center">
                        <Filter size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </Header>

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color="#023C69" />
                        <Typography className="text-textGray/40 text-xs mt-4 font-bold tracking-widest">MENYINGKRONKAN DATA...</Typography>
                    </View>
                ) : filteredList.length === 0 ? (
                    <View className="items-center justify-center py-20 bg-white rounded-[40px] border border-dashed border-gray-100">
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
                            <TouchableOpacity
                                key={item.id}
                                activeOpacity={0.7}
                                className="bg-white p-4 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center"
                                onPress={() => {
                                    setSelectedItem(item);
                                    setModalVisible(true);
                                }}
                            >
                                {/* Left: Source Icon */}
                                <View
                                    style={{ backgroundColor: `${config.color}10` }}
                                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3 border border-white flex-shrink-0"
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
                                        className={`text-[13px] mb-1 ${item.is_incoming ? "text-emerald-600" : "text-rose-500"}`}
                                        numberOfLines={1}
                                    >
                                        {item.is_incoming ? '+' : '-'} {formatCurrency(item.amount)}
                                    </Typography>

                                    <View className="flex-row items-center">
                                        <View className={`px-1.5 py-0.5 rounded-md mr-1.5 ${item.is_incoming ? "bg-emerald-50" : "bg-rose-50"}`}>
                                            <Typography weight="bold" className={item.is_incoming ? "text-emerald-600 text-[8px]" : "text-rose-600 text-[8px]"}>
                                                {item.is_incoming ? 'IN' : 'OUT'}
                                            </Typography>
                                        </View>
                                        <Typography className="text-[8px] text-textGray/40 uppercase font-black tracking-tighter">
                                            {config.label}
                                        </Typography>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
                <View className="h-40" />
            </ScrollView>

            <TransactionDetailModal
                item={selectedItem}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </View>
    );
}
