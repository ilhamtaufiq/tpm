import React, { useState, useMemo } from 'react';
import { Search, Bell, User, X, ChevronRight, ChevronLeft, LogOut, Briefcase } from 'lucide-react-native';
import { Typography } from './Typography';
import { Pressable, View, Modal, TextInput, ScrollView, Dimensions, Image, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ROUTES } from '../../constants/NavigationRoutes';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { getFileUrl } from '../../utils/image';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HeaderProps {
    title?: string;
    subtitle?: string;
    showBackButton?: boolean;
    onBackButtonPress?: () => void;
    showSearch?: boolean;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (text: string) => void;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    showProfile?: boolean;
    children?: React.ReactNode;
    variant?: 'home' | 'page';
}

export const Header = ({
    title,
    subtitle,
    showBackButton = false,
    onBackButtonPress,
    showSearch = false,
    searchPlaceholder = "Cari layanan...",
    searchValue,
    onSearchChange,
    leftElement,
    rightElement,
    showProfile = true,
    children,
    variant = 'page'
}: HeaderProps) => {
    const insets = useSafeAreaInsets();
    const { user, logout, isImpersonating, impersonatorUser, stopImpersonation } = useAuthStore();
    const { themeColors } = useUIStore();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [userMenuVisible, setUserMenuVisible] = useState(false);

    const query = searchValue !== undefined ? searchValue : localSearchQuery;
    const setQuery = onSearchChange || setLocalSearchQuery;

    const filteredRoutes = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        const role = user?.role;

        return APP_ROUTES.filter(route => {
            // Role-based filtering
            if (role !== 'ADMIN' && role !== 'MANAGER') {
                if (role === 'BENGKEL') {
                    if (route.category !== 'Bengkel' && route.id !== 'profile' && !route.path.startsWith('/settings/')) return false;
                } else if (role === 'JASA_ANGKUT') {
                    if (route.category !== 'Logistik' && route.id !== 'profile' && !route.path.startsWith('/settings/')) return false;
                } else if (role === 'MOBIL') {
                    if (route.category !== 'Mobil' && route.id !== 'profile' && !route.path.startsWith('/settings/')) return false;
                }
            }

            // Search query filtering
            return route.label.toLowerCase().includes(q) ||
                route.description.toLowerCase().includes(q) ||
                route.category.toLowerCase().includes(q) ||
                route.keywords.some(k => k.toLowerCase().includes(q));
        }).slice(0, 10);
    }, [query, user?.role]);

    const handleNavigate = (path: string) => {
        setIsSearchOpen(false);
        setLocalSearchQuery('');
        router.push(path as any);
    };

    const handleBack = () => {
        if (onBackButtonPress) {
            onBackButtonPress();
        } else {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/');
            }
        }
    };

    return (
        <View 
            className="bg-white pb-4 border-b border-gray-100 px-6 relative overflow-hidden"
            style={{ paddingTop: Math.max(insets.top, 16) + 8 }}
        >
            {/* Header Content */}
            <View className="z-10">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center flex-1">
                        {showBackButton && (
                            <Pressable
                                onPress={handleBack}
                                className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center mr-4 border border-gray-100 active:bg-gray-100"
                            >
                                <ChevronLeft size={24} color="#1F2937" />
                            </Pressable>
                        )}

                        {leftElement && (
                            <View className="mr-4">
                                {leftElement}
                            </View>
                        )}
                        <View className="flex-1">
                            {variant === 'home' ? (
                                <View className="flex-row items-center gap-3">
                                    <View className="w-10 h-10 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                                        <Briefcase size={20} color={themeColors.primary} />
                                    </View>
                                    <Typography variant="h2" weight="bold" className="text-gray-900 tracking-tighter">
                                        TPM
                                    </Typography>
                                </View>
                            ) : (
                                <>
                                    {subtitle && (
                                        <View className="flex-row items-center mb-0.5">
                                            <View style={{ backgroundColor: themeColors.primary }} className="w-1.5 h-1.5 rounded-full mr-2" />
                                            <Typography className="text-gray-400 text-[9px] uppercase tracking-widest font-bold">
                                                {subtitle}
                                            </Typography>
                                        </View>
                                    )}
                                    <Typography variant="h2" weight="bold" className="text-gray-900 text-xl tracking-tighter" numberOfLines={1}>
                                        {title}
                                    </Typography>
                                </>
                            )}
                        </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                        {isImpersonating && (
                            <Pressable
                                onPress={() => {
                                    stopImpersonation();
                                    const restoredUser = useAuthStore.getState().user;
                                    if (restoredUser?.role === 'ADMIN' || restoredUser?.role === 'MANAGER') {
                                        router.replace('/(tabs)/home');
                                    } else if (restoredUser?.role === 'BENGKEL') {
                                        router.replace('/bengkel');
                                    } else if (restoredUser?.role === 'JASA_ANGKUT') {
                                        router.replace('/jasa-angkut');
                                    } else if (restoredUser?.role === 'MOBIL') {
                                        router.replace('/mobil');
                                    } else {
                                        router.replace('/(tabs)/home');
                                    }
                                }}
                                className="px-3 h-11 bg-amber-100 rounded-2xl items-center justify-center border border-amber-200"
                            >
                                <Typography className="text-amber-800 text-[10px] font-black uppercase tracking-wider">
                                    Stop
                                </Typography>
                            </Pressable>
                        )}
                        {rightElement}
                        {variant === 'home' && (
                            <Pressable
                                onPress={() => setUserMenuVisible(true)}
                                className="w-11 h-11 bg-gray-50 rounded-2xl p-0.5 border border-gray-100 overflow-hidden relative active:opacity-75"
                            >
                                <View className="w-full h-full bg-white rounded-2xl items-center justify-center overflow-hidden">
                                    {user?.profile_picture ? (
                                        <Image source={{ uri: getFileUrl(user.profile_picture) as string }} className="w-full h-full" />
                                    ) : (
                                        <User size={22} color={themeColors.primary} strokeWidth={2.5} />
                                    )}
                                </View>
                            </Pressable>
                        )}
                        {showProfile && variant !== 'home' && (
                            <View className="flex-row items-center">
                                <Pressable
                                    onPress={() => setUserMenuVisible(true)}
                                    className="w-11 h-11 bg-gray-50 rounded-2xl p-0.5 border border-gray-100 overflow-hidden ml-2 active:opacity-75"
                                >
                                    <View className="w-full h-full bg-white rounded-2xl items-center justify-center overflow-hidden">
                                        {user?.profile_picture ? (
                                            <Image source={{ uri: getFileUrl(user.profile_picture) as string }} className="w-full h-full" />
                                        ) : (
                                            <User size={22} color={themeColors.primary} strokeWidth={2.5} />
                                        )}
                                    </View>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </View>

                {showSearch && (
                    <Pressable
                        onPress={() => setIsSearchOpen(true)}
                        className="bg-gray-50 h-11 rounded-2xl flex-row items-center px-4 border border-gray-100 mt-2 active:bg-gray-100"
                    >
                        <Search size={18} color="#9CA3AF" />
                        <Typography className="text-gray-500 ml-3 font-medium text-sm flex-1" numberOfLines={1}>
                            {searchPlaceholder}
                        </Typography>
                    </Pressable>
                )}

                {isImpersonating && (
                    <View className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                        <Typography className="text-amber-800 text-[10px] font-black uppercase tracking-[2px] mb-1">
                            Mode Impersonate
                        </Typography>
                        <Typography className="text-gray-900 text-xs font-bold">
                            Login sebagai {user?.full_name || user?.username}
                        </Typography>
                        <Typography className="text-gray-500 text-[10px] mt-1 font-medium">
                            Admin asal: {impersonatorUser?.full_name || impersonatorUser?.username}
                        </Typography>
                    </View>
                )}

                {children && <View className="mt-4">{children}</View>}
            </View>

            {/* Search Modal */}
            <Modal
                visible={isSearchOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsSearchOpen(false)}
            >
                <View className="flex-1 bg-white">
                    {/* Modal Header */}
                    <View 
                        className="pb-4 px-6 border-b border-gray-100 flex-row items-center"
                        style={{ paddingTop: Math.max(insets.top, 16) + 16 }}
                    >
                        <View className="flex-1 bg-background h-12 rounded-2xl flex-row items-center px-4 border border-primary/20">
                            <Search size={20} color={themeColors.primary} />
                            <TextInput
                                autoFocus
                                placeholder="Ketik rute, layanan, atau laporan..."
                                value={query}
                                onChangeText={setQuery}
                                className="flex-1 ml-3 h-full text-text font-bold"
                                placeholderTextColor="#9CA3AF"
                            />
                            {query.length > 0 && (
                                <Pressable onPress={() => setQuery('')}>
                                    <X size={18} color="#9CA3AF" />
                                </Pressable>
                            )}
                        </View>
                        <Pressable onPress={() => setIsSearchOpen(false)} className="ml-4">
                            <Typography weight="bold" className="text-primary pr-2">Batal</Typography>
                        </Pressable>
                    </View>

                    {/* Results Container */}
                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                        {query.trim() === '' ? (
                            <View className="p-12 items-center">
                                <View className="w-24 h-24 bg-gray-50 rounded-[32px] items-center justify-center mb-6">
                                    <Search size={48} color="#D1D5DB" strokeWidth={1.5} />
                                </View>
                                <Typography weight="bold" className="text-text tracking-tight text-center text-lg">Quick Search</Typography>
                                <Typography variant="caption" className="text-text/40 text-center mt-2 max-w-[200px]">Temukan akses cepat ke fitur dan laporan operasional TPM</Typography>
                            </View>
                        ) : filteredRoutes.length > 0 ? (
                            <View className="px-6 py-6">
                                <Typography variant="caption" weight="bold" className="text-text/30 mb-6 tracking-[3px] uppercase">Hasil Pencarian</Typography>
                                {filteredRoutes.map((route) => {
                                    const Icon = route.icon;
                                    return (
                                        <Pressable
                                            key={route.id}
                                            onPress={() => handleNavigate(route.path)}
                                            className="flex-row items-center py-5 bg-surface mb-4 rounded-[28px] px-5 border border-gray-50 shadow-sm"
                                        >
                                            <View className="bg-primary/5 w-14 h-14 rounded-2xl items-center justify-center mr-4">
                                                <Icon size={24} color={themeColors.primary} />
                                            </View>
                                            <View className="flex-1">
                                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">{route.label}</Typography>
                                                <Typography variant="caption" className="text-text/40" numberOfLines={1}>{route.description}</Typography>
                                            </View>
                                            <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center" >
                                                <ChevronRight size={16} color="#D1D5DB" />
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : (
                            <View className="p-12 items-center" >
                                <View className="w-24 h-24 bg-red-50 rounded-[32px] items-center justify-center mb-6 opacity-40">
                                    <Search size={48} color="#EF4444" strokeWidth={1.5} />
                                </View>
                                <Typography weight="bold" className="text-text">Data Tidak Ditemukan</Typography>
                                <Typography variant="caption" className="text-text/30 mt-2">Coba kata kunci lain atau periksa ejaan</Typography>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>

            {/* User Dropdown Menu */}
            <Modal
                visible={userMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setUserMenuVisible(false)}
            >
                <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
                    {/* Transparent Backdrop to close the menu */}
                    <Pressable 
                        className="absolute inset-0 bg-black/5" 
                        onPress={() => setUserMenuVisible(false)} 
                    />

                    {/* Floating Dropdown Menu Card */}
                    <View
                        className="bg-white rounded-3xl border border-gray-100 shadow-2xl p-2 absolute w-[180px]"
                        style={{
                            top: Math.max(insets.top, 16) + 56, // positions it perfectly right below the header avatar
                            right: 24,
                            elevation: 10,
                        }}
                    >
                        {/* Option: Profile */}
                        <Pressable
                            onPress={() => {
                                setUserMenuVisible(false);
                                router.push('/(tabs)/profile');
                            }}
                            className="flex-row items-center p-3 rounded-2xl active:bg-gray-50"
                        >
                            <User size={16} color="#374151" strokeWidth={2.5} />
                            <Typography className="text-gray-700 text-xs font-bold ml-2">
                                Profil Saya
                            </Typography>
                        </Pressable>

                        {/* Option: Settings */}
                        <Pressable
                            onPress={() => {
                                setUserMenuVisible(false);
                                router.push('/settings/profile');
                            }}
                            className="flex-row items-center p-3 rounded-2xl active:bg-gray-50"
                        >
                            <User size={16} color="#6B7280" strokeWidth={2.2} />
                            <Typography className="text-gray-500 text-xs font-medium ml-2">
                                Ubah Profil
                            </Typography>
                        </Pressable>

                        {/* Divider */}
                        <View className="h-[1px] bg-gray-100 my-1 mx-2" />

                        {/* Option: Logout */}
                        <Pressable
                            onPress={() => {
                                setUserMenuVisible(false);
                                setTimeout(() => {
                                    Alert.alert(
                                        'Keluar Sesi',
                                        'Apakah Anda yakin ingin keluar dari aplikasi?',
                                        [
                                            { text: 'Batal', style: 'cancel' },
                                            { 
                                                text: 'Keluar', 
                                                style: 'destructive', 
                                                onPress: () => {
                                                    logout();
                                                    router.replace('/(auth)/login' as any);
                                                } 
                                            }
                                        ]
                                    );
                                }, 100);
                            }}
                            className="flex-row items-center p-3 rounded-2xl active:bg-red-50"
                        >
                            <LogOut size={16} color="#EF4444" strokeWidth={2.5} />
                            <Typography className="text-red-500 text-xs font-bold ml-2">
                                Keluar Sesi
                            </Typography>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
