import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
    ChevronLeft, 
    Wallet, 
    User, 
    ArrowRightLeft,
    TrendingUp,
    Search,
    RefreshCw
} from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { useKasBankBalances } from '../../hooks/useKeuangan';
import { formatCurrency } from '../../utils/format';
import { Skeleton } from '../../components/ui/Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserWalletsScreen() {
    const router = useRouter();
    const { data: balances, isLoading, refetch } = useKasBankBalances();
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const cashData = balances?.cash;
    const users = cashData?.breakdown || [];
    
    const filteredUsers = users.filter(user => 
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalUserCash = users.reduce((acc, curr) => acc + curr.balance, 0);

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Premium Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity 
                            onPress={() => router.back()}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">
                                Saldo User
                            </Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Rincian Cash per Personil</Typography>
                        </View>
                    </View>
                    <TouchableOpacity 
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <RefreshCw size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Total Cash Bento */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/5">
                    <View className="flex-row items-center mb-1">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Total Cash di Pegang User</Typography>
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2" />
                    </View>
                    <View className="flex-row items-baseline">
                        <Typography className="text-white/60 text-lg mr-1 font-bold">Rp</Typography>
                        <Typography weight="bold" className="text-white text-4xl">
                            {formatCurrency(totalUserCash).replace('Rp', '').trim()}
                        </Typography>
                    </View>
                    
                    <View className="flex-row mt-6 pt-6 border-t border-white/5 items-center justify-between">
                         <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-emerald-400/20 items-center justify-center mr-3">
                                <User size={14} color="#34D399" />
                            </View>
                            <Typography className="text-white/60 text-xs font-bold">{users.length} Personil Aktif</Typography>
                         </View>
                         <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase">Real Time</Typography>
                         </View>
                    </View>
                </View>
            </View>

            {/* Floating Search */}
            <View className="px-6 -mt-6 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                    <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput 
                            className="flex-1 ml-3 text-sm font-medium text-gray-800"
                            placeholder="Cari personil..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>
            </View>

            <ScrollView 
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                <Typography className="text-gray-400 text-[10px] uppercase font-bold mb-4 ml-1 tracking-widest">Daftar Pemegang Cash</Typography>
                
                {isLoading ? (
                    [1, 2, 3].map(i => (
                        <View key={i} className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 flex-row items-center">
                            <Skeleton width={64} height={64} borderRadius={20} style={{ marginRight: 16 }} />
                            <View className="flex-1">
                                <Skeleton width="60%" height={24} style={{ marginBottom: 8 }} />
                                <Skeleton width="40%" height={16} />
                            </View>
                        </View>
                    ))
                ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <TouchableOpacity 
                            key={user.user_id}
                            onPress={() => router.push({ pathname: '/finance/mutasi', params: { user_id: user.user_id, jenis: 'CASH' } })}
                            className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            <View className="w-16 h-16 bg-primary/5 rounded-[20px] items-center justify-center mr-4">
                                <User size={28} color="#023C69" />
                            </View>
                            
                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-0.5">
                                    <Typography className="text-primary text-[8px] font-bold uppercase tracking-widest opacity-60">
                                        Wallet Personil
                                    </Typography>
                                    <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                        <Typography className="text-emerald-600 text-[8px] font-bold uppercase">AKTIF</Typography>
                                    </View>
                                </View>
                                
                                <View className="mb-3">
                                    <Typography variant="body1" weight="bold" className="text-gray-800">
                                        {user.full_name}
                                    </Typography>
                                    <Typography className="text-gray-400 text-xs">@{user.username}</Typography>
                                </View>
                                
                                <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] uppercase font-bold">Saldo Saat Ini</Typography>
                                        <Typography variant="h3" weight="bold" className="text-primary mt-0.5">
                                            {formatCurrency(user.balance)}
                                        </Typography>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'transfer', from_user: user.user_id } })}
                                        className="bg-primary/5 px-4 py-2 rounded-xl flex-row items-center border border-primary/10"
                                    >
                                        <ArrowRightLeft size={14} color="#023C69" />
                                        <Typography className="text-primary text-xs font-bold ml-2">Transfer</Typography>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View className="items-center justify-center py-20 opacity-30">
                        <Wallet size={80} color="#023C69" />
                        <Typography className="mt-4 font-bold tracking-[4px] uppercase text-xs">Belum ada saldo</Typography>
                    </View>
                )}
                
                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
