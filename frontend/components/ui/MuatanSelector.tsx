import React, { useState } from 'react';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, MapPin, X, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { jasaAngkutService } from '../../services/jasaAngkut';
import { formatDate } from '../../utils/format';

interface MuatanSelectorProps {
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
}

export const MuatanSelector = ({
    value,
    onSelect,
    label,
    placeholder
}: MuatanSelectorProps) => {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Muatan Search Query
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search_muatan_selector', searchQuery],
        queryFn: async () => {
            const res = await jasaAngkutService.getMuatanList({ search: searchQuery, limit: 15 });
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

            <Pressable onPress={handleOpen}>
                <View className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100 flex-row items-center">
                    <MapPin size={20} color={value ? '#F59E0B' : '#9CA3AF'} />

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="bold" className="text-textMain text-sm mb-0.5">{value.asal} → {value.tujuan}</Typography>
                                <View className="flex-row items-center">
                                    <Typography variant="caption" className="text-textGray/60 mr-2 text-[10px] uppercase font-bold tracking-tighter">
                                        {value.nomor_transaksi}
                                    </Typography>
                                    <Typography variant="caption" className="text-primary/60 text-[10px] font-bold tracking-tighter uppercase">
                                        • {formatDate(value.tanggal)}
                                    </Typography>
                                </View>
                            </>
                        ) : (
                            <Typography className="text-gray-400 text-sm font-medium">{placeholder || "Pilih Transaksi/Muatan"}</Typography>
                        )}
                    </View>

                    {value && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            </Pressable>

            {/* Inline Overlay for Search (Replaces Modal to maintain navigation context) */}
            {isOpen && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: 'white' }]}>
                    <View style={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, flex: 1 }}>
                        <View className="items-center mb-4">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full" />
                        </View>

                        <View className="flex-row justify-between items-center mb-6">
                            <Typography variant="h3" weight="bold" className="text-primary tracking-tight text-xl">Cari Muatan</Typography>
                            <Pressable onPress={handleClose} hitSlop={12} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                                <X size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 mb-6 shadow-sm">
                            <Search size={22} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-base text-textMain font-medium"
                                placeholder="Ketik rute atau nomor transaksi..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="characters"
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
                                    <Pressable onPress={() => handleSelect(item)}>
                                        <Card className="mb-4 p-5 border border-gray-50 shadow-sm bg-white rounded-[32px] flex-row items-center justify-between">
                                            <View className="flex-1 mr-4">
                                                <Typography weight="bold" className="text-primary text-base tracking-tighter mb-1.5">{item.asal} → {item.tujuan}</Typography>
                                                
                                                <View className="flex-row items-center mb-1">
                                                    <View className="bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 mr-2">
                                                        <Typography className="text-primary text-[9px] font-black tracking-widest">{item.nomor_transaksi}</Typography>
                                                    </View>
                                                    <Typography className="text-textGray/40 text-[9px] font-black uppercase tracking-widest">• {formatDate(item.tanggal)}</Typography>
                                                </View>
                                                
                                                <View className="flex-row items-center">
                                                    <Badge label={item.nopol} variant="info" className="px-1.5 py-0 mr-2" />
                                                    <Typography variant="caption" className="text-textGray/40 text-[9px] font-black italic">{item.supir_nama || 'Supir -'}</Typography>
                                                </View>
                                            </View>
                                            {value?.id === item.id && (
                                                <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center">
                                                   <Check size={18} color="#10B981" />
                                                </View>
                                            )}
                                        </Card>
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    searchQuery.length > 0 ? (
                                        <View className="items-center mt-12 bg-gray-50 p-10 rounded-[40px]">
                                            <Typography className="text-gray-400 font-bold uppercase tracking-widest">Tidak ditemukan</Typography>
                                        </View>
                                    ) : (
                                        <View className="items-center mt-12 bg-gray-50 p-10 rounded-[40px]">
                                            <Typography className="text-gray-400 font-bold uppercase tracking-widest">Cari detail muatan...</Typography>
                                        </View>
                                    )
                                }
                            />
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};
