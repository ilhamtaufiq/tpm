import React, { useState, useMemo } from 'react';
import { Search, Bell, User, X, ChevronRight } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { TouchableOpacity, View, Modal, TextInput, ScrollView, Dimensions, Image } from 'react-native';
import { APP_ROUTES, AppRoute } from '../constants/NavigationRoutes';
import { router } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HomeHeaderProps {
    onRefresh?: () => void;
    refreshing?: boolean;
}

export const HomeHeader = ({ onRefresh, refreshing = false }: HomeHeaderProps) => {
    const { user } = useAuthStore();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRoutes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return APP_ROUTES.filter(route =>
            route.label.toLowerCase().includes(q) ||
            route.description.toLowerCase().includes(q) ||
            route.category.toLowerCase().includes(q) ||
            route.keywords.some(k => k.toLowerCase().includes(q))
        ).slice(0, 10);
    }, [searchQuery]);

    const handleNavigate = (path: string) => {
        setIsSearchOpen(false);
        setSearchQuery('');
        router.push(path as any);
    };

    return (
        <View className="bg-primary pt-12 pb-8 px-6 rounded-b-[40px] shadow-2xl relative overflow-hidden">
            {/* Decorative Ambient Glass */}
            <View className="absolute top-[-50] left-[-30] w-[200] h-[200] bg-white/10 rounded-full blur-[80px]" />
            <View className="absolute bottom-[-20] right-[-20] w-[150] h-[150] bg-secondary/20 rounded-full blur-[60px]" />

            {/* Combined Row: Search (Expandable) + Icons */}
            <View className="flex-row items-center gap-3 z-10 mt-2">
                {/* Search Bar - Takes available space */}
                <TouchableOpacity
                    onPress={() => setIsSearchOpen(true)}
                    activeOpacity={0.9}
                    className="flex-1 bg-white/10 h-11 rounded-2xl flex-row items-center px-4 border border-white/10 backdrop-blur-md"
                >
                    <Search size={18} color="white" opacity={0.6} />
                    <Typography className="text-white/60 ml-3 font-medium text-sm flex-1" numberOfLines={1}>Cari layanan...</Typography>
                </TouchableOpacity>

                {/* Icons Container */}
                <View className="flex-row items-center gap-2">
                    {/* Notification Icon */}
                    {/* <TouchableOpacity
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        activeOpacity={0.7}
                    >
                        <Bell size={20} color="white" />
                        <View className="absolute top-2.5 right-2.5 w-2 h-2 bg-secondary rounded-full border border-primary" />
                    </TouchableOpacity> */}
                </View>
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
                        <View className="flex-1 bg-gray-50 h-12 rounded-2xl flex-row items-center px-4 border border-primary/20">
                            <Search size={20} color="#00AA13" />
                            <TextInput
                                autoFocus
                                placeholder="Ketik rute, layanan, atau laporan..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                className="flex-1 ml-3 h-full text-text font-bold"
                                placeholderTextColor="#9CA3AF"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
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
                        {searchQuery.trim() === '' ? (
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
                                            className="flex-row items-center py-5 bg-white mb-4 rounded-[28px] px-5 border border-gray-50 shadow-sm"
                                            activeOpacity={0.7}
                                        >
                                            <View className="bg-emerald-50 w-14 h-14 rounded-2xl items-center justify-center mr-4">
                                                <Icon size={24} color="#00AA13" />
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

