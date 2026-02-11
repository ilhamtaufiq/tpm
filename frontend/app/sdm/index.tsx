import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    Users,
    Clock,
    Wallet,
    UserMinus,
    ChevronRight,
    RefreshCw,
    FileText,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { sdmService, EmployeeStats } from '../../services/sdm';
import { useEmployeeStats } from '../../hooks/useSDM';
import { SkeletonStats, SkeletonCard } from '../../components/ui/Skeleton';

const QUICK_ACTIONS = [
    { id: 'karyawan', label: 'Karyawan', icon: Users, color: '#3B82F6', route: '/sdm/karyawan' },
    { id: 'absensi', label: 'Absensi', icon: Clock, color: '#10B981', route: '/sdm/absensi' },
    { id: 'kasbon', label: 'Kasbon', icon: Wallet, color: '#F59E0B', route: '/sdm/kasbon' },
    { id: 'slip-gaji', label: 'Slip Gaji', icon: FileText, color: '#8B5CF6', route: '/sdm/slip-gaji' },
];

export default function SDMScreen() {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    // API Hooks
    const { data: stats, isLoading, refetch } = useEmployeeStats();

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">SDM & Payroll</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Manajemen Aset Manusia</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={20} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Employee Insight Card (Glassmorphism) */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Live Report</Typography>
                        </View>
                        <Typography className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Populasi Staff</Typography>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View>
                            {isLoading ? (
                                <ActivityIndicator color="white" className="mt-2" />
                            ) : (
                                <>
                                    <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter">
                                        {stats?.total_karyawan || 0} Orang
                                    </Typography>
                                    <Typography className="text-white/40 text-xs mt-1">Total Karyawan Terdaftar</Typography>
                                </>
                            )}
                        </View>
                        <View className="bg-white/10 p-4 rounded-2xl border border-white/10">
                            <Users size={24} color="white" />
                        </View>
                    </View>

                    {/* Bento Internal Stats Row */}
                    <View className="h-[1px] bg-white/10 my-6" />
                    <View className="flex-row justify-between">
                        <View className="flex-1">
                            <View className="flex-row items-center mb-1">
                                <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                                <Typography className="text-white/30 text-[9px] uppercase font-bold tracking-widest">Aktif</Typography>
                            </View>
                            <Typography weight="bold" className="text-white text-sm">{stats?.total_aktif || 0}</Typography>
                        </View>
                        <View className="flex-1 items-center px-4 border-l border-white/5 border-r">
                            <View className="flex-row items-center mb-1">
                                <View className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                                <Typography className="text-white/30 text-[9px] uppercase font-bold tracking-widest">Cuti</Typography>
                            </View>
                            <Typography weight="bold" className="text-white text-sm">{stats?.total_cuti || 0}</Typography>
                        </View>
                        <View className="flex-1 items-end pl-4">
                            <View className="flex-row items-center mb-1">
                                <View className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
                                <Typography className="text-white/30 text-[9px] uppercase font-bold tracking-widest">Resign</Typography>
                            </View>
                            <Typography weight="bold" className="text-rose-300 text-sm">{stats?.total_resign || 0}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
            >
                {/* Premium Circular Quick Actions */}
                <Typography variant="h3" weight="bold" className="text-textMain mb-6 tracking-tight">Navigasi Cepat</Typography>
                <View className="flex-row flex-wrap justify-between mb-10">
                    {QUICK_ACTIONS.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            onPress={() => router.push(action.route as any)}
                            activeOpacity={0.7}
                            className="w-[22%] items-center"
                        >
                            <View
                                className="w-14 h-14 rounded-full items-center justify-center mb-2 shadow-sm border border-white"
                                style={{ backgroundColor: `${action.color}10`, shadowColor: action.color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 }}
                            >
                                <action.icon size={22} color={action.color} strokeWidth={2.5} />
                            </View>
                            <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest text-center" numberOfLines={1}>
                                {action.label}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Sub-Feature Cards (Premium List Style) */}
                <Typography variant="h3" weight="bold" className="text-textMain mb-6 tracking-tight">Modul Operasional</Typography>

                <View className="space-y-6">
                    <TouchableOpacity
                        onPress={() => router.push('/sdm/karyawan')}
                        activeOpacity={0.9}
                        className="bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center mb-6"
                    >
                        <View className="w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center mr-4 border border-blue-100/50">
                            <Users size={24} color="#3B82F6" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Database Karyawan</Typography>
                            <Typography variant="caption" className="text-textGray">Kelola profil & dokumen sdm</Typography>
                        </View>
                        <ChevronRight size={18} color="#D1D5DB" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/sdm/absensi')}
                        activeOpacity={0.9}
                        className="bg-white p-5 rounded-[32px] border border-gray-100/50 shadow-sm flex-row items-center mb-6"
                    >
                        <View className="w-14 h-14 rounded-2xl bg-emerald-50 items-center justify-center mr-4 border border-emerald-100/50">
                            <Clock size={24} color="#10B981" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Presensi Harian</Typography>
                            <Typography variant="caption" className="text-textGray">Rekap kehadiran & lembur staff</Typography>
                        </View>
                        <ChevronRight size={18} color="#D1D5DB" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/sdm/kasbon')}
                        activeOpacity={0.9}
                        className="bg-white p-5 rounded-[32px] border border-gray-100/50 shadow-sm flex-row items-center mb-6"
                    >
                        <View className="w-14 h-14 rounded-2xl bg-amber-50 items-center justify-center mr-4 border border-amber-100/50">
                            <Wallet size={24} color="#F59E0B" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Manajemen Kasbon</Typography>
                            <Typography variant="caption" className="text-textGray">Pinjaman & cicilan karyawan</Typography>
                        </View>
                        <ChevronRight size={18} color="#D1D5DB" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/sdm/slip-gaji')}
                        activeOpacity={0.9}
                        className="bg-white p-5 rounded-[32px] border border-gray-100/50 shadow-sm flex-row items-center mb-6"
                    >
                        <View className="w-14 h-14 rounded-2xl bg-purple-50 items-center justify-center mr-4 border border-purple-100/50">
                            <FileText size={24} color="#8B5CF6" strokeWidth={2.5} />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">Payroll & Slip Gaji</Typography>
                            <Typography variant="caption" className="text-textGray">Otomasi penggajian & laporan</Typography>
                        </View>
                        <ChevronRight size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
