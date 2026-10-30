import React, { useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import Search from 'lucide-react-native/dist/esm/icons/search.js';
import Wrench from 'lucide-react-native/dist/esm/icons/wrench.js';
import X from 'lucide-react-native/dist/esm/icons/x.js';
import Check from 'lucide-react-native/dist/esm/icons/check.js';
import { jasaServisService } from '../../services/jasaServis';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, parseNumber } from '../../utils/format';
import { useUIStore } from '../../store/useUIStore';

interface JasaSelectorProps {
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
}

export const JasaSelector = ({
    value,
    onSelect,
    label,
    placeholder
}: JasaSelectorProps) => {
    const themeColors = useUIStore((s) => s.themeColors);
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    // Debounce: tanpa ini tiap ketikan = query baru + render ulang layar penuh (lag di Android).
    const debouncedSearch = useDebounce(searchQuery, 350);
    const [isOpen, setIsOpen] = useState(false);

    // Jasa Search Query
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search_jasa', debouncedSearch],
        queryFn: async () => {
            const res = await jasaServisService.getJasaList({ search: debouncedSearch, limit: 20 });
            return res.data;
        },
        enabled: isOpen,
    });

    const handleOpen = () => {
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleSelect = (item: any) => {
        onSelect(item);
        handleClose();
    };

    return (
        <View className="mb-4 w-full">
            {label && <Typography weight="medium" className="text-textGray text-sm mb-1">{label}</Typography>}

            <Pressable onPress={handleOpen} hitSlop={8}>
                <View className="bg-background rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center">
                    <Wrench size={20} color={value ? '#8B5CF6' : themeColors.textGray} />

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="semibold" className="text-text text-base">{value.nama}</Typography>
                                <Typography variant="caption" className="text-textGray">
                                    {value.kategori || 'Servis'} • {formatCurrency(value.harga)}
                                </Typography>
                            </>
                        ) : (
                            <Typography className="text-textGray text-base">{placeholder || "Pilih Jasa Servis"}</Typography>
                        )}
                    </View>

                    {value && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color={themeColors.textGray} />
                        </Pressable>
                    )}
                </View>
            </Pressable>


            {/* Search Overlay using Modal (Fixes clipping in ScrollViews on Android) */}
            <Modal
                visible={isOpen}
                animationType="slide"
                onRequestClose={handleClose}
                statusBarTranslucent
            >
                <View className="bg-surface" style={{ flex: 1 }}>
                    <View style={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, flex: 1 }}>
                        <View className="items-center mb-2">
                            <View className="w-10 h-1 bg-border rounded-full" />
                        </View>

                        <View className="flex-row justify-between items-center mb-6">
                            <Typography variant="h3" weight="bold">Cari Jasa Servis</Typography>
                            <Pressable onPress={handleClose} hitSlop={12}>
                                <X size={24} color={themeColors.textGray} />
                            </Pressable>
                        </View>

                        <View className="flex-row items-center bg-background rounded-xl px-4 py-3 mb-4">
                            <Search size={20} color={themeColors.textGray} />
                            <TextInput
                                className="flex-1 ml-3 text-base text-text font-outfit"
                                placeholder="Ketik nama jasa..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                placeholderTextColor={themeColors.textGray}
                            />
                        </View>

                        {isLoading ? (
                            <ActivityIndicator className="mt-4" color="#8B5CF6" />
                        ) : (
                            <FlatList
                                data={searchResults || []}
                                keyExtractor={(item) => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <Pressable onPress={() => handleSelect(item)}>
                                        <Card className="mb-3 p-4 border border-transparent flex-row items-center justify-between">
                                            <View className="flex-1 mr-4">
                                                <Typography weight="semibold" className="text-base">{item.nama}</Typography>
                                                <View className="flex-row items-center mt-1">
                                                    <Badge
                                                        label={item.kategori || 'Servis'}
                                                        variant="neutral"
                                                        className="mr-2"
                                                    />
                                                    <Typography weight="bold" className="text-primary">
                                                        {formatCurrency(item.harga)}
                                                    </Typography>
                                                </View>
                                            </View>
                                            {value?.id === item.id && (
                                                <Check size={20} color="#8B5CF6" />
                                            )}
                                        </Card>
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    searchQuery.length > 0 ? (
                                        <View className="items-center mt-10">
                                            <Typography className="text-textGray">Jasa tidak ditemukan</Typography>
                                        </View>
                                    ) : (
                                        <View className="items-center mt-10">
                                            <Typography className="text-textGray">Mulai mengetik untuk mencari...</Typography>
                                        </View>
                                    )
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
