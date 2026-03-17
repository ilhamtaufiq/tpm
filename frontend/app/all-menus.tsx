import React from 'react';
import { View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { 
    ChevronLeft, 
    Wrench, 
    Truck, 
    CarFront, 
    Database, 
    Users, 
    BarChart3, 
    History, 
    Settings, 
    Wallet,
    BadgeDollarSign,
    ClipboardList,
    LayoutGrid,
    ShieldCheck
} from 'lucide-react-native';
import { Typography } from '../components/ui/Typography';
import { useRouter } from 'expo-router';
import { useUIStore } from '../store/useUIStore';

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
            className="w-[47%] bg-white p-5 rounded-[32px] mb-4 border border-gray-100 shadow-sm"
        >
            <View 
                style={{ backgroundColor: `${color}15` }}
                className="w-12 h-12 rounded-2xl items-center justify-center mb-4"
            >
                <Icon size={24} color={color} strokeWidth={2.5} />
            </View>
            <Typography variant="body1" weight="bold" className="text-textMain mb-1">{label}</Typography>
            {description && (
                <Typography variant="caption" className="text-textGray leading-4">{description}</Typography>
            )}
        </TouchableOpacity>
    );
};

export default function AllMenusScreen() {
    const { themeColors } = useUIStore();
    const router = useRouter();

    const ALL_MENUS = [
        { 
            id: 'bengkel', 
            label: 'Bengkel', 
            icon: Wrench, 
            color: themeColors.primary, 
            path: '/bengkel',
            description: 'Servis & Sparepart'
        },
        { 
            id: 'logistik', 
            label: 'Logistik', 
            icon: Truck, 
            color: themeColors.primary, 
            path: '/jasa-angkut',
            description: 'Jasa Angkut Barang'
        },
        { 
            id: 'mobil', 
            label: 'Jual Beli Mobil', 
            icon: CarFront, 
            color: themeColors.primary, 
            path: '/mobil',
            description: 'Inventaris & Penjualan'
        },
        { 
            id: 'finance', 
            label: 'Keuangan', 
            icon: Wallet, 
            color: themeColors.primary, 
            path: '/finance',
            description: 'Kas, Hutang & Piutang'
        },
        { 
            id: 'master', 
            label: 'Master Data', 
            icon: Database, 
            color: themeColors.primary, 
            path: '/master-data',
            description: 'Customer & Supplier'
        },
        { 
            id: 'sdm', 
            label: 'SDM', 
            icon: Users, 
            color: themeColors.primary, 
            path: '/sdm',
            description: 'Karyawan & Payroll'
        },
        { 
            id: 'laporan', 
            label: 'Laporan', 
            icon: BarChart3, 
            color: themeColors.primary, 
            path: '/laporan',
            description: 'Rekap & Analisa'
        },
        { 
            id: 'history', 
            label: 'Riwayat', 
            icon: History, 
            color: themeColors.primary, 
            path: '/history',
            description: 'Log Transaksi'
        },
        { 
            id: 'settings', 
            label: 'Pengaturan', 
            icon: Settings, 
            color: themeColors.primary, 
            path: '/settings',
            description: 'Profil & Aplikasi'
        },
        { 
            id: 'users', 
            label: 'User Management', 
            icon: ShieldCheck, 
            color: themeColors.primary, 
            path: '/settings/users',
            description: 'Admin, Kasir & Mekanik'
        },
    ];

    return (
        <View className="flex-1 bg-[#F9FAFB]">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <TouchableOpacity 
                            onPress={() => router.back()}
                            className="w-10 h-10 bg-white rounded-xl items-center justify-center mr-4 border border-gray-100 shadow-sm"
                        >
                            <ChevronLeft size={20} color={themeColors.primary} />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" style={{ color: themeColors.primary }}>Semua Menu</Typography>
                            <Typography variant="caption" className="text-gray-400">Pilih modul aplikasi</Typography>
                        </View>
                    </View>
                </View>

                <ScrollView 
                    className="flex-1 px-6 pt-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    <View className="flex-row flex-wrap justify-between">
                        {ALL_MENUS.map((menu) => (
                            <MenuCard key={menu.id} {...menu} />
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
