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
        <View className="px-4 sm:px-6 mt-4 w-full">
            <View
                className="bg-[#6366f1] rounded-[24px] sm:rounded-[32px] p-4 sm:p-5 flex-row items-center justify-between shadow-lg shadow-indigo-500/30"
            >
                {/* Left Side: Saldo */}
                <View className="flex-row items-center flex-1 mr-2 sm:mr-4">
                    <View className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                        <Wallet size={18} color="white" className="sm:w-5 sm:h-5" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                            <Typography className="text-white/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mr-1 sm:mr-2">
                                TOTAL SALDO
                            </Typography>
                            <View className="bg-white/20 px-2 py-0.5 rounded-full">
                                <Typography className="text-white text-[7px] sm:text-[8px] font-bold">TRX</Typography>
                            </View>
                        </View>
                        {isLoading || isRefetching ? (
                            <ActivityIndicator size="small" color="white" className="mt-1 self-start" />
                        ) : (
                            <Typography 
                                weight="bold" 
                                className="text-white text-base sm:text-lg tracking-tight"
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {formatCurrency(balances?.total_saldo || 0)}
                            </Typography>
                        )}
                    </View>
                </View>

                {/* Right Side: Actions */}
                <View className="flex-row gap-2 flex-shrink-0">
                    <Pressable
                        onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'modal' } })}
                        className="w-12 h-12 sm:w-[60px] sm:h-[60px] bg-white/20 border border-white/20 rounded-xl sm:rounded-2xl items-center justify-center active:bg-white/30"
                    >
                        <Plus size={16} color="white" strokeWidth={2.5} className="mb-0.5 sm:mb-1" />
                        <Typography className="text-white text-[9px] sm:text-[10px] font-bold">Masuk</Typography>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/finance/expenses')}
                        className="w-12 h-12 sm:w-[60px] sm:h-[60px] bg-white/20 border border-white/20 rounded-xl sm:rounded-2xl items-center justify-center active:bg-white/30"
                    >
                        <ArrowUp size={16} color="white" strokeWidth={2.5} className="mb-0.5 sm:mb-1" />
                        <Typography className="text-white text-[9px] sm:text-[10px] font-bold">Keluar</Typography>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};
