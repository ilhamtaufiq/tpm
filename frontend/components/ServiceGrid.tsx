import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Wrench, CarFront, Truck, Users, BarChart3, Database, Receipt, History } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { router } from 'expo-router';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';

const MENUS = [
    { id: 'bengkel', label: 'Bengkel', icon: Wrench, color: '#023C69', path: '/bengkel' },
    { id: 'angkut', label: 'Logistik', icon: Truck, color: '#023C69', path: '/jasa-angkut' },
    { id: 'mobil', label: 'Mobil', icon: CarFront, color: '#023C69', path: '/mobil' },
    { id: 'sdm', label: 'SDM', icon: Users, color: '#023C69', path: '/sdm' },
    { id: 'laporan', label: 'Laporan', icon: BarChart3, color: '#023C69', path: '/laporan' },
    { id: 'master', label: 'Master', icon: Database, color: '#023C69', path: '/master-data' },
    { id: 'pembelian', label: 'Restock', icon: Receipt, color: '#023C69', path: '/bengkel/purchase' },
    { id: 'history', label: 'Riwayat', icon: History, color: '#023C69', path: '/history' },
];

const ServiceCard = ({ menu, index }: { menu: typeof MENUS[0], index: number }) => {
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
            shadowOpacity: interpolate(scale.value, [0.95, 1], [0.1, 0.3], Extrapolate.CLAMP),
            shadowRadius: interpolate(scale.value, [0.95, 1], [4, 15], Extrapolate.CLAMP),
        };
    });

    useEffect(() => {
        opacity.value = withDelay(index * 50, withSpring(1));
        translateY.value = withDelay(index * 50, withSpring(0));
    }, []);

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
        <Animated.View style={[animatedStyle, { width: '25%' }]} className="items-center mb-6 px-1">
            <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => router.push(menu.path as any)}
                className="items-center w-full"
            >
                <Animated.View
                    style={[innerStyle, { backgroundColor: 'white', borderRadius: 24 }]}
                    className="w-16 h-16 items-center justify-center mb-2 shadow-xl border border-gray-50"
                >
                    <View
                        style={{ backgroundColor: `${menu.color}15` }}
                        className="w-12 h-12 rounded-2xl items-center justify-center"
                    >
                        <menu.icon size={26} color={menu.color} strokeWidth={2.5} />
                    </View>
                </Animated.View>
                <Typography
                    variant="caption"
                    weight="bold"
                    className="text-text/70 text-[10px] uppercase tracking-tighter"
                >
                    {menu.label}
                </Typography>
            </Pressable>
        </Animated.View>
    );
};

export const ServiceGrid = () => {
    return (
        <View className="px-5 mt-8">
            <View className="flex-row flex-wrap">
                {MENUS.map((menu, index) => (
                    <ServiceCard key={menu.id} menu={menu} index={index} />
                ))}
            </View>
        </View>
    );
};

