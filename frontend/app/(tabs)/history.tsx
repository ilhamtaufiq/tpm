import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    Search,
    Wrench,
    CarFront,
    Truck,
    Receipt,
    Wallet,
    User,
    HelpCircle,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    Calendar,
    ArrowRight
} from 'lucide-react-native';
import { useRouter, router } from 'expo-router';
import { useRecentActivity } from '../../hooks/useKeuangan';
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { ActivityItem } from '../../services/keuangan';
import { formatCurrency } from '../../utils/format';

const getSourceConfig = (source: string) => {
    switch (source) {
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
            <StatusBar barStyle="light-content" />

            {/* Premium Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <View className="flex-row items-center mb-0.5">
                                <View className="w-1.5 h-1.5 rounded-full bg-secondary mr-2" />
                                <Typography className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Log Transaksi</Typography>
                            </View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Aktivitas Bisnis</Typography>
                        </View>
                    </View>
                    <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                        <Typography className="text-white uppercase text-[8px] font-bold tracking-widest">ARCHIVE</Typography>
                    </View>
                </View>

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
            </View>

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
                        const config = getSourceConfig(item.source);
                        const Icon = config.icon;
                        const badge = getStatusBadge(item.status);

                        return (
                            <TouchableOpacity
                                key={item.id}
                                activeOpacity={0.7}
                                className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                            >
                                <View
                                    style={{ backgroundColor: `${config.color}10` }}
                                    className="w-14 h-14 rounded-2xl items-center justify-center mr-4 border border-white"
                                >
                                    <Icon size={24} color={config.color} strokeWidth={2.5} />
                                </View>

                                <View className="flex-1">
                                    <View className="flex-row items-center justify-between">
                                        <Typography variant="body1" weight="bold" className="text-textMain tracking-tight pr-2" numberOfLines={1}>
                                            {item.title}
                                        </Typography>
                                        <View className={item.is_incoming ? "bg-emerald-50 px-2 py-1 rounded-lg" : "bg-rose-50 px-2 py-1 rounded-lg"}>
                                            <Typography weight="bold" className={item.is_incoming ? "text-emerald-600 text-[9px]" : "text-rose-600 text-[9px]"}>
                                                {item.is_incoming ? 'MASUK' : 'KELUAR'}
                                            </Typography>
                                        </View>
                                    </View>

                                    <View className="flex-row items-center mt-1">
                                        <Typography variant="caption" className="text-textGray/60 italic" numberOfLines={1}>
                                            {item.subtitle}
                                        </Typography>
                                        {item.ref_number && (
                                            <>
                                                <View className="w-1 h-1 rounded-full bg-gray-200 mx-2" />
                                                <Typography variant="caption" className="text-primary/60 font-medium">
                                                    Ref: {item.ref_number}
                                                </Typography>
                                            </>
                                        )}
                                    </View>

                                    <View className="flex-row items-center mt-1.5">
                                        <Badge
                                            label={badge.label}
                                            variant={badge.variant as any}
                                        />
                                        <View className="w-1 h-1 rounded-full bg-gray-200 mx-2" />
                                        <Typography variant="caption" className="text-textGray/60">
                                            {format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: localeID })}
                                        </Typography>
                                    </View>
                                </View>

                                <View className="items-end ml-2 pl-2 border-l border-gray-50">
                                    <Typography weight="bold" className={item.is_incoming ? "text-emerald-600 mb-0.5" : "text-rose-500 mb-0.5"}>
                                        {item.is_incoming ? '+' : '-'} {formatCurrency(item.amount)}
                                    </Typography>
                                    <Typography className="text-[9px] text-textGray/40 uppercase font-black">{config.label}</Typography>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
                <View className="h-40" />
            </ScrollView>
        </View>
    );
}
