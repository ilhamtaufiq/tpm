import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Wrench, CarFront, Truck, Users, BarChart3, Database, History, Wallet, Shield, Settings } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { useUIStore } from '../store/useUIStore';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';

const ServiceCard = ({ menu, index }: { menu: any, index: number }) => {
    const scale = useSharedValue(1);
    const rotateX = useSharedValue(0);
    const rotateY = useSharedValue(0);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [
                { translateY: translateY.value },
                { scale: scale.value },
                { perspective: 1000 },
                { rotateX: `${rotateX.value}deg` },
                { rotateY: `${rotateY.value}deg` },
            ],
        };
    });

    const innerStyle = useAnimatedStyle(() => {
        return {
            shadowOpacity: interpolate(scale.value, [0.95, 1], [0.05, 0.1]),
            shadowRadius: interpolate(scale.value, [0.95, 1], [2, 8]),
        };
    });

    useEffect(() => {
        opacity.value = withDelay(index * 40, withSpring(1));
        translateY.value = withDelay(index * 40, withSpring(0));
    }, []);

    const onPressIn = () => {
        scale.value = withSpring(0.92);
        rotateX.value = withSpring(-5);
    };

    const onPressOut = () => {
        scale.value = withSpring(1);
        rotateX.value = withSpring(0);
        rotateY.value = withSpring(0);
    };

    return (
        <Animated.View style={[animatedStyle, { width: '25%' }]} className="items-center mb-5 px-1">
            <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => router.push(menu.path as any)}
                className="items-center w-full"
            >
                <Animated.View
                    style={[innerStyle, { backgroundColor: 'white', borderRadius: 20 }]}
                    className="w-14 h-14 items-center justify-center mb-1.5 border border-gray-100 shadow-sm"
                >
                    <View
                        style={{ backgroundColor: `${menu.color}15` }}
                        className="w-10 h-10 rounded-xl items-center justify-center"
                    >
                        <menu.icon size={22} color={menu.color} strokeWidth={2} />
                    </View>
                </Animated.View>
                <Typography
                    variant="caption"
                    weight="bold"
                    className="text-gray-600 text-[9px] uppercase tracking-tighter text-center"
                    numberOfLines={2}
                >
                    {menu.label}
                </Typography>
            </Pressable>
        </Animated.View>
    );
};

export const ServiceGrid = () => {
    const { user } = useAuthStore();

    const MENUS = [
        { id: 'bengkel', label: 'Bengkel', icon: Wrench, color: '#3b82f6', path: '/bengkel' }, // Blue
        { id: 'logistik', label: 'Jasa Angkut', icon: Truck, color: '#f97316', path: '/jasa-angkut' }, // Orange
        { id: 'mobil', label: 'Jual Beli', icon: CarFront, color: '#10b981', path: '/mobil' }, // Emerald
        { id: 'keuangan', label: 'Keuangan', icon: Wallet, color: '#ef4444', path: '/finance' }, // Red
        { id: 'master', label: 'Master', icon: Database, color: '#8b5cf6', path: '/master-data' }, // Purple
        { id: 'sdm', label: 'SDM', icon: Users, color: '#ec4899', path: '/sdm' }, // Pink
        { id: 'laporan', label: 'Laporan', icon: BarChart3, color: '#14b8a6', path: '/laporan' }, // Teal
        { id: 'riwayat', label: 'Riwayat', icon: History, color: '#6366f1', path: '/history' }, // Indigo
        { id: 'profil', label: 'Pengaturan', icon: Settings, color: '#4b5563', path: '/(tabs)/profile' }, // Gray
    ];

    const filteredMenus = MENUS.filter(menu => {
        const role = user?.role;
        const isAdmin = role === 'ADMIN' || role === 'MANAGER';

        // Admin and Manager see everything
        if (isAdmin) return true;

        // Non-admins cannot see 'admin', 'keuangan', 'master', 'sdm', 'laporan' by default
        if (['admin', 'keuangan', 'master', 'sdm', 'laporan'].includes(menu.id)) return false;

        // Unit-specific roles
        if (role === 'BENGKEL') {
            return ['bengkel', 'riwayat', 'profil'].includes(menu.id);
        }
        if (role === 'JASA_ANGKUT') {
            return ['logistik', 'riwayat', 'profil'].includes(menu.id);
        }
        if (role === 'MOBIL') {
            return ['mobil', 'riwayat', 'profil'].includes(menu.id);
        }

        return true;
    });

    return (
        <View className="px-5 mt-6">
            <View className="flex-row flex-wrap">
                {filteredMenus.map((menu, index) => (
                    <ServiceCard key={menu.id} menu={menu} index={index} />
                ))}
            </View>
        </View>
    );
};
