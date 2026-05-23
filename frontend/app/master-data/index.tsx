import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import {
    ChevronLeft,
    Users,
    Building2,
    Settings,
    ChevronRight,
    RefreshCw,
    Database,
    Archive,
    Wrench,
    Tag,
    Box,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { masterDataService } from '../../services/masterData';
import { bengkelService } from '../../services/bengkel';
import { jasaServisService } from '../../services/jasaServis';
import { useAuthStore } from '../../store/useAuthStore';

export default function MasterDataScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
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
            const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
            
            const promises: any[] = [
                masterDataService.getCustomerList({ limit: 1 }),
                masterDataService.getSupplierList({ limit: 1 }),
                bengkelService.getSpareParts({ limit: 1 }),
                jasaServisService.getJasaList({ limit: 1 }),
            ];
            
            if (isAdminOrManager) {
                promises.push(masterDataService.getAssetList({ size: 1 }));
            }
            
            const results = await Promise.allSettled(promises);
            
            const customersRes = results[0].status === 'fulfilled' ? results[0].value : { total: 0 };
            const suppliersRes = results[1].status === 'fulfilled' ? results[1].value : { total: 0 };
            const sparePartsRes = results[2].status === 'fulfilled' ? results[2].value : { total: 0 };
            const jasaRes = results[3].status === 'fulfilled' ? results[3].value : { total: 0 };
            const assetsRes = isAdminOrManager && results[4]?.status === 'fulfilled' ? results[4].value : { total: 0 };

            setStats({
                customers: customersRes.total || 0,
                suppliers: suppliersRes.total || 0,
                spareparts: sparePartsRes.total || 0,
                jasa: jasaRes.total || 0,
                assets: assetsRes.total || 0,
            });
        } catch (error) {
            console.error('Failed to load master data stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.role]);

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

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Master Data</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Pusat Data & Inventori</Typography>
                        </View>
                    </View>
                </View>

                {/* Database Summary (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-white/20 px-3 py-1.5 rounded-full border border-white/10">
                            <Typography className="text-white text-[10px] font-bold uppercase tracking-widest">System Assets</Typography>
                        </View>
                        <Typography className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total Entitas</Typography>
                    </View>

                    <View className="flex-row justify-between space-x-2">
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 items-center">
                            <Typography weight="bold" className="text-white text-xl mb-1">{stats.customers}</Typography>
                            <Typography className="text-white/40 text-[9px] uppercase tracking-wider">Cust</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 items-center">
                            <Typography weight="bold" className="text-white text-xl mb-1">{stats.suppliers}</Typography>
                            <Typography className="text-white/40 text-[9px] uppercase tracking-wider">Supp</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 items-center">
                            <Typography weight="bold" className="text-white text-xl mb-1">{stats.spareparts}</Typography>
                            <Typography className="text-white/40 text-[9px] uppercase tracking-wider">Parts</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 items-center">
                            <Typography weight="bold" className="text-white text-xl mb-1">{stats.assets || 0}</Typography>
                            <Typography className="text-white/40 text-[9px] uppercase tracking-wider">Aset</Typography>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 -mt-6"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                showsVerticalScrollIndicator={false}
            >
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
                </View>
            </ScrollView>
        </View>
    );
}
