import { ScrollView, StatusBar, View, RefreshControl, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Header } from '../../components/ui/Header';
import { WalletSection } from '../../components/WalletSection';
import { ServiceGrid } from '../../components/ServiceGrid';
import { StatsSlider } from '../../components/StatsSlider';
import { TransactionList } from '../../components/TransactionList';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getFileUrl } from '../../utils/image';

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = React.useState(false);
    const { themeColors } = useUIStore();
    const { user } = useAuthStore();

    const router = useRouter();

    useFocusEffect(
        React.useCallback(() => {
            if (!user) return;

            // Role Guard: Redirect specific roles away from Home
            if (user.role === 'BENGKEL') {
                router.replace('/bengkel');
                return;
            }
            if (user.role === 'JASA_ANGKUT') {
                router.replace('/jasa-angkut');
                return;
            }
            if (user.role === 'MOBIL') {
                router.replace('/mobil');
                return;
            }

            queryClient.invalidateQueries({ queryKey: ['home'] });
        }, [queryClient, user, router])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ['home'] });
        setRefreshing(false);
    };

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Image (User Custom) */}
            {user?.home_background && (
                <Image 
                    source={{ uri: getFileUrl(user.home_background) as string }} 
                    className="absolute inset-0 w-full h-full opacity-10" 
                    resizeMode="cover"
                />
            )}

            <View className="flex-1">
                <Header variant="home" showSearch={false} showProfile={false} />
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 32) }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={themeColors.primary} />}
                >
                    <WalletSection />
                    <ServiceGrid />
                    <TransactionList />
                </ScrollView>
            </View>
        </View>
    );
}
