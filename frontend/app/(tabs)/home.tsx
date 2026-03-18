import { ScrollView, StatusBar, View, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../components/ui/Header';
import { WalletSection } from '../../components/WalletSection';
import { ServiceGrid } from '../../components/ServiceGrid';
import { StatsSlider } from '../../components/StatsSlider';
import { TransactionList } from '../../components/TransactionList';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useUIStore } from '../../store/useUIStore';

export default function HomeScreen() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = React.useState(false);
    const { themeColors } = useUIStore();

    useFocusEffect(
        React.useCallback(() => {
            queryClient.invalidateQueries();
        }, [queryClient])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries();
        setTimeout(() => setRefreshing(false), 1000);
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <Header variant="home" showSearch showProfile />
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={themeColors.primary} />}
                >
                    {/* <WalletSection /> */}
                    <ServiceGrid />
                    {/* <StatsSlider /> */}
                    {/* <TransactionList /> */}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
