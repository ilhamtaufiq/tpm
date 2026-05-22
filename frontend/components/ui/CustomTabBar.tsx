import React, { useState, useRef } from 'react';
import { View, Pressable, Platform, Modal, Animated } from 'react-native';
import { Typography } from './Typography';
import { cn } from './Card';
import { Plus, X, ShieldCheck, Wrench, Wallet, CarFront, Truck, History } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useUIStore } from '../../store/useUIStore';
import { APP_ROUTES } from '../../constants/NavigationRoutes';
import { router, usePathname } from 'expo-router';

export const CustomTabBar = () => {
    const insets = useSafeAreaInsets();
    const { activeSlots } = useNavigationStore();
    const { themeColors } = useUIStore();
    const pathname = usePathname();
    const [quickActionsVisible, setQuickActionsVisible] = useState(false);

    // Animation values for Quick Action Modal
    const modalOpacity = useRef(new Animated.Value(0)).current;
    const modalTranslateY = useRef(new Animated.Value(300)).current;
    const closeBtnRotation = useRef(new Animated.Value(0)).current;

    const showQuickActions = () => {
        setQuickActionsVisible(true);
        Animated.parallel([
            Animated.timing(modalOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.spring(modalTranslateY, {
                toValue: 0,
                damping: 20,
                stiffness: 150,
                useNativeDriver: true,
            }),
            Animated.timing(closeBtnRotation, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start();
    };

    const hideQuickActions = () => {
        Animated.parallel([
            Animated.timing(modalOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(modalTranslateY, {
                toValue: 300,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(closeBtnRotation, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => setQuickActionsVisible(false));
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
        return APP_ROUTES.find((r) => r.id === id);
    };

    // Quick Actions Options
    const quickActions = [
        { id: 'sdm-absensi', label: 'Absensi Cepat', path: '/sdm/absensi', icon: ShieldCheck, color: '#10B981', bgColor: '#E6F4EA' },
        { id: 'bengkel', label: 'Servis Baru', path: '/bengkel', icon: Wrench, color: '#3B82F6', bgColor: '#E8F0FE' },
        { id: 'sdm-kasbon', label: 'Catat Kasbon', path: '/sdm/kasbon', icon: Wallet, color: '#F59E0B', bgColor: '#FEF3C7' },
        { id: 'mobil', label: 'Jual Mobil', path: '/mobil', icon: CarFront, color: '#F43F5E', bgColor: '#FFE4E6' },
        { id: 'angkut', label: 'Jasa Angkut', path: '/jasa-angkut', icon: Truck, color: '#6366F1', bgColor: '#E0E7FF' },
        { id: 'fin-mutasi', label: 'Mutasi Uang', path: '/finance/mutasi', icon: History, color: '#8B5CF6', bgColor: '#EDE9FE' },
    ];

    const rotateCloseBtn = closeBtnRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '90deg']
    });

    return (
        <View
            className="absolute left-4 right-4 flex-row items-center justify-between px-2 rounded-[24px]"
            style={{
                bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 12,
                height: 66,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
                elevation: 15,
                overflow: 'visible',
            }}
        >
            {activeSlots.map((slotId, index) => {
                const routeInfo = getRouteInfo(slotId);
                if (!routeInfo) return null;

                const isFab = slotId === 'fab-plus';
                
                // Match exact pathname or handle root routing
                const isActiveTab = (path: string) => {
                    if (path === '/home' && (pathname === '/home' || pathname === '/')) return true;
                    return pathname === path || pathname?.startsWith(path + '/');
                };
                
                const isFocused = !isFab && isActiveTab(routeInfo.path);

                const handlePress = () => {
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
                const strokeWidth = isFocused ? 2.5 : 2;

                if (isFab) {
                    return (
                        <View key={index} className="flex-1 items-center justify-center relative" style={{ height: '100%', overflow: 'visible' }}>
                            <Pressable
                                onPress={handlePress}
                                className="absolute -top-7 justify-center items-center active:scale-90"
                                style={{
                                    shadowColor: themeColors.primary,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 15,
                                    elevation: 20,
                                    backgroundColor: 'transparent',
                                }}
                            >
                                {/* Standout FAB without solid border, pure floating icon */}
                                <View
                                    className="w-14 h-14 rounded-full items-center justify-center"
                                    style={{ backgroundColor: themeColors.primary }}
                                >
                                    <Plus size={30} color="white" strokeWidth={3} />
                                </View>
                            </Pressable>
                            <Typography
                                variant="caption"
                                weight="medium"
                                className="text-[9px] uppercase tracking-tighter text-gray-400 mt-8"
                            >
                                {routeInfo.label}
                            </Typography>
                        </View>
                    );
                }

                return (
                    <Pressable
                        key={index}
                        onPress={handlePress}
                        className={cn(
                            "flex-1 items-center justify-center py-1 rounded-2xl active:opacity-70",
                            isFocused ? "bg-primary/5" : ""
                        )}
                    >
                        <View className={cn("mb-1", isFocused ? "scale-110" : "scale-100 opacity-40")}>
                            {IconComponent && (
                                <IconComponent
                                    size={20}
                                    color={isFocused ? themeColors.primary : '#6B7280'}
                                    strokeWidth={strokeWidth}
                                />
                            )}
                        </View>
                        <Typography
                            variant="caption"
                            weight={isFocused ? "bold" : "medium"}
                            className={cn(
                                "text-[9px] uppercase tracking-tighter",
                                isFocused ? "text-primary" : "text-gray-400"
                            )}
                            numberOfLines={1}
                        >
                            {routeInfo.label}
                        </Typography>

                        {/* Focused Dot indicator */}
                        {isFocused && (
                            <View 
                                className="absolute bottom-1 w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: themeColors.primary }}
                            />
                        )}
                    </Pressable>
                );
            })}

            {/* Quick Actions Modal Overlay */}
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
                            opacity: modalOpacity,
                            backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        }}
                        className="absolute inset-0"
                    >
                        <Pressable className="flex-1" onPress={hideQuickActions} />
                    </Animated.View>

                    {/* Content Bottom Sheet */}
                    <Animated.View
                        style={{
                            transform: [{ translateY: modalTranslateY }],
                            opacity: modalOpacity,
                        }}
                        className="bg-white rounded-t-[48px] shadow-2xl overflow-hidden border border-gray-100"
                    >
                        {/* Drag Handle Indicator */}
                        <View className="items-center pt-4 pb-2">
                            <View className="w-12 h-1 bg-gray-200 rounded-full" />
                        </View>

                        {/* Title Section */}
                        <View className="px-8 pt-4 pb-2">
                            <Typography variant="h3" weight="bold" className="tracking-tight text-xl text-text">
                                Aksi Cepat
                            </Typography>
                            <Typography variant="caption" className="text-textGray">
                                Jalan pintas pintar ke fitur utama TPM
                            </Typography>
                        </View>

                        {/* Grid Actions */}
                        <View className="px-6 py-6 flex-row flex-wrap justify-between">
                            {quickActions.map((action, idx) => {
                                const ActionIcon = action.icon;
                                return (
                                    <Pressable
                                        key={idx}
                                        onPress={() => {
                                            hideQuickActions();
                                            router.push(action.path as any);
                                        }}
                                        className="w-[30%] items-center mb-6 active:scale-95"
                                    >
                                        <View
                                            style={{ backgroundColor: action.bgColor }}
                                            className="w-14 h-14 rounded-[20px] items-center justify-center mb-2 shadow-sm border border-black/5"
                                        >
                                            <ActionIcon size={24} color={action.color} strokeWidth={2.2} />
                                        </View>
                                        <Typography
                                            variant="caption"
                                            weight="bold"
                                            className="text-[10px] text-center text-text leading-tight px-1"
                                            numberOfLines={2}
                                        >
                                            {action.label}
                                        </Typography>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Close Button Container */}
                        <View className="items-center pb-8 pt-2 border-t border-gray-50">
                            <Animated.View style={{ transform: [{ rotate: rotateCloseBtn }] }}>
                                <Pressable
                                    onPress={hideQuickActions}
                                    className="w-12 h-12 rounded-full bg-slate-900 justify-center items-center shadow-lg active:scale-90"
                                >
                                    <X size={20} color="white" strokeWidth={2.5} />
                                </Pressable>
                            </Animated.View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};
