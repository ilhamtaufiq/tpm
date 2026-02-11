import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Wrench, CarFront, Truck, Wallet, Receipt, User, HelpCircle, ArrowRight } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { Badge } from './ui/Badge';
import { useRecentActivity } from '../hooks/useKeuangan';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { ActivityItem } from '../services/keuangan';
import { router } from 'expo-router';
import { formatCurrency } from '../utils/format';

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

export const TransactionList = () => {
    const { data: transactions, isLoading } = useRecentActivity(5);

    if (isLoading) {
        return (
            <View className="px-6 mt-8 items-center justify-center py-10">
                <ActivityIndicator color="#00AA13" />
            </View>
        );
    }

    const list = Array.isArray(transactions) ? transactions : [];

    return (
        <View className="px-6 mt-8 pb-32">
            <View className="flex-row justify-between items-center mb-6">
                <Typography variant="h3" weight="bold">Aktivitas Terkini</Typography>
                <TouchableOpacity onPress={() => router.push('/history')}>
                    <Typography variant="caption" weight="bold" className="text-primary">Lihat Riwayat</Typography>
                </TouchableOpacity>
            </View>

            {list.length === 0 ? (
                <View className="items-center py-12 bg-gray-50 rounded-3xl border border-gray-100 border-dashed">
                    <Typography className="text-gray-400 font-medium">Belum ada aktivitas</Typography>
                </View>
            ) : (
                list.map((item: ActivityItem) => {
                    const config = getSourceConfig(item.source);
                    const Icon = config.icon;
                    const badge = getStatusBadge(item.status);

                    return (
                        <TouchableOpacity
                            key={item.id}
                            className="flex-row items-center bg-white p-4 rounded-3xl mb-3 border border-gray-100 shadow-sm"
                            activeOpacity={0.8}
                        >
                            <View
                                style={{ backgroundColor: `${config.color}10` }}
                                className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                            >
                                <Icon size={22} color={config.color} strokeWidth={2.5} />
                            </View>

                            <View className="flex-1">
                                <Typography variant="body2" weight="bold" className="text-text mb-0.5" numberOfLines={1}>
                                    {item.title}
                                </Typography>
                                <Typography variant="caption" className="text-textGray text-[11px]">
                                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: localeID })}
                                </Typography>
                            </View>

                            <View className="items-end ml-2">
                                <Typography weight="bold" className={item.is_incoming ? "text-emerald-600" : "text-rose-500"}>
                                    {item.is_incoming ? '+' : '-'} {formatCurrency(item.amount)}
                                </Typography>
                                <Badge
                                    label={badge.label}
                                    variant={badge.variant as any}
                                    className="mt-1 transform scale-75 origin-right"
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}
        </View>
    );
};
