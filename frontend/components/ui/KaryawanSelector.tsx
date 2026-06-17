import React, { useState } from 'react';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Users, X, Check, User } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sdmService, Karyawan } from '../../services/sdm';

interface KaryawanSelectorProps {
    value?: Karyawan | null;
    onSelect: (item: Karyawan | null) => void;
    label?: string;
    placeholder?: string;
}

export const KaryawanSelector = ({
    value,
    onSelect,
    label,
    placeholder
}: KaryawanSelectorProps) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Fetch Active Karyawan
    const { data: allKaryawan, isLoading } = useQuery({
        queryKey: ['karyawan_active'],
        queryFn: () => sdmService.getActiveKaryawan(),
        enabled: isOpen,
    });

    // Client-side filtering for better UX
    const filteredKaryawan = React.useMemo(() => {
        if (!allKaryawan) return [];
        if (!searchQuery) return allKaryawan;
        
        const query = searchQuery.toLowerCase();
        return allKaryawan.filter((k: Karyawan) => 
            k.nama.toLowerCase().includes(query) || 
            k.kode.toLowerCase().includes(query) ||
            k.jabatan.toLowerCase().includes(query)
        );
    }, [allKaryawan, searchQuery]);

    const handleOpen = () => {
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleSelect = (item: Karyawan) => {
        onSelect(item);
        handleClose();
    };

    return (
        <View className="mb-4 w-full">
            {label && <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">{label}</Typography>}

            <Pressable onPress={handleOpen}>
                <View className="bg-gray-50 p-5 rounded-3xl border border-gray-100 flex-row items-center">
                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${value ? 'bg-primary/10' : 'bg-gray-100'}`}>
                        <User size={18} color={value ? '#2563EB' : '#9CA3AF'} />
                    </View>

                    <View className="flex-1">
                        {value ? (
                            <>
                                <Typography weight="bold" className="text-primary text-sm uppercase tracking-tight">{value.nama}</Typography>
                                <Typography variant="caption" className="text-textGray/60">
                                    {value.kode} • {value.jabatan}
                                </Typography>
                            </>
                        ) : (
                            <Typography className="text-gray-400 font-bold">{placeholder || "Pilih Karyawan SDM..."}</Typography>
                        )}
                    </View>

                    {value && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }} className="bg-gray-100 p-1.5 rounded-full">
                            <X size={14} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            </Pressable>

            {/* Search Overlay */}
            <Modal
                visible={isOpen}
                animationType="slide"
                onRequestClose={handleClose}
                statusBarTranslucent
            >
                <View style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, flex: 1 }}>
                        <View className="items-center mb-2">
                            <View className="w-10 h-1 bg-gray-200 rounded-full" />
                        </View>

                        <View className="flex-row justify-between items-center mb-6">
                            <Typography variant="h3" weight="bold">Pilih Karyawan</Typography>
                            <Pressable onPress={handleClose} className="bg-gray-50 p-2 rounded-full">
                                <X size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <View className="flex-row items-center bg-gray-100 rounded-[24px] px-5 py-4 mb-6">
                            <Search size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-base text-text font-medium"
                                placeholder="Cari nama atau jabatan..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        {isLoading ? (
                            <View className="flex-1 items-center justify-center">
                                <ActivityIndicator size="large" color="#2563EB" />
                                <Typography className="text-textGray mt-4">Memuat data SDM...</Typography>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredKaryawan}
                                keyExtractor={(item) => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <Pressable onPress={() => handleSelect(item)}>
                                        <Card className={`mb-4 p-5 border ${value?.id === item.id ? 'border-primary bg-primary/5' : 'border-gray-50'} flex-row items-center justify-between`}>
                                            <View className="flex-1 mr-4">
                                                <Typography weight="bold" className="text-text text-base">{item.nama}</Typography>
                                                <View className="flex-row items-center mt-1">
                                                    <Badge
                                                        label={item.kode}
                                                        variant={value?.id === item.id ? "info" : "neutral"}
                                                        className="mr-2"
                                                    />
                                                    <Typography variant="caption" weight="medium" className="text-textGray/60">
                                                        {item.jabatan}
                                                    </Typography>
                                                </View>
                                            </View>
                                            {value?.id === item.id && (
                                                <View className="bg-primary w-8 h-8 rounded-full items-center justify-center">
                                                    <Check size={18} color="white" />
                                                </View>
                                            )}
                                        </Card>
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    <View className="items-center mt-20 px-10">
                                        <Users size={48} color="#E5E7EB" strokeWidth={1} />
                                        <Typography className="text-gray-400 mt-4 text-center">
                                            {searchQuery.length > 0 ? "Karyawan tidak ditemukan" : "Daftar karyawan kosong atau belum dimuat"}
                                        </Typography>
                                    </View>
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
