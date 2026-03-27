import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Truck, AlertTriangle, Wallet } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { usePiutangSummary, useDashboardSummary } from '../hooks/useKeuangan';
import { useLowStockParts } from '../hooks/useBengkel';

export const BusinessPulse = () => {
    const { data: piutang, isLoading: piutangLoading, isRefetching: piutangRefetching } = usePiutangSummary();
    const { data: dashboard, isLoading: dashboardLoading, isRefetching: dashboardRefetching } = useDashboardSummary();
    const { data: lowStock, isLoading: lowStockLoading, isRefetching: lowStockRefetching } = useLowStockParts();

    const stats = [
        {
            id: 'trips',
            label: 'Trip Aktif',
            value: dashboard?.active_trips || 0,
            icon: Truck,
            color: '#10B981',
            isLoading: dashboardLoading || dashboardRefetching,
        },
        {
            id: 'lowStock',
            label: 'Stok Tipis',
            value: lowStock?.length || 0,
            icon: AlertTriangle,
            color: '#F59E0B',
            isLoading: lowStockLoading || lowStockRefetching,
        },
        {
            id: 'piutang',
            label: 'Pending',
            value: piutang?.jumlah_belum_lunas || 0,
            icon: Wallet,
            color: '#3B82F6',
            isLoading: piutangLoading || piutangRefetching,
        }
    ];

    return (
        <View className="px-6 mt-8">
            <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3" weight="bold">Business Pulse</Typography>
                <View className="h-1.5 w-1.5 bg-secondary rounded-full animate-pulse" />
            </View>
            <View className="flex-row justify-between">
                {stats.map((stat) => (
                    <Pressable
                        key={stat.id}
                        className="w-[31%] bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm"
                        activeOpacity={0.7}
                    >
                        <View
                            style={{ backgroundColor: `${stat.color}15` }}
                            className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                        >
                            <stat.icon size={20} color={stat.color} />
                        </View>
                        {stat.isLoading ? (
                            <ActivityIndicator size="small" color={stat.color} style={{ alignSelf: 'flex-start' }} />
                        ) : (
                            <Typography variant="h3" weight="bold" className="text-textMain">{stat.value}</Typography>
                        )}
                        <Typography variant="caption" className="text-textGray mt-0.5">{stat.label}</Typography>
                    </Pressable>
                ))}
            </View>
        </View>
    );
};
