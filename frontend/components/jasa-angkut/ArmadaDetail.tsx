import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useArmadaDetail } from '../../hooks/useJasaAngkut';
import { formatCurrency, formatDate } from '../../utils/format';
import {
    Truck,
    Calendar,
    Tool,
    ArrowUpRight,
    MapPin,
    Clock,
    CreditCard,
    Wrench,
    TrendingUp,
    TrendingDown,
    Activity,
    ChevronRight,
    Search
} from 'lucide-react-native';
import { SkeletonCard } from '../ui/Skeleton';

interface ArmadaDetailProps {
    id: number;
    onClose?: () => void;
}

export const ArmadaDetail = ({ id, onClose }: ArmadaDetailProps) => {
    const { data: detailData, isLoading, refetch } = useArmadaDetail(id);
    const [activeTab, setActiveTab] = useState<'trips' | 'repairs'>('trips');
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    if (isLoading && !refreshing) {
        return (
            <View className="p-6 space-y-6">
                <View className="h-20 bg-gray-100 rounded-3xl animate-pulse" />
                <View className="flex-row space-x-4">
                    <View className="flex-1 h-24 bg-gray-100 rounded-3xl animate-pulse" />
                    <View className="flex-1 h-24 bg-gray-100 rounded-3xl animate-pulse" />
                </View>
                <View className="space-y-4">
                    <SkeletonCard className="h-32" />
                    <SkeletonCard className="h-32" />
                    <SkeletonCard className="h-32" />
                </View>
            </View>
        );
    }

    if (!detailData) {
        return (
            <View className="p-10 items-center justify-center">
                <Typography className="text-gray-400">Data tidak tersedia</Typography>
            </View>
        );
    }

    const { armada, stats, muatan_history, perbaikan_history } = detailData;

    return (
        <ScrollView
            className="flex-1 bg-gray-50/30"
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            <View className="p-6">
                {/* Header Card */}
                <View className="bg-primary p-6 rounded-[32px] mb-6 shadow-lg shadow-primary/20">
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
                            <Truck size={28} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                        <Badge
                            variant={armada.is_active ? 'success' : 'neutral'}
                            label={armada.is_active ? 'Aktif' : 'Non-Aktif'}
                            className="bg-white/20 border-white/10"
                        />
                    </View>
                    <Typography variant="h2" weight="bold" className="text-white mb-1">
                        {armada.nama}
                    </Typography>
                    <View className="flex-row items-center">
                        <Typography className="text-white/80 font-bold tracking-widest text-base">
                            {armada.nopol}
                        </Typography>
                        <View className="mx-2 w-1.5 h-1.5 bg-white/30 rounded-full" />
                        <Typography className="text-white/60">
                            {armada.jenis || 'Armada Umum'}
                        </Typography>
                    </View>
                </View>

                {/* Bento Grid Stats */}
                <View className="flex-row flex-wrap -mx-2 mb-6">
                    {/* Trips Count */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mb-3">
                                <Activity size={20} color="#3B82F6" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Total Ritase</Typography>
                            <Typography weight="bold" className="text-xl text-textMain">{stats.total_ritase}</Typography>
                        </View>
                    </View>

                    {/* Revenue */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center mb-3">
                                <TrendingUp size={20} color="#10B981" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Pendapatan</Typography>
                            <Typography weight="bold" className="text-xl text-textMain">{formatCurrency(stats.total_pendapatan_kotor)}</Typography>
                        </View>
                    </View>

                    {/* Operational Costs */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center mb-3">
                                <TrendingDown size={20} color="#F59E0B" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Biaya Ops</Typography>
                            <Typography weight="bold" className="text-xl text-orange-600">{formatCurrency(stats.total_biaya_operasional)}</Typography>
                        </View>
                    </View>

                    {/* Workshop Repairs */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center mb-3">
                                <Wrench size={20} color="#EF4444" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Perbaikan</Typography>
                            <Typography weight="bold" className="text-xl text-red-600">{formatCurrency(stats.total_perbaikan_bengkel)}</Typography>
                        </View>
                    </View>
                </View>

                {/* Net Profit Summary */}
                <View className="bg-emerald-600 p-5 rounded-[28px] mb-8 shadow-md shadow-emerald-200">
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Typography variant="caption" className="text-emerald-100 opacity-80 uppercase tracking-widest font-bold mb-1">Total Laba TPM (Nett)</Typography>
                            <Typography variant="h3" weight="bold" className="text-white">
                                {formatCurrency(stats.total_pendapatan_kotor - stats.total_biaya_operasional - stats.total_perbaikan_bengkel)}
                            </Typography>
                        </View>
                        <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                            <ArrowUpRight size={24} color="#FFFFFF" />
                        </View>
                    </View>
                </View>

                {/* Tab Switcher */}
                <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-6">
                    <TouchableOpacity
                        onPress={() => setActiveTab('trips')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'trips' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Clock size={16} color={activeTab === 'trips' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'trips' ? 'bold' : 'medium'} className={activeTab === 'trips' ? 'text-primary' : 'text-gray-400'}>
                            Riwayat Trip
                        </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('repairs')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'repairs' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Wrench size={16} color={activeTab === 'repairs' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'repairs' ? 'bold' : 'medium'} className={activeTab === 'repairs' ? 'text-primary' : 'text-gray-400'}>
                            Perbaikan
                        </Typography>
                        {perbaikan_history.length > 0 && (
                            <View className="bg-red-100 px-1.5 py-0.5 rounded-md ml-1">
                                <Typography className="text-red-600 text-[10px] font-bold">{perbaikan_history.length}</Typography>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* List Content */}
                {activeTab === 'trips' ? (
                    <View className="space-y-4 pb-10">
                        {muatan_history.length === 0 ? (
                            <View className="py-20 items-center">
                                <Typography className="text-gray-400 italic">Belum ada riwayat trip</Typography>
                            </View>
                        ) : (
                            muatan_history.map((trip: any) => (
                                <View key={trip.id} className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex-row items-center">
                                    <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                                        <MapPin size={22} color="#3B82F6" />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row justify-between mb-1">
                                            <Typography weight="bold" className="text-textMain flex-1 mr-2" numberOfLines={1}>
                                                {trip.asal} → {trip.tujuan}
                                            </Typography>
                                            <Typography variant="caption" weight="bold" className="text-primary italic">
                                                {trip.ritase} Rit
                                            </Typography>
                                        </View>
                                        <Typography variant="caption" className="text-textGray mb-2">
                                            {formatDate(trip.tanggal)} • {trip.jenis_muatan || 'Muatan Umum'}
                                        </Typography>
                                        <View className="flex-row justify-between items-center pt-2 border-t border-gray-50">
                                            <View className="flex-row space-x-2">
                                                <Badge label={formatCurrency(trip.pendapatan_kotor)} variant="info" className="scale-75 origin-left" />
                                            </View>
                                            <Typography weight="bold" className="text-primary text-xs">
                                                +{formatCurrency(trip.laba_tpm)}
                                            </Typography>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                ) : (
                    <View className="space-y-4 pb-10">
                        {perbaikan_history.length === 0 ? (
                            <View className="py-20 items-center">
                                <Typography className="text-gray-400 italic">Belum ada riwayat perbaikan</Typography>
                            </View>
                        ) : (
                            perbaikan_history.map((item: any) => (
                                <View key={item.id} className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm">
                                    <View className="flex-row justify-between mb-3">
                                        <View className="flex-row items-center">
                                            <View className="w-8 h-8 bg-red-50 rounded-lg items-center justify-center mr-2">
                                                <Tool size={16} color="#EF4444" />
                                            </View>
                                            <Typography weight="bold" className="text-textMain">{item.nomor_transaksi}</Typography>
                                        </View>
                                        <Typography variant="caption" className="text-textGray">{formatDate(item.tanggal)}</Typography>
                                    </View>

                                    <View className="space-y-2 mb-3">
                                        {item.detail_services?.map((s: any, idx: number) => (
                                            <View key={idx} className="flex-row justify-between">
                                                <Typography variant="caption" className="text-textGray flex-1 mr-2">• {s.nama_jasa}</Typography>
                                                <Typography variant="caption" weight="medium">{formatCurrency(s.subtotal)}</Typography>
                                            </View>
                                        ))}
                                        {item.detail_parts?.map((p: any, idx: number) => (
                                            <View key={idx} className="flex-row justify-between">
                                                <Typography variant="caption" className="text-textGray flex-1 mr-2">• {p.spare_part_nama} (x{p.qty})</Typography>
                                                <Typography variant="caption" weight="medium">{formatCurrency(p.subtotal)}</Typography>
                                            </View>
                                        ))}
                                    </View>

                                    <View className="flex-row justify-between items-center pt-3 border-t border-gray-50">
                                        <Typography variant="caption" weight="bold" className="text-textGray">Total Biaya Perbaikan</Typography>
                                        <Typography weight="bold" className="text-red-600">
                                            {formatCurrency(item.grand_total)}
                                        </Typography>
                                    </View>

                                    {item.muatan_nomor && (
                                        <View className="mt-2 bg-blue-50 px-3 py-1.5 rounded-lg flex-row items-center self-start">
                                            <TrendingDown size={12} color="#3B82F6" />
                                            <Typography className="text-blue-600 text-[10px] ml-1 font-bold">Dibebankan ke: {item.muatan_nomor}</Typography>
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                )}
            </View>
        </ScrollView>
    );
};
