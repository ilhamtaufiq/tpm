import { ArrowUp, Plus, History, Wallet, MoreHorizontal, Users } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { Pressable, ActivityIndicator, View } from 'react-native';
import { useKasBankBalances } from '../hooks/useKeuangan';
import { formatCurrency } from '../utils/format';
import { router } from 'expo-router';
import { useUIStore } from '../store/useUIStore';
import React, { useMemo } from 'react';

export const WalletSection = () => {
    const { data: balances, isLoading, isRefetching } = useKasBankBalances();
    const { themeColors } = useUIStore();

    const units = useMemo(() => {
        if (!balances) return [];
        return [
            { id: 'bengkel', label: 'Bengkel', value: balances.kas_unit_bengkel?.saldo || 0, color: '#3B82F6' },
            { id: 'jasa_angkut', label: 'JA', value: balances.kas_unit_jasa_angkut?.saldo || 0, color: '#10B981' },
            { id: 'mobil', label: 'Mobil', value: balances.kas_unit_mobil?.saldo || 0, color: '#F59E0B' },
        ].filter(u => u.value > 0);
    }, [balances]);

    return (
        <View className="px-6 mt-4">
            <View
                style={{ backgroundColor: themeColors.primary }}
                className="rounded-3xl overflow-hidden shadow-lg shadow-black/10"
            >
                <View className="items-center px-4 pt-4 pb-2">
                    <Typography variant="caption" className="text-white/70 font-bold uppercase tracking-wider mb-1">
                        Kas Utama & Bank
                    </Typography>
                    {isLoading || isRefetching ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Typography variant="h2" weight="bold" className="text-white text-2xl">
                            {formatCurrency(balances?.total_saldo || 0)}
                        </Typography>
                    )}
                </View>

                {/* Unit Breakdown */}
                {units.length > 0 && (
                    <View className="flex-row items-center justify-center space-x-4 mb-4 px-4">
                        {units.map((unit) => (
                            <View key={unit.id} className="items-center bg-black/10 px-2.5 py-1 rounded-xl">
                                <Typography className="text-white/60 text-[8px] font-bold uppercase">{unit.label}</Typography>
                                <Typography className="text-white text-[10px] font-bold">{formatCurrency(unit.value)}</Typography>
                            </View>
                        ))}
                    </View>
                )}

                <View className="flex-row items-center justify-between p-4 bg-white/10">
                    {/* Quick Actions */}
                    <View className="flex-row items-center space-x-6 flex-1 justify-around">
                        <Pressable
                            onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'modal' } })}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-10 h-10 rounded-2xl items-center justify-center mb-1">
                                <Plus size={20} color="white" strokeWidth={3} />
                            </View>
                            <Typography className="text-white text-[10px] font-bold">Masuk</Typography>
                        </Pressable>

                        <Pressable
                            onPress={() => router.push('/finance/mutasi')}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-10 h-10 rounded-2xl items-center justify-center mb-1">
                                <History size={20} color="white" strokeWidth={3} />
                            </View>
                            <Typography className="text-white text-[10px] font-bold">Setoran</Typography>
                        </Pressable>

                        <Pressable
                            onPress={() => router.push('/bengkel/expenses')}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-10 h-10 rounded-2xl items-center justify-center mb-1">
                                <ArrowUp size={20} color="white" strokeWidth={3} />
                            </View>
                            <Typography className="text-white text-[10px] font-bold">Keluar</Typography>
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    );
};
