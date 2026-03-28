import { ArrowUp, Plus, Wallet } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { Pressable, ActivityIndicator, View } from 'react-native';
import { useKasBankBalances } from '../hooks/useKeuangan';
import { formatCurrency } from '../utils/format';
import { router } from 'expo-router';
import { useUIStore } from '../store/useUIStore';
import React from 'react';

export const WalletSection = () => {
    const { data: balances, isLoading, isRefetching } = useKasBankBalances();
    const { themeColors } = useUIStore();

    return (
        <View className="px-6 mt-4">
            <View
                style={{ backgroundColor: themeColors.primary }}
                className="rounded-[32px] p-2 flex-row items-center shadow-lg shadow-black/10"
            >
                {/* Saldo Pill */}
                <View className="flex-1 bg-white rounded-3xl p-3 flex-row items-center">
                    <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-3 border border-gray-100">
                        <Wallet size={20} color="#64748b" />
                    </View>
                    <View className="flex-1">
                        <Typography className="text-gray-400 text-[8px] font-bold uppercase tracking-wider">
                            TOTAL SALDO
                        </Typography>
                        {isLoading || isRefetching ? (
                            <ActivityIndicator size="small" color="#023C69" />
                        ) : (
                            <Typography weight="bold" className="text-primary text-base">
                                {formatCurrency(balances?.total_saldo || 0)}
                            </Typography>
                        )}
                    </View>
                    <View className="bg-gray-100 px-2 py-0.5 rounded-lg">
                        <Typography className="text-gray-400 text-[8px] font-bold">TRX</Typography>
                    </View>
                </View>

                {/* Actions */}
                <View className="flex-row px-3 space-x-4">
                    <Pressable
                        onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'modal' } })}
                        className="items-center"
                    >
                        <View className="bg-white/20 w-10 h-10 rounded-2xl items-center justify-center mb-1">
                            <Plus size={20} color="white" strokeWidth={3} />
                        </View>
                        <Typography className="text-white text-[8px] font-bold">Masuk</Typography>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/finance/expenses')}
                        className="items-center"
                    >
                        <View className="bg-white/20 w-10 h-10 rounded-2xl items-center justify-center mb-1">
                            <ArrowUp size={20} color="white" strokeWidth={3} />
                        </View>
                        <Typography className="text-white text-[8px] font-bold">Keluar</Typography>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};
