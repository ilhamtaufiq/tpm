import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Package, X, Check } from 'lucide-react-native';
import { bengkelService } from '../../services/bengkel';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../../utils/format';

interface SparePartSelectorProps {
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
}

export const SparePartSelector = ({
    value,
    onSelect,
    label,
    placeholder
}: SparePartSelectorProps) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Spare Part Search Query
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search_parts', searchQuery],
        queryFn: () => bengkelService.searchSpareParts(searchQuery),
        enabled: isOpen && searchQuery.length > 0,
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

            <TouchableOpacity onPress={handleOpen}>
                <View className="bg-gray-100 rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center">
                    <Package size={20} color={value ? '#2563EB' : '#9CA3AF'} />

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="semibold" className="text-text text-base">{value.nama || value.nama_sparepart}</Typography>
                                <Typography variant="caption" className="text-gray-500">
                                    {value.kode} • Stok: {value.stok}
                                </Typography>
                            </>
                        ) : (
                            <Typography className="text-gray-400 text-base">{placeholder || "Pilih Sparepart"}</Typography>
                        )}
                    </View>

                    {value && (
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>

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
                                <Typography variant="h3" weight="bold">Cari Sparepart</Typography>
                                <TouchableOpacity onPress={handleClose}>
                                    <X size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                                <Search size={20} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-text font-outfit"
                                    placeholder="Ketik nama sparepart..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {isLoading ? (
                                <ActivityIndicator className="mt-4" color="#2563EB" />
                            ) : (
                                <FlatList
                                    data={searchResults || []}
                                    keyExtractor={(item) => item.id.toString()}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => handleSelect(item)}>
                                            <Card className="mb-3 p-4 border border-gray-100 flex-row items-center justify-between">
                                                <View className="flex-1 mr-4">
                                                    <Typography weight="semibold" className="text-base">{item.nama}</Typography>
                                                    <View className="flex-row items-center mt-1">
                                                        <Typography variant="caption" className="text-gray-500 mr-3">
                                                            {item.kode}
                                                        </Typography>
                                                        <Badge
                                                            label={`Stok: ${item.stok}`}
                                                            variant={item.stok > 0 ? "success" : "error"}
                                                        />
                                                    </View>
                                                    <Typography weight="bold" className="text-primary mt-1">
                                                        {formatCurrency(item.harga_jual)}
                                                    </Typography>
                                                </View>
                                                {value?.id === item.id && (
                                                    <Check size={20} color="#2563EB" />
                                                )}
                                            </Card>
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        searchQuery.length > 0 ? (
                                            <View className="items-center mt-10">
                                                <Typography className="text-gray-500">Sparepart tidak ditemukan</Typography>
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
