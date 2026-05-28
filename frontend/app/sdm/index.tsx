import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import {
    Users,
    Clock,
    Wallet,
    ChevronRight,
    FileText,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Header } from '../../components/ui/Header';
import { useAuthStore } from '../../store/useAuthStore';

const QUICK_ACTIONS = [
    { id: 'karyawan', label: 'Karyawan', icon: Users, color: '#3B82F6', route: '/sdm/karyawan' },
    { id: 'absensi', label: 'Absensi', icon: Clock, color: '#10B981', route: '/sdm/absensi' },
    { id: 'kasbon', label: 'Kasbon', icon: Wallet, color: '#F59E0B', route: '/sdm/kasbon' },
    { id: 'slip-gaji', label: 'Slip Gaji', icon: FileText, color: '#8B5CF6', route: '/sdm/slip-gaji' },
];

export default function SDMScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [refreshing, setRefreshing] = useState(false);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // Simulate refresh or add relevant refetch if needed in future
        await new Promise(resolve => setTimeout(resolve, 500));
        setRefreshing(false);
    }, []);


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header 
                title="SDM & Payroll"
                subtitle="Manajemen SDM & Kepegawaian"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
            />

            <ScrollView
                className="flex-1 px-6"
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 32 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {/* Visual Break / Spacer */}
                <View className="h-6" />

                {/* Premium Circular Quick Actions */}
                <Typography variant="h3" weight="bold" className="text-textMain mb-6 tracking-tight">Navigasi Cepat</Typography>
                <View className="flex-row flex-wrap justify-between mb-10">
                    {QUICK_ACTIONS.filter(action => {
                        const role = user?.role;
                        if (role === 'ADMIN' || role === 'MANAGER') return true;
                        // Unit managers need Absensi and maybe Kasbon for their subordinates
                        return ['absensi', 'kasbon'].includes(action.id);
                    }).map((action) => (
                        <Pressable
                            key={action.id}
                            onPress={() => router.push(action.route as any)}
                            
                            className="w-[22%] items-center"
                        >
                            <View
                                className="w-14 h-14 rounded-full items-center justify-center mb-2 bg-white shadow-sm border border-gray-100"
                                style={{ backgroundColor: `${action.color}15` }}
                            >
                                <action.icon size={22} color={action.color} strokeWidth={2.5} />
                            </View>
                            <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest text-center" numberOfLines={1}>
                                {action.label}
                            </Typography>
                        </Pressable>
                    ))}
                </View>

                {/* Sub-Feature Cards (Premium List Style) */}
                <Typography variant="h3" weight="bold" className="text-textMain mb-6 tracking-tight">Modul Operasional</Typography>
                <View className="space-y-4">
                    <Pressable
                        onPress={() => router.push('/sdm/absensi')}
                        className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center justify-between"
                    >
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center mr-4 border border-emerald-100">
                                <Clock size={24} color="#10B981" />
                            </View>
                            <View>
                                <Typography variant="h4" weight="bold" className="text-textMain">Absensi Presensi</Typography>
                                <Typography className="text-textGray/60 text-xs">Catat Masuk, Pulang & Izin</Typography>
                            </View>
                        </View>
                        <ChevronRight size={18} color="#D1D5DB" />
                    </Pressable>

                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <Pressable
                            onPress={() => router.push('/sdm/karyawan')}
                            className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4 border border-blue-100">
                                    <Users size={24} color="#3B82F6" />
                                </View>
                                <View>
                                    <Typography variant="h4" weight="bold" className="text-textMain">Database Personalia</Typography>
                                    <Typography className="text-textGray/60 text-xs">Informasi Data Karyawan</Typography>
                                </View>
                            </View>
                            <ChevronRight size={18} color="#D1D5DB" />
                        </Pressable>
                    )}

                    <Pressable
                        onPress={() => router.push('/sdm/kasbon')}
                        className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center justify-between"
                    >
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 bg-amber-50 rounded-2xl items-center justify-center mr-4 border border-amber-100">
                                <Wallet size={24} color="#F59E0B" />
                            </View>
                            <View>
                                <Typography variant="h4" weight="bold" className="text-textMain">Pencatatan Kasbon</Typography>
                                <Typography className="text-textGray/60 text-xs">Pinjaman & Riwayat Kasbon</Typography>
                            </View>
                        </View>
                        <ChevronRight size={18} color="#D1D5DB" />
                    </Pressable>

                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <Pressable
                            onPress={() => router.push('/sdm/slip-gaji')}
                            className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-purple-50 rounded-2xl items-center justify-center mr-4 border border-purple-100">
                                    <FileText size={24} color="#8B5CF6" />
                                </View>
                                <View>
                                    <Typography variant="h4" weight="bold" className="text-textMain">Payroll & Slip Gaji</Typography>
                                    <Typography className="text-textGray/60 text-xs">Generate & Download Slip</Typography>
                                </View>
                            </View>
                            <ChevronRight size={18} color="#D1D5DB" />
                        </Pressable>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
