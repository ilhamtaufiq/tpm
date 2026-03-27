import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Typography } from './Typography';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Plus, User, Building2, Check, X, Truck } from 'lucide-react-native';
import { masterDataService } from '../../services/masterData';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';

interface MasterDataSelectorProps {
    type: 'customer' | 'supplier';
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
    allowGuest?: boolean;
    onGuestNameChange?: (name: string) => void;
}

export const MasterDataSelector = ({
    type,
    value,
    onSelect,
    label,
    placeholder,
    allowGuest = false,
    onGuestNameChange
}: MasterDataSelectorProps) => {
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Dynamic Query based on type
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search', type, searchQuery],
        queryFn: async () => {
            if (type === 'customer') {
                return masterDataService.searchCustomers(searchQuery);
            } else {
                return masterDataService.searchSuppliers(searchQuery);
            }
        },
        enabled: isOpen, // Only search when modal is open
    });

    const handleOpen = () => {
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSelect = (item: any) => {
        onSelect(item);
        handleClose();
    };

    const handleGuestSelect = () => {
        if (onGuestNameChange) {
            onGuestNameChange(searchQuery); // Use the search query as the guest name
            onSelect(null); // Clear ID
            handleClose();
        }
    };

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    return (
        <View className="mb-4 w-full">
            {label && <Typography weight="medium" className="text-textGray text-sm mb-1">{label}</Typography>}

            <Pressable onPress={handleOpen}>
                <View className="bg-gray-100 rounded-xl px-4 py-3 border-2 border-transparent flex-row items-center">
                    {type === 'customer' ? (
                        <User size={20} color={value ? '#2563EB' : '#9CA3AF'} />
                    ) : (
                        <Truck size={20} color={value ? '#F59E0B' : '#9CA3AF'} />
                    )}

                    <View className="flex-1 ml-3">
                        {value ? (
                            <>
                                <Typography weight="semibold" className="text-text text-base">{value.nama}</Typography>
                                <Typography variant="caption" className="text-gray-500">
                                    {value.kode || (value.tipe === 'Perusahaan' ? 'Perusahaan' : 'Perorangan')}
                                </Typography>
                            </>
                        ) : (
                            allowGuest && onGuestNameChange && searchQuery && !value ? (
                                <Typography className="text-gray-900 text-base">{searchQuery} (Guest)</Typography>
                            ) : (
                                <Typography className="text-gray-400 text-base">{placeholder || `Pilih ${type === 'customer' ? 'Customer' : 'Supplier'}...`}</Typography>
                            )
                        )}
                    </View>

                    {value && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            </Pressable>

            {/* Modal Replacement for BottomSheet */}
            <Modal
                visible={isOpen}
                transparent={true}
                animationType="slide"
                onRequestClose={handleClose}
                statusBarTranslucent
            >
                <View className="flex-1 justify-end bg-black/50">
                    <Pressable style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
                    <View className="bg-white rounded-t-[32px] h-[90%] overflow-hidden">
                        <View style={{ padding: 24, paddingBottom: insets.bottom + 24, flex: 1 }}>
                            <View className="items-center mb-2">
                                <View className="w-10 h-1 bg-gray-300 rounded-full" />
                            </View>

                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h3" weight="bold">Cari {type === 'customer' ? 'Customer' : 'Supplier'}</Typography>
                                <Pressable onPress={handleClose}>
                                    <X size={24} color="#6B7280" />
                                </Pressable>
                            </View>

                            <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                                <Search size={20} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-text font-outfit"
                                    placeholder={`Ketik nama atau nopol ${type === 'customer' ? 'customer' : 'supplier'}...`}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {allowGuest && searchQuery.length > 0 && (
                                <Pressable onPress={handleGuestSelect} className="mb-4">
                                    <Card className="p-4 bg-gray-50 border border-dashed border-gray-300 flex-row items-center">
                                        <Plus size={20} color="#4B5563" />
                                        <View className="ml-3">
                                            <Typography weight="semibold">Gunakan "{searchQuery}"</Typography>
                                            <Typography variant="caption" className="text-gray-500">sebagai Guest / Non-Member</Typography>
                                        </View>
                                    </Card>
                                </Pressable>
                            )}

                            {isLoading ? (
                                <ActivityIndicator className="mt-4" color="#023C69" />
                            ) : (
                                <FlatList
                                    data={searchResults || []}
                                    keyExtractor={(item) => item.id.toString()}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => (
                                        <Pressable onPress={() => handleSelect(item)}>
                                            <Card className="mb-3 p-4 border border-gray-100 flex-row items-center justify-between">
                                                <View className="flex-1 mr-2">
                                                    <Typography weight="semibold">{item.nama}</Typography>
                                                    <Typography variant="caption" className="text-gray-500">
                                                        {item.kota ? `${item.kota} • ` : ''}{item.telepon || '-'}
                                                    </Typography>
                                                    {type === 'customer' && item.vehicles && item.vehicles.length > 0 && (
                                                        <View className="flex-row flex-wrap mt-1">
                                                            {item.vehicles.map((v: any, idx: number) => (
                                                                <View key={v.id || idx} className="bg-blue-50 px-1.5 py-0.5 rounded mr-1 mb-1 border border-blue-100">
                                                                    <Typography className="text-blue-700 text-[10px] font-bold">
                                                                        {v.plat_nomor}
                                                                    </Typography>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                                <Badge
                                                    label={type === 'customer' ? item.tipe : 'Vendor'}
                                                    variant="neutral"
                                                />
                                            </Card>
                                        </Pressable>
                                    )}
                                    ListEmptyComponent={
                                        searchQuery.length > 1 ? (
                                            <Typography className="text-center text-gray-500 mt-4">Data tidak ditemukan</Typography>
                                        ) : null
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
