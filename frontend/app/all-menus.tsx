import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput } from 'react-native';
import {
    ChevronLeft,
    Wrench,
    Truck,
    Car,
    Database,
    Users,
    BarChart2,
    History,
    Settings,
    Wallet,
    Shield,
    Search,
    RefreshCw
} from 'lucide-react-native';
import { Typography } from '../components/ui/Typography';
import { useRouter } from 'expo-router';
import { useUIStore } from '../store/useUIStore';
import { useDashboardSummary } from '../hooks/useKeuangan';
import { formatCurrency } from '../utils/format';
import { Skeleton } from '../components/ui/Skeleton';

const MenuCard = ({ label, icon: Icon, color, path, description }: {
    label: string,
    icon: any,
    color: string,
    path: string,
    description?: string
}) => {
    const router = useRouter();
    return (
        <TouchableOpacity
            onPress={() => router.push(path as any)}
            className="w-[47%] bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm"
        >
            <View
                style={{ backgroundColor: `${color}10` }}
                className="w-14 h-14 rounded-[22px] items-center justify-center mb-4"
            >
                <Icon size={28} color={color} strokeWidth={2} />
            </View>
            <Typography variant="body1" weight="bold" className="text-[#1C1C1C] mb-1 tracking-tight">{label}</Typography>
            {description && (
                <Typography variant="caption" className="text-gray-400 leading-4">{description}</Typography>
            )}
        </TouchableOpacity>
    );
};

export default function AllMenusScreen() {
    const { themeColors } = useUIStore();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch Dashboard Data for Saldo
    const { data: dashboard, isLoading: isLoadingSaldo } = useDashboardSummary();

    const ALL_MENUS = [
        {
            id: 'bengkel',
            label: 'Bengkel',
            icon: Wrench,
            color: '#3B82F6', // Blue
            path: '/bengkel',
            description: 'Servis & Sparepart'
        },
        {
            id: 'logistik',
            label: 'Logistik',
            icon: Truck,
            color: '#F59E0B', // Amber
            path: '/jasa-angkut',
            description: 'Jasa Angkut Barang'
        },
        {
            id: 'mobil',
            label: 'Jual Beli Mobil',
            icon: Car,
            color: '#10B981', // Emerald
            path: '/mobil',
            description: 'Inventaris & Jual Beli'
        },
        {
            id: 'finance',
            label: 'Keuangan',
            icon: Wallet,
            color: '#EF4444', // Red
            path: '/finance',
            description: 'Kas, Hutang & Piutang'
        },
        {
            id: 'master',
            label: 'Master Data',
            icon: Database,
            color: '#8B5CF6', // Violet
            path: '/master-data',
            description: 'Customer & Supplier'
        },
        {
            id: 'sdm',
            label: 'SDM',
            icon: Users,
            color: '#EC4899', // Pink
            path: '/sdm',
            description: 'Karyawan & Payroll'
        },
        {
            id: 'laporan',
            label: 'Laporan',
            icon: BarChart2,
            color: '#06B6D4', // Cyan
            path: '/laporan',
            description: 'Rekap & Analisa'
        },
        {
            id: 'history',
            label: 'Riwayat',
            icon: History,
            color: '#6366F1', // Indigo
            path: '/history',
            description: 'Log Transaksi'
        },
        {
            id: 'settings',
            label: 'Profil',
            icon: Settings,
            color: '#6B7280', // Gray
            path: '/profile',
            description: 'Informasi Akun'
        },
        {
            id: 'users',
            label: 'Admin',
            icon: Shield,
            color: '#000000', // Black
            path: '/settings/users',
            description: 'User Management'
        },
    ];

    const filteredMenus = ALL_MENUS.filter(menu => 
        menu.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        menu.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View className="flex-1 bg-[#F8F9FA]">
            <StatusBar barStyle="light-content" />
            
            {/* Premium Header */}
            <View style={{ backgroundColor: themeColors.primary }} className="pt-14 pb-14 px-6 rounded-b-[48px] shadow-2xl overflow-hidden">
                {/* Background Decor */}
                <View className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/5 rounded-full" />
                
                {/* Navigation Row */}
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        <TouchableOpacity 
                            onPress={() => router.back()}
                            className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Semua Menu</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5 font-bold tracking-widest uppercase">MODUL APLIKASI</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Floating Search Overlay */}
            <View className="px-6 -mt-7 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                    <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-14 rounded-2xl border border-gray-100">
                        <Search size={20} color="#9CA3AF" />
                        <TextInput 
                            placeholder="Cari menu atau modul..." 
                            className="flex-1 ml-3 text-sm font-medium text-[#1C1C1C]" 
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                {/* Saldo Bento Section */}
                <View className="flex-row justify-between mb-8 px-1">
                    <View className="flex-1 bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm mr-4">
                        <View className="flex-row items-center mb-3">
                            <View className="w-9 h-9 bg-emerald-50 rounded-xl items-center justify-center mr-2.5">
                                <Wallet size={18} color="#10B981" />
                            </View>
                            <Typography className="text-gray-400 text-[9px] uppercase font-bold tracking-[2px]">CASH</Typography>
                        </View>
                        {isLoadingSaldo ? (
                            <Skeleton width="80%" height={24} borderRadius={12} />
                        ) : (
                            <Typography weight="bold" className="text-emerald-600 text-[17px] tracking-tight">
                                {formatCurrency(dashboard?.kas_bank?.cash?.saldo || 0)}
                            </Typography>
                        )}
                    </View>

                    <View className="flex-1 bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm">
                        <View className="flex-row items-center mb-3">
                            <View className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center mr-2.5">
                                <RefreshCw size={18} color="#3B82F6" />
                            </View>
                            <Typography className="text-gray-400 text-[9px] uppercase font-bold tracking-[2px]">BANK BCA</Typography>
                        </View>
                        {isLoadingSaldo ? (
                            <Skeleton width="80%" height={24} borderRadius={12} />
                        ) : (
                            <Typography weight="bold" className="text-blue-600 text-[17px] tracking-tight">
                                {formatCurrency(dashboard?.kas_bank?.bank_bca?.saldo || 0)}
                            </Typography>
                        )}
                    </View>
                </View>

                {/* Grid Title */}
                <Typography variant="h3" weight="bold" className="text-[#1C1C1C] mb-6 px-1 tracking-tight">Navigasi Langsung</Typography>

                <View className="flex-row flex-wrap justify-between">
                    {filteredMenus.map((menu) => (
                        <MenuCard key={menu.id} {...menu} />
                    ))}
                    {filteredMenus.length === 0 && (
                        <View className="w-full items-center justify-center py-20">
                            <Typography className="text-gray-300 opacity-20 tracking-[4px]" weight="bold" variant="h3">TIDAK DITEMUKAN</Typography>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
