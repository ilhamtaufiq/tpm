import React, { useState } from 'react';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Truck, X, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { jasaAngkutService } from '../../services/jasaAngkut';

interface ArmadaSelectorProps {
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
}

export const ArmadaSelector = ({
    value,
    onSelect,
    label,
    placeholder
}: ArmadaSelectorProps) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Armada Search Query
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search_armada', searchQuery],
        queryFn: async () => {
            const res = await jasaAngkutService.getArmadaList({ search: searchQuery, limit: 20 });
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

            <Pressable onPress={handleOpen}>
                <View className="bg-gray-100 rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center">
                    <Truck size={20} color={value ? '#10B981' : '#9CA3AF'} />

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="semibold" className="text-text text-base">{value.nama}</Typography>
                                <Typography variant="caption" className="text-gray-500">
                                    {value.nopol} • {value.jenis || 'Armada'}
                                </Typography>
                            </>
                        ) : (
                            <Typography className="text-gray-400 text-base">{placeholder || "Pilih Armada"}</Typography>
                        )}
                    </View>

                    {value && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color="#9CA3AF" />
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
                <View style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, flex: 1 }}>
                        <View className="items-center mb-2">
                            <View className="w-10 h-1 bg-gray-300 rounded-full" />
                        </View>

                        <View className="flex-row justify-between items-center mb-6">
                            <Typography variant="h3" weight="bold">Cari Armada</Typography>
                            <Pressable onPress={handleClose} hitSlop={12}>
                                <X size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                            <Search size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-base text-text font-outfit"
                                placeholder="Ketik nama atau nopol armada..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="characters"
                            />
                        </View>

                        {isLoading ? (
                            <ActivityIndicator className="mt-4" color="#10B981" />
                        ) : (
                            <FlatList
                                data={searchResults || []}
                                keyExtractor={(item) => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <Pressable onPress={() => handleSelect(item)}>
                                        <Card className="mb-3 p-4 border border-gray-100 flex-row items-center justify-between">
                                            <View className="flex-1 mr-4">
                                                <Typography weight="semibold" className="text-base">{item.nama}</Typography>
                                                <View className="flex-row items-center mt-1">
                                                    <Badge
                                                        label={item.nopol}
                                                        variant="success"
                                                        className="mr-2"
                                                    />
                                                    <Typography variant="caption" className="text-textGray">
                                                        {item.jenis || 'Armada'}
                                                    </Typography>
                                                </View>
                                            </View>
                                            {value?.id === item.id && (
                                                <Check size={20} color="#10B981" />
                                            )}
                                        </Card>
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    searchQuery.length > 0 ? (
                                        <View className="items-center mt-10">
                                            <Typography className="text-gray-500">Armada tidak ditemukan</Typography>
                                        </View>
                                    ) : (
                                        <View className="items-center mt-10">
                                            <Typography className="text-gray-400">Mulai mengetik untuk mencari...</Typography>
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
