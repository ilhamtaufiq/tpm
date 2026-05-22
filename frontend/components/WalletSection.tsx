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
                className="bg-[#6366f1] rounded-[32px] p-5 flex-row items-center justify-between shadow-lg shadow-indigo-500/30"
            >
                {/* Left Side: Saldo */}
                <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-3">
                        <Wallet size={20} color="white" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                            <Typography className="text-white/80 text-[10px] font-bold uppercase tracking-wider mr-2">
                                TOTAL SALDO
                            </Typography>
                            <View className="bg-white/20 px-2 py-0.5 rounded-full">
                                <Typography className="text-white text-[8px] font-bold">TRX</Typography>
                            </View>
                        </View>
                        {isLoading || isRefetching ? (
                            <ActivityIndicator size="small" color="white" className="mt-1 self-start" />
                        ) : (
                            <Typography weight="bold" className="text-white text-lg tracking-tight">
                                {formatCurrency(balances?.total_saldo || 0)}
                            </Typography>
                        )}
                    </View>
                </View>

                {/* Right Side: Actions */}
                <View className="flex-row space-x-2">
                    <Pressable
                        onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'modal' } })}
                        className="w-[60px] h-[60px] bg-white/20 border border-white/20 rounded-2xl items-center justify-center"
                    >
                        <Plus size={18} color="white" strokeWidth={2.5} className="mb-1" />
                        <Typography className="text-white text-[10px] font-bold">Masuk</Typography>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/finance/expenses')}
                        className="w-[60px] h-[60px] bg-white/20 border border-white/20 rounded-2xl items-center justify-center ml-2"
                    >
                        <ArrowUp size={18} color="white" strokeWidth={2.5} className="mb-1" />
                        <Typography className="text-white text-[10px] font-bold">Keluar</Typography>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};
