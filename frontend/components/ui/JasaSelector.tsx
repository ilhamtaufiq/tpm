import React, { useState } from 'react';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Wrench, X, Check } from 'lucide-react-native';
import { jasaServisService } from '../../services/jasaServis';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, parseNumber } from '../../utils/format';

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
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Jasa Search Query
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search_jasa', searchQuery],
        queryFn: async () => {
            const res = await jasaServisService.getJasaList({ search: searchQuery, limit: 20 });
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
                <View className="bg-gray-100 rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center">
                    <Wrench size={20} color={value ? '#8B5CF6' : '#9CA3AF'} />

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="semibold" className="text-text text-base">{value.nama}</Typography>
                                <Typography variant="caption" className="text-gray-500">
                                    {value.kategori || 'Servis'} • {formatCurrency(value.harga)}
                                </Typography>
                            </>
                        ) : (
                            <Typography className="text-gray-400 text-base">{placeholder || "Pilih Jasa Servis"}</Typography>
                        )}
                    </View>

                    {value && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            </Pressable>

            {/* Modal for Search */}
            <Modal
                visible={isOpen}
                transparent={true}
                animationType="slide"
                onRequestClose={handleClose}
                statusBarTranslucent
            >
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
                    <View className="bg-white rounded-t-[32px] h-[85%] overflow-hidden">
                        <View style={{ padding: 24, paddingBottom: insets.bottom + 24, flex: 1 }}>
                            <View className="items-center mb-2">
                                <View className="w-10 h-1 bg-gray-300 rounded-full" />
                            </View>

                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h3" weight="bold">Cari Jasa Servis</Typography>
                                <Pressable onPress={handleClose}>
                                    <X size={24} color="#6B7280" />
                                </Pressable>
                            </View>

                            <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                                <Search size={20} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-text font-outfit"
                                    placeholder="Ketik nama jasa..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                    placeholderTextColor="#9CA3AF"
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
                                            <Card className="mb-3 p-4 border border-gray-100 flex-row items-center justify-between">
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
                                                <Typography className="text-gray-500">Jasa tidak ditemukan</Typography>
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
                </View>
            </Modal>
        </View>
    );
};
