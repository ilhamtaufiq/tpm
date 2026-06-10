import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Header } from '../../components/ui/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import {
    Users,
    Building2,
    ChevronRight,
    Wrench,
    Tag,
    Box,
    Clock,
    Activity,
    CheckCircle2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { masterDataService } from '../../services/masterData';
import { useAuthStore } from '../../store/useAuthStore';

export default function MasterDataScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ customers: 0, suppliers: 0, spareparts: 0, jasa: 0, assets: 0 });

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const loadData = useCallback(async () => {
        try {
            const res = await masterDataService.getMasterDataStats();
            setStats({
                customers: res.customers || 0,
                suppliers: res.suppliers || 0,
                spareparts: res.spareparts || 0,
                jasa: res.jasa || 0,
                assets: res.assets || 0,
            });
        } catch (error) {
            console.error('Failed to load master data stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface items-center justify-center">
                <ActivityIndicator size="large" color="#023C69" />
            </View>
        );
    }

    const statsPills = [
        { label: 'Customer', key: 'customers', color: '#3B82F6', icon: Clock, value: stats.customers },
        { label: 'Supplier', key: 'suppliers', color: '#F59E0B', icon: Activity, value: stats.suppliers },
        { label: 'Sparepart', key: 'spareparts', color: '#059669', icon: CheckCircle2, value: stats.spareparts },
        { label: 'Jasa Servis', key: 'jasa', color: '#8B5CF6', icon: Tag, value: stats.jasa },
        { label: 'Aset', key: 'assets', color: '#E11D48', icon: Box, value: stats.assets },
    ];

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header
                title="Data Master"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            />

            <ScrollView
                className="flex-1 px-6 mt-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats Pills (Bengkel-style) */}
                <View className="mb-6">
                    <View className="flex-row flex-wrap">
                        {statsPills.map(({ label, key, color, icon: Icon, value }) => (
                            <View key={key} className="w-1/3 px-1 mb-2">
                                <View className="bg-white px-3 py-2.5 rounded-2xl border border-gray-100">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <View style={{ backgroundColor: color + '15' }} className="w-5 h-5 rounded-full items-center justify-center">
                                            <Icon size={10} color={color} />
                                        </View>
                                        <Typography weight="bold" style={{ color }} className="text-sm leading-none">
                                            {value}
                                        </Typography>
                                    </View>
                                    <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest">
                                        {label}
                                    </Typography>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Menu Items */}
                <View className="pt-2 pb-10">
                    <Pressable onPress={() => router.push('/master-data/customer')}>
                        <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                            <View className="w-16 h-16 bg-blue-50 rounded-[20px] items-center justify-center mr-4 border border-blue-100/50">
                                <Users size={32} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Typography variant="body1" weight="bold" className="text-textMain text-lg">Customer</Typography>
                                    <View className="bg-blue-50 px-2 py-1 rounded-lg">
                                        <Typography className="text-blue-600 text-[10px] font-bold">{stats.customers} Data</Typography>
                                    </View>
                                </View>
                                <Typography className="text-textGray text-xs leading-relaxed">
                                    Kelola database pelanggan, riwayat servis, dan kontak.
                                </Typography>
                            </View>
                            <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                                <ChevronRight size={16} color="#9CA3AF" />
                            </View>
                        </View>
                    </Pressable>

                    <Pressable onPress={() => router.push('/master-data/supplier')}>
                        <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                            <View className="w-16 h-16 bg-amber-50 rounded-[20px] items-center justify-center mr-4 border border-amber-100/50">
                                <Building2 size={32} color="#F59E0B" />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Typography variant="body1" weight="bold" className="text-textMain text-lg">Supplier</Typography>
                                    <View className="bg-amber-50 px-2 py-1 rounded-lg">
                                        <Typography className="text-amber-600 text-[10px] font-bold">{stats.suppliers} Data</Typography>
                                    </View>
                                </View>
                                <Typography className="text-textGray text-xs leading-relaxed">
                                    Database pemasok, purchasing, dan detail kontak vendor.
                                </Typography>
                            </View>
                            <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                                <ChevronRight size={16} color="#9CA3AF" />
                            </View>
                        </View>
                    </Pressable>

                    <Pressable onPress={() => router.push('/master-data/sparepart')}>
                        <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                            <View className="w-16 h-16 bg-emerald-50 rounded-[20px] items-center justify-center mr-4 border border-emerald-100/50">
                                <Wrench size={32} color="#059669" />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Typography variant="body1" weight="bold" className="text-textMain text-lg">Sparepart</Typography>
                                    <View className="bg-emerald-50 px-2 py-1 rounded-lg">
                                        <Typography className="text-emerald-600 text-[10px] font-bold">{stats.spareparts} Items</Typography>
                                    </View>
                                </View>
                                <Typography className="text-textGray text-xs leading-relaxed">
                                    Inventori barang, stok opname, dan manajemen harga.
                                </Typography>
                            </View>
                            <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                                <ChevronRight size={16} color="#9CA3AF" />
                            </View>
                        </View>
                    </Pressable>

                    <Pressable onPress={() => router.push('/master-data/jasa-servis')}>
                        <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                            <View className="w-16 h-16 bg-purple-50 rounded-[20px] items-center justify-center mr-4 border border-purple-100/50">
                                <Tag size={32} color="#8B5CF6" />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Typography variant="body1" weight="bold" className="text-textMain text-lg">Jasa Servis</Typography>
                                    <View className="bg-purple-50 px-2 py-1 rounded-lg">
                                        <Typography className="text-purple-600 text-[10px] font-bold">{stats.jasa} Data</Typography>
                                    </View>
                                </View>
                                <Typography className="text-textGray text-xs leading-relaxed">
                                    Master data jasa perbaikan dan servis bengkel.
                                </Typography>
                            </View>
                            <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                                <ChevronRight size={16} color="#9CA3AF" />
                            </View>
                        </View>
                    </Pressable>

                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <Pressable onPress={() => router.push('/master-data/asset')}>
                            <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                                <View className="w-16 h-16 bg-rose-50 rounded-[20px] items-center justify-center mr-4 border border-rose-100/50">
                                    <Box size={32} color="#E11D48" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Typography variant="body1" weight="bold" className="text-textMain text-lg">Aset Perusahaan</Typography>
                                        <View className="bg-rose-50 px-2 py-1 rounded-lg">
                                            <Typography className="text-rose-600 text-[10px] font-bold">Aktiva Tetap</Typography>
                                        </View>
                                    </View>
                                    <Typography className="text-textGray text-xs leading-relaxed">
                                        Kelola aset fisik, inventori kantor, dan properti perusahaan.
                                    </Typography>
                                </View>
                                <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                                    <ChevronRight size={16} color="#9CA3AF" />
                                </View>
                            </View>
                        </Pressable>
                    )}
                    <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 16) }} />
                </View>
            </ScrollView>
        </View>
    );
}
