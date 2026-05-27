import React, { useState, useRef } from 'react';
import { View, Pressable, Platform, Modal, Animated } from 'react-native';
import { Typography } from './Typography';
import { cn } from './Card';
import { Plus, X, ShieldCheck, Wrench, Wallet, CarFront, Truck, History, Package, Receipt, BarChart3, User, Home, Database } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { APP_ROUTES } from '../../constants/NavigationRoutes';
import { router, usePathname } from 'expo-router';

export const CustomTabBar = () => {
    const insets = useSafeAreaInsets();
    const { activeSlots: storeActiveSlots, fabSlots } = useNavigationStore();
    const { themeColors } = useUIStore();
    const pathname = usePathname();
    const [quickActionsVisible, setQuickActionsVisible] = useState(false);

    const user = useAuthStore(state => state.user);
    const role = user?.role;

    // Redefine active slots if role is BENGKEL: Home, Inventori, FAB+, Master Data, Absensi
    const activeSlots = role === 'BENGKEL'
        ? ['bengkel-home', 'bengkel-inventory', 'fab-plus', 'bengkel-master', 'bengkel-absensi']
        : storeActiveSlots;

    // Animation progress for Radial FAB menu
    const animationProgress = useRef(new Animated.Value(0)).current;

    const showQuickActions = () => {
        setQuickActionsVisible(true);
        Animated.spring(animationProgress, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const hideQuickActions = () => {
        Animated.timing(animationProgress, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setQuickActionsVisible(false));
    };

    // Helper to resolve route config by ID
    const getRouteInfo = (id: string) => {
        if (id === 'fab-plus') {
            return {
                id: 'fab-plus',
                label: 'Tambah',
                path: '#fab',
                icon: Plus,
            };
        }
        if (id === 'bengkel-home') {
            return {
                id: 'bengkel-home',
                label: 'Home',
                path: '/bengkel',
                icon: Home,
            };
        }
        if (id === 'bengkel-inventory') {
            return {
                id: 'bengkel-inventory',
                label: 'Inventori',
                path: '/bengkel/inventory',
                icon: Package,
            };
        }
        if (id === 'bengkel-master') {
            return {
                id: 'bengkel-master',
                label: 'Master Data',
                path: '/master-data',
                icon: Database,
            };
        }
        if (id === 'bengkel-absensi') {
            return {
                id: 'bengkel-absensi',
                label: 'Absensi',
                path: '/sdm/absensi',
                icon: ShieldCheck,
            };
        }
        const route = APP_ROUTES.find((r) => r.id === id);
        if (route) {
            let label = route.label;
            let icon = route.icon;
            if (id === 'angkut') label = 'JA';
            if (id === 'bengkel') label = 'Bengkel';
            if (id === 'mobil') label = 'Mobil';
            if (id === 'profile') label = 'Profile';
            
            return { ...route, label, icon };
        }
        return undefined;
    };

    // Resolves details for a slot option
    const getOptionDetails = (id: string) => {
        switch (id) {
            case 'home':
                return { path: '/home', icon: Home, color: '#3B82F6' };
            case 'sdm-absensi':
                return { path: '/sdm/absensi', icon: ShieldCheck, color: '#10B981' };
            case 'bengkel':
                return { path: '/bengkel', icon: Wrench, color: '#3B82F6' };
            case 'mobil':
                return { path: '/mobil', icon: CarFront, color: '#F97316' };
            case 'angkut':
                return { path: '/jasa-angkut', icon: Truck, color: '#6366F1' };
            case 'laporan':
                return { path: '/laporan', icon: BarChart3, color: '#8B5CF6' };
            case 'labarugi':
                return { path: '/laporan/laba-rugi', icon: BarChart3, color: '#EC4899' };
            case 'fin-mutasi':
                return { path: '/finance/mutasi', icon: Receipt, color: '#10B981' };
            case 'fin-akun':
                return { path: '/finance/akun', icon: Wallet, color: '#2563EB' };
            case 'history':
                return { path: '/history', icon: History, color: '#64748B' };
            case 'sdm-gaji':
                return { path: '/sdm/slip-gaji', icon: Receipt, color: '#06B6D4' };
            case 'profile':
                return { path: '/profile', icon: User, color: '#374151' };
            default:
                return { path: '/home', icon: Home, color: '#3B82F6' };
        }
    };

    const isUnitRole = role === 'BENGKEL' || role === 'JASA_ANGKUT' || role === 'MOBIL';
    const roleUnitConfig = {
        BENGKEL: { kas: 'KAS_UNIT_BENGKEL', history: 'bengkel' },
        JASA_ANGKUT: { kas: 'KAS_UNIT_JASA_ANGKUT', history: 'jasa_angkut' },
        MOBIL: { kas: 'KAS_UNIT_MOBIL', history: 'mobil' },
    } as const;
    const unitConfig = roleUnitConfig[role as keyof typeof roleUnitConfig];
    const currentFabSlots = isUnitRole ? ['fin-mutasi', 'fin-akun', 'history'] : (fabSlots || ['bengkel', 'fin-mutasi', 'mobil']);
    const withUnitScope = (option: ReturnType<typeof getOptionDetails>, id: string) => {
        if (!unitConfig) return option;
        if (id === 'fin-mutasi') return { ...option, path: `/finance/mutasi?jenis=${unitConfig.kas}` };
        if (id === 'history') return { ...option, path: `/history?unit=${unitConfig.history}` };
        return option;
    };
    const subFab1 = withUnitScope(getOptionDetails(currentFabSlots[0] || 'bengkel'), currentFabSlots[0] || 'bengkel');
    const subFab2 = withUnitScope(getOptionDetails(currentFabSlots[1] || 'fin-mutasi'), currentFabSlots[1] || 'fin-mutasi');
    const subFab3 = withUnitScope(getOptionDetails(currentFabSlots[2] || 'mobil'), currentFabSlots[2] || 'mobil');

    const backdropOpacity = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const mainFabRotation = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'],
    });

    const subFab1X = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60],
    });

    const subFab1Y = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60],
    });

    const subFab2Y = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -85],
    });

    const subFab3X = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 60],
    });

    const subFab3Y = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60],
    });

    return (
        <View
            className="absolute left-0 right-0 flex-row items-center justify-around px-2 rounded-t-[24px] border-t border-gray-200 bg-white"
            style={{
                bottom: 0,
                height: 80 + (Platform.OS === 'ios' ? insets.bottom : 0),
                paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 16,
                elevation: 10,
                zIndex: 50,
            }}
        >
            {activeSlots.map((slotId, index) => {
                const routeInfo = getRouteInfo(slotId);
                if (!routeInfo) return null;

                const isFab = slotId === 'fab-plus';
                
                // Match exact pathname or handle root routing
                const isActiveTab = (path: string) => {
                    if (path === '/home' && (pathname === '/home' || pathname === '/')) return true;
                    const cleanPath = path.split('?')[0];
                    if (cleanPath === '/bengkel') return pathname === '/bengkel';
                    return pathname === cleanPath || pathname?.startsWith(cleanPath + '/');
                };
                
                const isFocused = !isFab && isActiveTab(routeInfo.path);

                const handlePress = () => {
                    const cleanPath = pathname.split('?')[0];
                    if (isFab) {
                        showQuickActions();
                        return;
                    }

                    if (!isFocused) {
                        // Use router.navigate to properly traverse the stack
                        router.navigate(routeInfo.path as any);
                    }
                };

                const IconComponent = routeInfo.icon;

                if (isFab) {
                    return (
                        <View key={index} className="flex flex-col items-center justify-center flex-1 h-full -mt-12 group relative" style={{ overflow: 'visible', zIndex: 60 }}>
                            <Pressable
                                onPress={handlePress}
                                className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white active:scale-95 transition-all duration-300"
                                style={{
                                    backgroundColor: themeColors.primary,
                                    shadowColor: themeColors.primary,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 20,
                                    elevation: 10,
                                }}
                            >
                                <Plus size={24} color="white" strokeWidth={2.5} />
                            </Pressable>
                        </View>
                    );
                }

                return (
                    <Pressable
                        key={index}
                        onPress={handlePress}
                        className="flex-1 flex flex-col items-center justify-center h-full active:opacity-70"
                    >
                        {isFocused ? (
                            <View className="w-12 h-12 flex flex-col items-center justify-center rounded-xl bg-[#EEF2FF] mb-1">
                                {IconComponent && (
                                    <View className="mb-0.5">
                                        <IconComponent
                                            size={18}
                                            color={themeColors.primary}
                                            strokeWidth={2.5}
                                        />
                                    </View>
                                )}
                                <Typography
                                    variant="caption"
                                    weight="semibold"
                                    className="text-[10px] text-primary"
                                    numberOfLines={1}
                                >
                                    {routeInfo.label}
                                </Typography>
                            </View>
                        ) : (
                            <>
                                {IconComponent && (
                                    <View className="mb-1">
                                        <IconComponent
                                            size={20}
                                            color="#9CA3AF"
                                            strokeWidth={2}
                                        />
                                    </View>
                                )}
                                <Typography
                                    variant="caption"
                                    weight="medium"
                                    className="text-[10px] text-gray-400"
                                    numberOfLines={1}
                                >
                                    {routeInfo.label}
                                </Typography>
                            </>
                        )}
                    </Pressable>
                );
            })}

            {/* Radial FAB Modal Overlay */}
            <Modal
                transparent
                visible={quickActionsVisible}
                animationType="none"
                onRequestClose={hideQuickActions}
            >
                <View className="flex-1 justify-end">
                    {/* Backdrop */}
                    <Animated.View
                        style={{
                            opacity: backdropOpacity,
                            backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        }}
                        className="absolute inset-0"
                    >
                        <Pressable className="flex-1" onPress={hideQuickActions} />
                    </Animated.View>

                    {/* Centered Radial FABs overlay at Bottom Navigation bar */}
                    <View
                        className="absolute left-0 right-0 flex-row items-center justify-center px-2"
                        style={{
                            bottom: 0,
                            height: 80 + (Platform.OS === 'ios' ? insets.bottom : 0),
                            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
                            pointerEvents: 'box-none',
                        }}
                    >
                        <View
                            className="w-16 h-16 items-center justify-center -mt-12 relative"
                            style={{ overflow: 'visible' }}
                        >
                            {/* Sub-FAB 1: Tambah Bengkel */}
                            <Animated.View
                                style={{
                                    position: 'absolute',
                                    opacity: backdropOpacity,
                                    transform: [
                                        { translateX: subFab1X },
                                        { translateY: subFab1Y },
                                    ],
                                }}
                            >
                                <Pressable
                                    onPress={() => {
                                        hideQuickActions();
                                        router.navigate(subFab1.path as any);
                                    }}
                                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-lg active:scale-90"
                                >
                                    <subFab1.icon size={20} color={subFab1.color} strokeWidth={2.5} />
                                </Pressable>
                            </Animated.View>

                            {/* Sub-FAB 2: Tambah Transaksi */}
                            <Animated.View
                                style={{
                                    position: 'absolute',
                                    opacity: backdropOpacity,
                                    transform: [
                                        { translateY: subFab2Y },
                                    ],
                                }}
                            >
                                <Pressable
                                    onPress={() => {
                                        hideQuickActions();
                                        router.navigate(subFab2.path as any);
                                    }}
                                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-lg active:scale-90"
                                >
                                    <subFab2.icon size={20} color={subFab2.color} strokeWidth={2.5} />
                                </Pressable>
                            </Animated.View>

                            {/* Sub-FAB 3: Tambah Unit */}
                            <Animated.View
                                style={{
                                    position: 'absolute',
                                    opacity: backdropOpacity,
                                    transform: [
                                        { translateX: subFab3X },
                                        { translateY: subFab3Y },
                                    ],
                                }}
                            >
                                <Pressable
                                    onPress={() => {
                                        hideQuickActions();
                                        router.navigate(subFab3.path as any);
                                    }}
                                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-lg active:scale-90"
                                >
                                    <subFab3.icon size={20} color={subFab3.color} strokeWidth={2.5} />
                                </Pressable>
                            </Animated.View>

                            {/* Main FAB inside Modal */}
                            <Pressable
                                onPress={hideQuickActions}
                                className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white z-50 active:scale-95 transition-all duration-300"
                                style={{
                                    backgroundColor: themeColors.primary,
                                    shadowColor: themeColors.primary,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 20,
                                    elevation: 10,
                                }}
                            >
                                <Animated.View style={{ transform: [{ rotate: mainFabRotation }] }}>
                                    <Plus size={24} color="white" strokeWidth={2.5} />
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
