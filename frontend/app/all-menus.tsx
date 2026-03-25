import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, TextInput, Dimensions, Image } from 'react-native';
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
    LayoutGrid,
    CarFront
} from 'lucide-react-native';
import { Typography } from '../components/ui/Typography';
import { useRouter } from 'expo-router';
import { useUIStore } from '../store/useUIStore';
import { WalletSection } from '../components/WalletSection';
import { TransactionList } from '../components/TransactionList';
import { Header } from '../components/ui/Header';
import { useAuthStore } from '../store/useAuthStore';
import { getFileUrl } from '../utils/image';
import Animated, { 
    FadeInDown, 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    interpolate, 
    Extrapolate 
} from 'react-native-reanimated';

const MenuIcon = ({ label, icon: Icon, color, path, index }: {
    label: string,
    icon: any,
    color: string,
    path: string,
    index: number
}) => {
    const router = useRouter();
    const scale = useSharedValue(1);
    const rotateX = useSharedValue(0);
    const rotateY = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: scale.value },
                { perspective: 1000 },
                { rotateX: `${rotateX.value}deg` },
                { rotateY: `${rotateY.value}deg` },
            ],
        };
    });

    const innerShadowStyle = useAnimatedStyle(() => {
        return {
            shadowOpacity: interpolate(scale.value, [0.95, 1], [0.1, 0.2], Extrapolate.CLAMP),
            shadowRadius: interpolate(scale.value, [0.95, 1], [4, 12], Extrapolate.CLAMP),
        };
    });

    const onPressIn = () => {
        scale.value = withSpring(0.92);
        rotateX.value = withSpring(-10);
    };

    const onPressOut = () => {
        scale.value = withSpring(1);
        rotateX.value = withSpring(0);
        rotateY.value = withSpring(0);
    };

    return (
        <Animated.View 
            entering={FadeInDown.delay(index * 30).springify()}
            style={{ width: '25%' }} 
            className="items-center mb-6 px-1"
        >
            <TouchableOpacity
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => router.push(path as any)}
                className="items-center w-full"
                activeOpacity={1}
            >
                <Animated.View
                    style={[
                        animatedStyle,
                        innerShadowStyle,
                        { 
                            backgroundColor: 'white', 
                            borderRadius: 24,
                            shadowColor: color,
                            shadowOffset: { width: 0, height: 4 },
                            elevation: 4
                        }
                    ]}
                    className="w-16 h-16 items-center justify-center mb-2 border border-gray-50"
                >
                    <View
                        style={{ backgroundColor: `${color}15` }}
                        className="w-12 h-12 rounded-2xl items-center justify-center"
                    >
                        <Icon size={26} color={color} strokeWidth={2.5} />
                    </View>
                </Animated.View>
                <Typography
                    variant="caption"
                    weight="bold"
                    className="text-text text-[10px] text-center uppercase tracking-tighter"
                    numberOfLines={1}
                >
                    {label}
                </Typography>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function AllMenusScreen() {
    const { themeColors } = useUIStore();
    const { user } = useAuthStore();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

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
            label: 'Jual Beli',
            icon: CarFront,
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
            label: 'Master',
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
        <View className="flex-1 bg-background overflow-hidden">
            <StatusBar barStyle="light-content" />

            {/* Background Image (User Custom) */}
            {user?.home_background && (
                <Image 
                    source={{ uri: getFileUrl(user.home_background) as string }} 
                    className="absolute inset-0 w-full h-full opacity-10" 
                    resizeMode="cover"
                />
            )}
            
            <Header 
                title="Semua Menu" 
                subtitle="MODUL OPERASIONAL" 
                showBackButton 
                variant="page"
            >
                {/* Search Bar inside Header */}
                <View className="bg-white/10 h-11 rounded-2xl flex-row items-center px-4 border border-white/10 backdrop-blur-md">
                    <Search size={18} color="white" opacity={0.6} />
                    <TextInput 
                        placeholder="Cari fitur atau modul..." 
                        className="flex-1 ml-3 text-sm font-bold text-white" 
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        selectionColor="white"
                    />
                </View>
            </Header>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {/* Wallet Section Replacement */}
                <WalletSection />

                <View className="flex-row flex-wrap px-5 mt-6">
                    {filteredMenus.map((menu, index) => (
                        <MenuIcon key={menu.id} {...menu} index={index} />
                    ))}
                    {filteredMenus.length === 0 && (
                        <View className="w-full items-center justify-center py-20">
                            <Typography className="text-gray-300 opacity-20 tracking-[4px]" weight="bold" variant="h3">TIDAK DITEMUKAN</Typography>
                        </View>
                    )}
                </View>

                {/* Transaction List Section */}
                <TransactionList />
            </ScrollView>
        </View>
    );
}
