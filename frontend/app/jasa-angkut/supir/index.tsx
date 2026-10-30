import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import { View, FlatList, RefreshControl, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/dist/esm/icons/chevron-left.js';
import Plus from 'lucide-react-native/dist/esm/icons/plus.js';
import Search from 'lucide-react-native/dist/esm/icons/search.js';
import Users from 'lucide-react-native/dist/esm/icons/users.js';
import { Typography } from '../../../components/ui/Typography';
import { Input } from '../../../components/ui/Input';
import { DriverCard } from '../../../components/jasa-angkut/DriverCard';
import { jasaAngkutService, Supir } from '../../../services/jasaAngkut';
import { useSupirList } from '../../../hooks/useJasaAngkut';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Header } from '../../../components/ui/Header';
import { useUIStore } from '../../../store/useUIStore';

export default function SupirScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
    const router = useRouter(); const [filterActive, setFilterActive] = useState<boolean | undefined>(true);
    const [searchQuery, setSearchQuery] = useState('');
    // Debounce: tanpa ini tiap ketikan = query baru + render ulang layar penuh (lag di Android).
    const debouncedSearch = useDebounce(searchQuery, 350);
    const [refreshing, setRefreshing] = useState(false);

    // API Hook
    const { data: supirData, isLoading, refetch } = useSupirList({
        is_active: filterActive,
        search: debouncedSearch,
        sort_by: 'nama',
        sort_order: 'asc'
    });

    const drivers = supirData?.data || [];

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);


    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <Header 
                title="Data Supir" 
                showBackButton={true}
                onBackButtonPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/jasa-angkut');
                    }
                }}
                rightElement={
                    <Pressable
                        onPress={() => router.push('/jasa-angkut/supir/form')}
                        className="w-10 h-10 bg-surface/20 rounded-xl items-center justify-center border border-white/10"
                    >
                        <Plus size={20} color="white" />
                    </Pressable>
                }
            />

            {/* Search & Filter */}
            <View className="p-4 bg-surface border-b border-transparent">
                <Input
                    placeholder="Cari supir..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    startIcon={<Search size={20} color={themeColors.textGray} />}
                    containerClassName="mb-3"
                />

                <View className="flex-row space-x-2">
                    <FilterTab
                        label="Semua"
                        active={filterActive === undefined}
                        onPress={() => setFilterActive(undefined)}
                    />
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
                </View>

            <View className="px-4 pt-3 bg-surface">
                <Pressable
                    onPress={() => router.push('/jasa-angkut/supir/form')}
                    className="bg-primary h-11 rounded-2xl flex-row items-center justify-center"
                >
                    <Plus size={18} color="white" />
                    <Typography weight="bold" className="text-white text-sm ml-2">Tambah Supir</Typography>
                </Pressable>
            </View>
            </View>

            <FlatList
                data={drivers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <DriverCard
                        supir={item}
                        onPress={() => router.push(`/jasa-angkut/supir/form?id=${item.id}`)}
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
                            title="Tidak ada supir ditemukan"
                            description={searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : "Belum ada data supir."}
                            icon={Users}
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
        className={`px-4 py-1.5 rounded-full border ${active ? 'bg-primary border-primary' : 'bg-transparent border-transparent'}`}
    >
        <Typography
            variant="caption"
            weight="medium"
            className={active ? 'text-white' : 'text-textGray'}
        >
            {label}
        </Typography>
    </Pressable>
);
