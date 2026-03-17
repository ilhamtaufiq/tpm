import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Car, X, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobilService } from '../../services/mobil';

interface MobilSelectorProps {
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
}

export const MobilSelector = ({
    value,
    onSelect,
    label,
    placeholder
}: MobilSelectorProps) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Mobil Search Query
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search_mobil_selector', searchQuery],
        queryFn: async () => {
            const res = await mobilService.getMobils({ search: searchQuery, limit: 20 });
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
            {label && <Typography weight="bold" className="text-textGray/40 text-[10px] uppercase tracking-widest mb-2 px-1">{label}</Typography>}

            <TouchableOpacity onPress={handleOpen}>
                <View className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100 flex-row items-center">
                    <Car size={20} color={value ? '#3B82F6' : '#9CA3AF'} />

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="bold" className="text-textMain text-sm">{value.merek} {value.model}</Typography>
                                <Typography variant="caption" className="text-textGray/60">
                                    {value.nomor_plat} • {value.warna}
                                </Typography>
                            </>
                        ) : (
                            <Typography className="text-gray-400 text-sm">{placeholder || "Pilih Mobil"}</Typography>
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
                    <View className="bg-white rounded-t-[40px] h-[85%] overflow-hidden">
                        <View style={{ padding: 24, paddingBottom: insets.bottom + 24, flex: 1 }}>
                            <View className="items-center mb-4">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full" />
                            </View>

                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h3" weight="bold" className="text-primary tracking-tight text-xl">Cari Mobil</Typography>
                                <TouchableOpacity onPress={handleClose} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                                    <X size={20} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 mb-6">
                                <Search size={20} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-textMain font-medium"
                                    placeholder="Ketik merek, model, atau nopol..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {isLoading ? (
                                <ActivityIndicator className="mt-4" color="#023C69" />
                            ) : (
                                <FlatList
                                    data={searchResults || []}
                                    keyExtractor={(item) => item.id.toString()}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => handleSelect(item)} activeOpacity={0.7}>
                                            <Card className="mb-4 p-5 border border-gray-50 shadow-sm bg-white rounded-[32px] flex-row items-center justify-between">
                                                <View className="flex-1 mr-4">
                                                    <Typography weight="bold" className="text-textMain text-base tracking-tight">{item.merek} {item.model}</Typography>
                                                    <View className="flex-row items-center mt-1.5">
                                                        <View className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 mr-2">
                                                            <Typography className="text-blue-700 text-[10px] font-bold">{item.nomor_plat}</Typography>
                                                        </View>
                                                        <Typography variant="caption" className="text-textGray/60 font-medium">
                                                            {item.tahun} • {item.warna}
                                                        </Typography>
                                                    </View>
                                                </View>
                                                {value?.id === item.id && (
                                                    <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
                                                        <Check size={18} color="#3B82F6" />
                                                    </View>
                                                )}
                                            </Card>
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        searchQuery.length > 0 ? (
                                            <View className="items-center mt-12">
                                                <Typography className="text-gray-400 font-medium">Data tidak ditemukan</Typography>
                                            </View>
                                        ) : (
                                            <View className="items-center mt-12">
                                                <Typography className="text-gray-400 font-medium">Mulai mengetik untuk mencari...</Typography>
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
