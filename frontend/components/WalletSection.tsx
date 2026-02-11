import { ArrowUp, Plus, History, Wallet, MoreHorizontal } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { TouchableOpacity, ActivityIndicator, View } from 'react-native';
import { useKasBankBalances } from '../hooks/useKeuangan';
import { formatCurrency } from '../utils/format';
import { router } from 'expo-router';

export const WalletSection = () => {
    const { data: balances, isLoading, isRefetching } = useKasBankBalances();

    return (
        <View className="px-6 mt-4">
            <View className="bg-gopayBlue rounded-3xl overflow-hidden shadow-lg shadow-gopayBlue/30">
                <View className="flex-row items-center p-4">
                    {/* Balance Area */}
                    <View className="bg-white rounded-2xl p-3 flex-1 flex-row items-center justify-between mr-4 shadow-sm">
                        <View className="flex-row items-center">
                            <View className="bg-gopayBlue/10 p-1.5 rounded-lg mr-2">
                                <Wallet size={16} color="#00ADEF" />
                            </View>
                            <View>
                                <Typography variant="caption" weight="bold" className="text-text tracking-tight h-4">Total Saldo</Typography>
                                {isLoading || isRefetching ? (
                                    <ActivityIndicator size="small" color="#00ADEF" style={{ height: 16 }} />
                                ) : (
                                    <Typography variant="body2" weight="bold" className="text-text">
                                        {formatCurrency(balances?.total_saldo || 0)}
                                    </Typography>
                                )}
                            </View>
                        </View>
                        <Typography className="text-[10px] text-gopayBlue font-bold bg-gopayBlue/10 px-1.5 py-0.5 rounded-md">KLIK</Typography>
                    </View>

                    {/* Quick Actions */}
                    <View className="flex-row items-center space-x-5 px-1">
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: '/finance/mutasi', params: { action: 'modal' } })}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-8 h-8 rounded-xl items-center justify-center mb-1">
                                <Plus size={20} color="white" strokeWidth={3} />
                            </View>
                            <Typography className="text-white text-[10px] font-bold">Masuk</Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/bengkel/expenses')}
                            className="items-center"
                        >
                            <View className="bg-white/20 w-8 h-8 rounded-xl items-center justify-center mb-1">
                                <ArrowUp size={20} color="white" strokeWidth={3} />
                            </View>
                            <Typography className="text-white text-[10px] font-bold">Keluar</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};
