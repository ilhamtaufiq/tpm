import { ScrollView, StatusBar, View } from 'react-native';
import { HomeHeader } from '../../components/HomeHeader';
import { WalletSection } from '../../components/WalletSection';
import { ServiceGrid } from '../../components/ServiceGrid';
import { StatsSlider } from '../../components/StatsSlider';
import { TransactionList } from '../../components/TransactionList';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

export default function HomeScreen() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries();
        setTimeout(() => setRefreshing(false), 1000);
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <HomeHeader onRefresh={handleRefresh} refreshing={refreshing} />
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                >
                    <WalletSection />
                    <ServiceGrid />
                    <StatsSlider />
                    <TransactionList />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
