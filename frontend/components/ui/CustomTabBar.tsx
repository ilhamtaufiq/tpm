import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Typography } from './Typography';
import { cn } from './Card';
import { Plus, X, ShieldCheck, Wrench, Wallet, CarFront, Truck, History, Package, Receipt, BarChart3, User, Home, Database, ArrowRightLeft } from 'lucide-react-native';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { APP_ROUTES } from '../../constants/NavigationRoutes';
import { router, usePathname } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchMenu, pathForPrefetch } from '../../utils/prefetchMenu';

export const CUSTOM_TAB_BAR_BASE_HEIGHT = 80;

export const getCustomTabBarHeight = (bottomInset: number) => {
    return CUSTOM_TAB_BAR_BASE_HEIGHT + bottomInset;
};

export const getCustomTabBarBottomPadding = (bottomInset: number, extraSpacing = 24) => {
    return getCustomTabBarHeight(bottomInset) + extraSpacing;
};

function CustomTabBarInner() {
    const insets = useSafeAreaInsets();
    const { activeSlots: storeActiveSlots, fabSlots, pageFabSlots } = useNavigationStore();
    const { themeColors } = useUIStore();
    const pathname = usePathname();
    const [quickActionsVisible, setQuickActionsVisible] = useState(false);
    const queryClient = useQueryClient();

    const warmPath = React.useCallback(
        (path: string) => {
            prefetchMenu(queryClient, pathForPrefetch(path));
        },
        [queryClient]
    );

    const user = useAuthStore(state => state.user);
    const role = user?.role;

    // Redefine active slots if role is BENGKEL: Home, Inventori, FAB+, Master Data, Absensi
    const activeSlots = role === 'BENGKEL'
        ? ['bengkel-home', 'bengkel-inventory', 'fab-plus', 'bengkel-master', 'bengkel-absensi']
        : storeActiveSlots;

    // Animation progress for Radial FAB menu
    const animationProgress = useRef(new Animated.Value(0)).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            animationRef.current?.stop();
            setQuickActionsVisible(false);
        };
    }, []);

    const showQuickActions = () => {
        animationRef.current?.stop();
        animationProgress.setValue(0);
        setQuickActionsVisible(true);
        animationRef.current = Animated.spring(animationProgress, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        });
        animationRef.current.start();
    };

    const hideQuickActions = () => {
        animationRef.current?.stop();
        animationProgress.setValue(0);
        setQuickActionsVisible(false);
    };

    const currentPageId = pathname?.startsWith('/bengkel')
        ? 'bengkel'
        : pathname?.startsWith('/mobil')
            ? 'mobil'
            : pathname?.startsWith('/jasa-angkut')
                ? 'angkut'
                : undefined;

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
            if (id === 'bengkel') label = 'Bengkel';
            if (id === 'mobil') label = 'Jual Beli Mobil';
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
                return { path: '/finance/mutasi', icon: ArrowRightLeft, color: '#10B981' };
            case 'fin-akun':
                return { path: '/finance/akun', icon: Wallet, color: '#2563EB' };
            case 'history':
                return { path: '/history', icon: History, color: '#64748B' };
            case 'sdm-gaji':
                return { path: '/sdm/slip-gaji', icon: Receipt, color: '#06B6D4' };
            case 'profile':
                return { path: '/profile', icon: User, color: '#374151' };
            default:
                const route = APP_ROUTES.find((r) => r.id === id);
                if (route) return { path: route.path, icon: route.icon, color: themeColors.primary };
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
    const currentFabSlots = currentPageId && pageFabSlots?.[currentPageId]
        ? pageFabSlots[currentPageId]
        : isUnitRole
            ? ['fin-mutasi', 'fin-akun', 'history']
            : (fabSlots || ['bengkel', 'fin-mutasi', 'mobil']);
    const withUnitScope = (option: ReturnType<typeof getOptionDetails>, id: string) => {
        if (!unitConfig) return option;
        if (id === 'fin-mutasi') return { ...option, path: `/finance/mutasi?jenis=${unitConfig.kas}` };
        if (id === 'history') return { ...option, path: `/history?unit=${unitConfig.history}` };
        return option;
    };
    const subFab1 = withUnitScope(getOptionDetails(currentFabSlots[0] || 'bengkel'), currentFabSlots[0] || 'bengkel');
    const subFab2 = withUnitScope(getOptionDetails(currentFabSlots[1] || 'fin-mutasi'), currentFabSlots[1] || 'fin-mutasi');
    const subFab3 = withUnitScope(getOptionDetails(currentFabSlots[2] || 'mobil'), currentFabSlots[2] || 'mobil');

    const backdropOpacity = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    }), [animationProgress]);

    const mainFabRotation = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'],
    }), [animationProgress]);

    const subFab1X = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60],
    }), [animationProgress]);

    const subFab1Y = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60],
    }), [animationProgress]);

    const subFab2Y = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -85],
    }), [animationProgress]);

    const subFab3X = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 60],
    }), [animationProgress]);

    const subFab3Y = useMemo(() => animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60],
    }), [animationProgress]);

    const tabBarHeight = getCustomTabBarHeight(insets.bottom);

    return (
        <>
        <View
            className="absolute left-0 right-0 flex-row items-center justify-around px-2 rounded-t-[24px] border-t border-gray-200 bg-white"
            style={{
                bottom: 0,
                height: tabBarHeight,
                paddingBottom: insets.bottom,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 16,
                elevation: 10,
                zIndex: 50,
            }}
        >
            {activeSlots.map((slotId) => {
                const routeInfo = getRouteInfo(slotId);
                if (!routeInfo) return null;

                const isFab = slotId === 'fab-plus';
                
                // Match exact pathname or handle root routing
                const isActiveTab = (path: string) => {
                    const cleanPathname = pathname?.split('?')[0] || '';
                    const cleanPath = path.split('?')[0];
                    if (cleanPath === '/home') return cleanPathname === '/home' || cleanPathname === '/';
                    return cleanPathname === cleanPath || cleanPathname?.startsWith(cleanPath + '/');
                };
                
                const isFocused = !isFab && isActiveTab(routeInfo.path);

                const handlePress = () => {
                    if (isFab) {
                        showQuickActions();
                        return;
                    }
                    if (!isFocused) {
                        warmPath(routeInfo.path);
                        router.navigate(routeInfo.path as Href);
                    }
                };

                const IconComponent = routeInfo.icon;

                if (isFab) {
                    return (
                        <View key={slotId} className="flex flex-col items-center justify-center flex-1 h-full -mt-12 group relative" style={{ overflow: 'visible', zIndex: 60 }}>
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
                        key={slotId}
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
        </View>

        {/* Full-screen FAB overlay (sibling of tab bar — backdrop must cover page, not just tab bar) */}
        {quickActionsVisible && (
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                }}
                pointerEvents="box-none"
            >
                <Animated.View
                    testID="fab-backdrop-blur"
                    className="fab-backdrop-blur"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: backdropOpacity,
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                    }}
                >
                    <Pressable style={{ flex: 1 }} onPress={hideQuickActions} accessibilityRole="button" accessibilityLabel="Tutup menu cepat" />
                </Animated.View>

                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 8,
                        bottom: 0,
                        height: tabBarHeight,
                        paddingBottom: insets.bottom,
                        pointerEvents: 'box-none',
                    }}
                >
                    <View
                        className="w-16 h-16 items-center justify-center -mt-12 relative"
                        style={{ overflow: 'visible' }}
                    >
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
                                    warmPath(subFab1.path);
                                    router.navigate(subFab1.path as any);
                                }}
                                className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-lg active:scale-90"
                            >
                                <subFab1.icon size={20} color={subFab1.color} strokeWidth={2.5} />
                            </Pressable>
                        </Animated.View>

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
                                    warmPath(subFab2.path);
                                    router.navigate(subFab2.path as any);
                                }}
                                className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-lg active:scale-90"
                            >
                                <subFab2.icon size={20} color={subFab2.color} strokeWidth={2.5} />
                            </Pressable>
                        </Animated.View>

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
                                    warmPath(subFab3.path);
                                    router.navigate(subFab3.path as any);
                                }}
                                className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-lg active:scale-90"
                            >
                                <subFab3.icon size={20} color={subFab3.color} strokeWidth={2.5} />
                            </Pressable>
                        </Animated.View>

                        <Pressable
                            onPress={hideQuickActions}
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
                            <Animated.View style={{ transform: [{ rotate: mainFabRotation }] }}>
                                <Plus size={24} color="white" strokeWidth={2.5} />
                            </Animated.View>
                        </Pressable>
                    </View>
                </View>
            </View>
        )}
        </>
    );
}

/** Memoized so root layout re-renders (auth/PIN segments) do not rebuild the bar tree. */
export const CustomTabBar = React.memo(CustomTabBarInner);
