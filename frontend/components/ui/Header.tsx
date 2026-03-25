import React, { useState, useMemo } from 'react';
import { Search, Bell, User, X, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { Typography } from './Typography';
import { TouchableOpacity, View, Modal, TextInput, ScrollView, Dimensions, Image, Platform } from 'react-native';
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
    showProfile = false,
    children,
    variant = 'page'
}: HeaderProps) => {
    const { user } = useAuthStore();
    const { themeColors } = useUIStore();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');

    const query = searchValue !== undefined ? searchValue : localSearchQuery;
    const setQuery = onSearchChange || setLocalSearchQuery;

    const filteredRoutes = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return APP_ROUTES.filter(route =>
            route.label.toLowerCase().includes(q) ||
            route.description.toLowerCase().includes(q) ||
            route.category.toLowerCase().includes(q) ||
            route.keywords.some(k => k.toLowerCase().includes(q))
        ).slice(0, 10);
    }, [query]);

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
                router.replace('/(tabs)/home');
            }
        }
    };

    return (
        <View className="bg-primary pt-14 pb-8 px-6 rounded-b-[40px] shadow-2xl relative overflow-hidden">
            {/* Decorative Ambient Glass */}
            <View className="absolute top-[-50] left-[-30] w-[200] h-[200] bg-white/10 rounded-full blur-[80px]" />
            <View className="absolute bottom-[-20] right-[-20] w-[150] h-[150] bg-white/10 rounded-full blur-[60px]" />

            {/* Header Content */}
            <View className="z-10">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center flex-1">
                        {showBackButton && (
                            <TouchableOpacity
                                onPress={handleBack}
                                className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                            >
                                <ChevronLeft size={24} color="white" />
                            </TouchableOpacity>
                        )}

                        {leftElement && (
                            <View className="mr-4">
                                {leftElement}
                            </View>
                        )}
                        <View className="flex-1">
                            {variant === 'home' ? (
                                <>
                                    <Typography className="text-white/60 text-[10px] uppercase tracking-[3px] font-bold mb-1">
                                        Selamat Datang 👋
                                    </Typography>
                                    <Typography variant="h3" weight="bold" className="text-white leading-tight">
                                        {user?.full_name || user?.name || 'Admin TPM'}
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    {subtitle && (
                                        <View className="flex-row items-center mb-0.5">
                                            <View className="w-1.5 h-1.5 rounded-full bg-secondary mr-2" />
                                            <Typography className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                                                {subtitle}
                                            </Typography>
                                        </View>
                                    )}
                                    <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">
                                        {title}
                                    </Typography>
                                </>
                            )}
                        </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                        {rightElement}
                        {showProfile && (
                            <TouchableOpacity
                                onPress={() => router.push('/(tabs)/profile')}
                                className="w-11 h-11 bg-white/20 rounded-2xl p-0.5 border border-white/10 overflow-hidden ml-2"
                            >
                                <View className="w-full h-full bg-white rounded-2xl items-center justify-center overflow-hidden">
                                    {user?.profile_picture ? (
                                        <Image source={{ uri: getFileUrl(user.profile_picture) as string }} className="w-full h-full" />
                                    ) : (
                                        <User size={22} color={themeColors.primary} strokeWidth={2.5} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {showSearch && (
                    <TouchableOpacity
                        onPress={() => setIsSearchOpen(true)}
                        activeOpacity={0.9}
                        className="bg-white/10 h-11 rounded-2xl flex-row items-center px-4 border border-white/10 backdrop-blur-md mt-2"
                    >
                        <Search size={18} color="white" opacity={0.6} />
                        <Typography className="text-white/60 ml-3 font-medium text-sm flex-1" numberOfLines={1}>
                            {searchPlaceholder}
                        </Typography>
                    </TouchableOpacity>
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
                    <View className="pt-14 pb-4 px-6 border-b border-gray-100 flex-row items-center">
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
                                <TouchableOpacity onPress={() => setQuery('')}>
                                    <X size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => setIsSearchOpen(false)} className="ml-4">
                            <Typography weight="bold" className="text-primary pr-2">Batal</Typography>
                        </TouchableOpacity>
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
                                        <TouchableOpacity
                                            key={route.id}
                                            onPress={() => handleNavigate(route.path)}
                                            className="flex-row items-center py-5 bg-surface mb-4 rounded-[28px] px-5 border border-gray-50 shadow-sm"
                                            activeOpacity={0.7}
                                        >
                                            <View className="bg-primary/5 w-14 h-14 rounded-2xl items-center justify-center mr-4">
                                                <Icon size={24} color={themeColors.primary} />
                                            </View>
                                            <View className="flex-1">
                                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">{route.label}</Typography>
                                                <Typography variant="caption" className="text-text/40" numberOfLines={1}>{route.description}</Typography>
                                            </View>
                                            <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                                                <ChevronRight size={16} color="#D1D5DB" />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View className="p-12 items-center">
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
        </View>
    );
};
