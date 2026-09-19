import React, { useState, useMemo } from 'react';
import { Search, Bell, User, X, ChevronRight, ChevronLeft, LogOut, Activity } from 'lucide-react-native';
import { Typography } from './Typography';
import { Pressable, View, Modal, TextInput, ScrollView, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ROUTES } from '../../constants/NavigationRoutes';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/auth';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useUIStore } from '../../store/useUIStore';
import { getFileUrl } from '../../utils/image';
import { AlertDialog } from './AlertDialog';
import { ModalThemeView } from './ModalThemeView';

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
    showBell?: boolean;
    children?: React.ReactNode;
    variant?: 'home' | 'page';
}

export const Header = ({
    title,
    subtitle: _subtitle,
    showBackButton = false,
    onBackButtonPress,
    showSearch = false,
    searchPlaceholder = "Cari layanan...",
    searchValue,
    onSearchChange,
    leftElement,
    rightElement,
    showProfile = true,
    showBell = true,
    children,
    variant = 'page'
}: HeaderProps) => {
    const insets = useSafeAreaInsets();
    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);
    const isImpersonating = useAuthStore(state => state.isImpersonating);
    const impersonatorUser = useAuthStore(state => state.impersonatorUser);
    const stopImpersonation = useAuthStore(state => state.stopImpersonation);
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const clearNotifications = useNotificationStore(state => state.clear);
    const themeColors = useUIStore(state => state.themeColors);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [userMenuVisible, setUserMenuVisible] = useState(false);
    const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

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
                    if (route.category !== 'Jasa Angkut' && route.id !== 'profile' && !route.path.startsWith('/settings/')) return false;
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

    const performLogout = async () => {
        setIsLoggingOut(true);
        try {
            await authService.clearPushToken().catch((error) => {
                console.warn('[Header] Failed to clear push token before logout', error);
            });
            clearNotifications();
            logout();
            await (useAuthStore as any).persist?.clearStorage?.();
            router.replace('/(auth)/login');
        } finally {
            setIsLoggingOut(false);
            setLogoutDialogVisible(false);
        }
    };

    const handleLogout = () => {
        setUserMenuVisible(false);
        setLogoutDialogVisible(true);
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
        <>
        <View 
            className={`bg-surface border-b border-transparent px-6 relative overflow-hidden ${children ? 'pb-2' : 'pb-4'}`}
            style={{ paddingTop: Math.max(insets.top, 16) + 8 }}
        >
            {/* Header Content */}
            <View className="z-10">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center flex-1">
                        {showBackButton && (
                            <Pressable
                                onPress={handleBack}
                                className="w-11 h-11 bg-background rounded-2xl items-center justify-center mr-4 border border-transparent active:bg-background"
                            >
                                <ChevronLeft size={24} color={themeColors.text} />
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
                                    <Typography variant="h2" weight="bold" className="text-text tracking-tighter">
                                        TPM
                                    </Typography>
                                </View>
                            ) : (
                                <Typography variant="h2" weight="bold" className="text-text text-xl tracking-tighter" numberOfLines={1}>
                                    {title}
                                </Typography>
                            )}
                        </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                        {showBell && (
                        <Pressable
                            onPress={() => router.push('/settings/notifications')}
                            className="w-11 h-11 bg-background rounded-2xl items-center justify-center border border-transparent shadow-sm active:opacity-75 relative"
                        >
                            <Bell size={20} color={themeColors.text} strokeWidth={2.2} />
                            {unreadCount > 0 && (
                                <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center border-2 border-white">
                                    <Typography className="text-white text-[9px] font-black">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Typography>
                                </View>
                            )}
                        </Pressable>
                        )}

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
                            onPress={() => {
                                setUserMenuVisible(true);
                            }}
                            className="w-11 h-11 bg-background rounded-2xl p-0.5 border border-transparent overflow-hidden relative active:opacity-75"
                        >
                            <View className="w-full h-full bg-surface rounded-2xl items-center justify-center overflow-hidden">
                                {user?.profile_picture ? (
                                    <Image source={{ uri: getFileUrl(user.profile_picture) as string }} className="w-full h-full" />
                                ) : (
                                    <User size={22} color={themeColors.text} strokeWidth={2.5} />
                                )}
                            </View>
                        </Pressable>
                        )}
                        {showProfile && variant !== 'home' && (
                            <View className="flex-row items-center">
                                <Pressable
                                    onPress={() => {
                                        setUserMenuVisible(true);
                                    }}
                                    className="w-11 h-11 bg-background rounded-2xl p-0.5 border border-transparent overflow-hidden ml-2 active:opacity-75"
                                >
                                <View className="w-full h-full bg-surface rounded-2xl items-center justify-center overflow-hidden">
                                    {user?.profile_picture ? (
                                        <Image source={{ uri: getFileUrl(user.profile_picture) as string }} className="w-full h-full" />
                                    ) : (
                                        <User size={22} color={themeColors.text} strokeWidth={2.5} />
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
                        className="bg-background h-11 rounded-2xl flex-row items-center px-4 border border-transparent mt-2 active:bg-background"
                    >
                        <Search size={18} color={themeColors.textGray} />
                        <Typography className="text-textGray ml-3 font-medium text-sm flex-1" numberOfLines={1}>
                            {searchPlaceholder}
                        </Typography>
                    </Pressable>
                )}

                {isImpersonating && (
                    <View className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                        <Typography className="text-amber-800 text-[10px] font-black uppercase tracking-[2px] mb-1">
                            Mode Impersonate
                        </Typography>
                        <Typography className="text-text text-xs font-bold">
                            Login sebagai {user?.full_name || user?.username}
                        </Typography>
                        <Typography className="text-textGray text-[10px] mt-1 font-medium">
                            Admin asal: {impersonatorUser?.full_name || impersonatorUser?.username}
                        </Typography>
                    </View>
                )}

                {children && <View className="mt-3 mb-1">{children}</View>}
            </View>

            {/* Search Modal */}
            <Modal
                visible={isSearchOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setIsSearchOpen(false)}
            >
                <ModalThemeView className="flex-1 bg-surface">
                    {/* Modal Header */}
                    <View
                        className="pb-4 px-6 border-b border-border flex-row items-center"
                        style={{ paddingTop: Math.max(insets.top, 16) + 16 }}
                    >
                        <View className="flex-1 bg-background h-12 rounded-2xl flex-row items-center px-4 border border-border">
                            <Search size={20} color={themeColors.primary} />
                            <TextInput
                                autoFocus
                                placeholder="Ketik rute, layanan, atau laporan..."
                                value={query}
                                onChangeText={setQuery}
                                className="flex-1 ml-3 h-full text-text font-bold"
                                placeholderTextColor={themeColors.textGray}
                            />
                            {query.length > 0 && (
                                <Pressable onPress={() => setQuery('')}>
                                    <X size={18} color={themeColors.textGray} />
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
                                <View className="w-24 h-24 bg-background rounded-[32px] items-center justify-center mb-6">
                                    <Search size={48} color={themeColors.textGray} strokeWidth={1.5} />
                                </View>
                                <Typography weight="bold" className="text-text tracking-tight text-center text-lg">Quick Search</Typography>
                                <Typography variant="caption" className="text-textGray text-center mt-2 max-w-[200px]">Temukan akses cepat ke fitur dan laporan operasional TPM</Typography>
                            </View>
                        ) : filteredRoutes.length > 0 ? (
                            <View className="px-6 py-6">
                                <Typography variant="caption" weight="bold" className="text-textGray mb-6 tracking-[3px] uppercase">Hasil Pencarian</Typography>
                                {filteredRoutes.map((route) => {
                                    const Icon = route.icon;
                                    return (
                                        <Pressable
                                            key={route.id}
                                            onPress={() => handleNavigate(route.path)}
                                            className="flex-row items-center py-5 bg-surface mb-4 rounded-[28px] px-5 border border-border shadow-sm"
                                        >
                                            <View className="bg-primary/5 w-14 h-14 rounded-2xl items-center justify-center mr-4">
                                                <Icon size={24} color={themeColors.primary} />
                                            </View>
                                            <View className="flex-1">
                                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">{route.label}</Typography>
                                                <Typography variant="caption" className="text-textGray" numberOfLines={1}>{route.description}</Typography>
                                            </View>
                                            <View className="w-8 h-8 rounded-full bg-background items-center justify-center" >
                                                <ChevronRight size={16} color={themeColors.textGray} />
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
                                <Typography variant="caption" className="text-textGray mt-2">Coba kata kunci lain atau periksa ejaan</Typography>
                            </View>
                        )}
                    </ScrollView>
                </ModalThemeView>
            </Modal>

            {/* User Dropdown Menu */}
            <Modal
                visible={userMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setUserMenuVisible(false)}
            >
                <ModalThemeView className="flex-1 relative">
                    {/* Fullscreen Backdrop overlay — tap anywhere outside closes menu */}
                    <Pressable
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
                        onPress={() => setUserMenuVisible(false)}
                    />

                    {/* Floating Dropdown Menu Card */}
                    <View
                        className="bg-surface rounded-3xl border border-border shadow-2xl p-2 absolute w-[190px]"
                        style={{
                            top: Math.max(insets.top, 16) + 56, // positions it perfectly right below the header avatar
                            right: 24,
                            elevation: 16,
                            zIndex: 10,
                        }}
                    >
                        {/* Option: Profile Settings */}
                        <Pressable
                            onPress={() => {
                                setUserMenuVisible(false);
                                router.push('/settings/profile');
                            }}
                            className="flex-row items-center p-3.5 rounded-2xl active:bg-background"
                        >
                            <User size={16} color={themeColors.textGray} strokeWidth={2.2} />
                            <Typography className="text-text text-xs font-semibold ml-2.5">
                                Ubah Profile
                            </Typography>
                        </Pressable>

                        {/* Option: Logout */}
                        <Pressable
                            onPress={handleLogout}
                            className="flex-row items-center p-3.5 rounded-2xl active:bg-rose-500/10"
                        >
                            <LogOut size={16} color="#EF4444" strokeWidth={2.5} />
                            <Typography className="text-rose-500 text-xs font-bold ml-2.5">
                                Keluar
                            </Typography>
                        </Pressable>
                    </View>
                </ModalThemeView>
            </Modal>

        </View>
        <AlertDialog
            visible={logoutDialogVisible}
            title="Keluar Sesi"
            message="Apakah Anda yakin ingin keluar dari aplikasi?"
            variant="warning"
            type="confirm"
            confirmText="Keluar"
            cancelText="Batal"
            loading={isLoggingOut}
            onClose={() => setLogoutDialogVisible(false)}
            onConfirm={performLogout}
        />
        </>
    );
};
