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

    const bopBalance = useMemo(() => {
        if (!balances) return 0;
        return (balances.bop_jasa_angkut_cash?.saldo || 0) +
            (balances.bop_jasa_angkut_bca?.saldo || 0) +
            (balances.bop_mobil_cash?.saldo || 0) +
            (balances.bop_mobil_bca?.saldo || 0);
    }, [balances]);

    return (
        <View className="px-6 mt-4">
            <View
                style={{ backgroundColor: themeColors.primary }}
                className="rounded-3xl overflow-hidden shadow-lg shadow-black/10"
            >
                <View className="flex-row items-center p-4">
                    {/* Balance Area */}
                    <View className="flex-1 mr-4">
                        <Pressable
                            onPress={() => router.push('/finance/mutasi')}
                            className="bg-white rounded-2xl p-3 flex-row items-center justify-between shadow-sm mb-2"
                        >
                            <View className="flex-row items-center">
                                <View
                                    style={{ backgroundColor: `${themeColors.primary}10` }}
                                    className="p-1.5 rounded-lg mr-2"
                                >
                                    <Wallet size={14} color={themeColors.primary} />
                                </View>
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-text tracking-tight h-3 text-[9px] uppercase">Total Saldo</Typography>
                                    {isLoading || isRefetching ? (
                                        <ActivityIndicator size="small" color={themeColors.primary} style={{ height: 16 }} />
                                    ) : (
                                        <Typography variant="body2" weight="bold" className="text-text text-xs">
                                            {formatCurrency(balances?.total_saldo || 0)}
                                        </Typography>
                                    )}
                                </View>
                            </View>
                            <Typography
                                style={{ color: themeColors.primary, backgroundColor: `${themeColors.primary}10` }}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                            >
                                TRX
                            </Typography>
                        </Pressable>
                    </View>

                    {/* Quick Actions */}
                    <View className="flex-row items-center space-x-5 px-1">
                        <Pressable
                            onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'modal' } })}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-8 h-8 rounded-xl items-center justify-center mb-1">
                                <Plus size={20} color="white" strokeWidth={3} />
                            </View>
                            <Typography className="text-white text-[10px] font-bold">Masuk</Typography>
                        </Pressable>

                        <Pressable
                            onPress={() => router.push('/bengkel/expenses')}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-8 h-8 rounded-xl items-center justify-center mb-1">
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
