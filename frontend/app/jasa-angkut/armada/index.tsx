import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Search, Truck } from 'lucide-react-native';
import { Typography } from '../../../components/ui/Typography';
import { Input } from '../../../components/ui/Input';
import { FleetCard } from '../../../components/jasa_angkut/FleetCard';
import { useArmadaList } from '../../../hooks/useJasaAngkut';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

export default function ArmadaScreen() {
    const router = useRouter();
    const [filterActive, setFilterActive] = useState<boolean | undefined>(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // API Hook
    const { data: armadaData, isLoading, refetch } = useArmadaList({
        is_active: filterActive,
        search: searchQuery
    });

    const fleet = armadaData?.data || [];

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
                <View className="flex-row items-center">
                    <Pressable
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/jasa-angkut');
                            }
                        }}
                        className="mr-4"
                    >
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <Typography variant="h2" weight="bold">Data Armada</Typography>
                </View>
                <Pressable
                    onPress={() => router.push('/jasa-angkut/armada/form')}
                    className="w-10 h-10 bg-primary rounded-full items-center justify-center"
                >
                    <Plus size={20} color="white" />
                </Pressable>
            </View>

            {/* Search & Filter */}
            <View className="p-4 bg-white border-b border-gray-100">
                <Input
                    placeholder="Cari armada (nama/nopol)..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    startIcon={<Search size={20} color="#9CA3AF" />}
                    containerClassName="mb-3"
                />

                <View className="flex-row space-x-2">
                    <FilterTab
                        label="Aktif"
                        active={filterActive === true}
                        onPress={() => setFilterActive(true)}
                    />
                    <FilterTab
                        label="Non-Aktif"
                        active={filterActive === false}
                        onPress={() => setFilterActive(false)}
                    />
                    <FilterTab
                        label="Semua"
                        active={filterActive === undefined}
                        onPress={() => setFilterActive(undefined)}
                    />
                </View>
            </View>

            <FlatList
                data={fleet}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <FleetCard
                        armada={item}
                        onPress={() => router.push(`/jasa-angkut/armada/detail/${item.id}`)}
                    />
                )}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponent={
                    isLoading ? (
                        <View>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    isLoading ? null : (
                        <EmptyState
                            title="Tidak ada armada ditemukan"
                            description={searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : "Belum ada data armada."}
                            icon={Truck}
                        />
                    )
                }
            />
        </SafeAreaView>
    );
}

const FilterTab = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
    <Pressable
        onPress={onPress}
        className={`px-4 py-1.5 rounded-full border ${active ? 'bg-primary border-primary' : 'bg-transparent border-gray-200'}`}
    >
        <Typography
            variant="caption"
            weight="medium"
            className={active ? 'text-white' : 'text-gray-600'}
        >
            {label}
        </Typography>
    </Pressable>
);
