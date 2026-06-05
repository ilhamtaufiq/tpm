import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Pressable, TextInput, FlatList, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Typography } from './Typography';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';
import { Search, Plus, User, Building2, Check, X, Truck, UserPlus, CheckCircle2 } from 'lucide-react-native';
import { masterDataService } from '../../services/masterData';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { CustomerFormModal } from './CustomerFormModal';

interface MasterDataSelectorProps {
    type: 'customer' | 'supplier';
    value?: any; // Selected object or null
    onSelect: (item: any | null) => void;
    label?: string;
    placeholder?: string;
    allowGuest?: boolean;
    onGuestNameChange?: (name: string) => void;
    onAddNew?: (item: any) => void;
    inlineMode?: boolean;
    inlineLimit?: number;
    hideTrigger?: boolean;
}

export const MasterDataSelector = ({
    type,
    value,
    onSelect,
    label,
    placeholder,
    allowGuest = false,
    onGuestNameChange,
    onAddNew,
    inlineMode = false,
    inlineLimit = 5,
    hideTrigger = false
}: MasterDataSelectorProps) => {
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuestName, setSelectedGuestName] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [visibleLimit, setVisibleLimit] = useState(inlineLimit);

    useEffect(() => {
        setVisibleLimit(inlineLimit);
    }, [inlineLimit, searchQuery]);

    // Dynamic Query based on type
    const { data: searchResults, isLoading } = useQuery({
        queryKey: ['search', type, searchQuery, inlineMode, inlineLimit, visibleLimit],
        queryFn: async () => {
            if (type === 'customer') {
                return masterDataService.searchCustomers(searchQuery, inlineMode ? visibleLimit : 10);
            } else {
                return masterDataService.searchSuppliers(searchQuery);
            }
        },
        enabled: inlineMode ? true : isOpen, // Always load inline preview when requested
    });

    const handleOpen = () => {
        if (inlineMode) return;
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSelect = (item: any) => {
        setSelectedGuestName('');
        onSelect(item);
        handleClose();
    };

    const handleGuestSelect = () => {
        const guestName = searchQuery.trim();
        if (onGuestNameChange && guestName) {
            setSelectedGuestName(guestName);
            onGuestNameChange(guestName); // Use the search query as the guest name
            onSelect(null); // Clear ID
            handleClose();
        }
    };

    const handleAddNew = (item: any) => {
        setSelectedGuestName('');
        onSelect(item);
        if (onAddNew) onAddNew(item);
        setIsAddModalOpen(false);
        handleClose();
    };

    return (
        <View className="mb-4 w-full">
            {label && <Typography weight="medium" className="text-textGray text-sm mb-1">{label}</Typography>}

            {!hideTrigger && <Pressable onPress={handleOpen} disabled={inlineMode}>
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

                    {value && !inlineMode && (
                        <Pressable onPress={(e) => { e.stopPropagation(); onSelect(null); }}>
                            <X size={18} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            </Pressable>}

            {inlineMode && (
                <View className={hideTrigger ? '' : 'mt-3'}>
                    <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-3">
                        <Search size={20} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 text-base text-text font-outfit"
                            placeholder={`Cari nama atau nopol ${type === 'customer' ? 'customer' : 'supplier'}...`}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')}>
                                <X size={18} color="#9CA3AF" />
                            </Pressable>
                        )}
                    </View>

                    {allowGuest && onGuestNameChange && searchQuery.length > 0 && (
                        <Pressable
                            onPress={handleGuestSelect}
                            className={`mb-3 p-3 rounded-2xl border border-dashed flex-row items-center justify-between ${selectedGuestName === searchQuery.trim() && !value ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-300'}`}
                        >
                            <View className="flex-row items-center flex-1">
                                <User size={18} color={selectedGuestName === searchQuery.trim() && !value ? '#10B981' : '#4B5563'} />
                                <View className="ml-2 flex-1">
                                    <Typography weight="semibold" className="text-xs">Guest "{searchQuery}"</Typography>
                                </View>
                            </View>
                            {selectedGuestName === searchQuery.trim() && !value && (
                                <CheckCircle2 size={20} color="#10B981" />
                            )}
                        </Pressable>
                    )}

                    {type === 'customer' && onAddNew && (
                        <Pressable onPress={() => setIsAddModalOpen(true)} className="mb-3">
                            <Card className="p-3 bg-blue-50 border border-dashed border-blue-300 flex-row items-center">
                                <UserPlus size={18} color="#2563EB" />
                                <View className="ml-2">
                                    <Typography weight="semibold" className="text-xs text-primary">Daftarkan Baru</Typography>
                                </View>
                            </Card>
                        </Pressable>
                    )}

                    {isLoading ? (
                        <ActivityIndicator className="mt-4" color="#023C69" />
                    ) : (
                        <View>
                            {(searchResults || []).map((item: any) => (
                                <Pressable
                                    key={item.id}
                                    onPress={() => handleSelect(item)}
                                    className={`mb-3 p-4 rounded-2xl border flex-row items-center justify-between shadow-sm ${value?.id === item.id ? 'bg-emerald-50 border-emerald-200' : 'bg-surface border-gray-100'}`}
                                >
                                        <View className="flex-1 mr-2">
                                            <Typography weight="semibold">{item.nama}</Typography>
                                            <Typography variant="caption" className="text-gray-500">
                                                {item.kota ? `${item.kota} â€¢ ` : ''}{item.telepon || '-'}
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
                                        {value?.id === item.id ? (
                                            <CheckCircle2 size={22} color="#10B981" />
                                        ) : (
                                            <Badge
                                                label={type === 'customer' ? item.tipe : 'Vendor'}
                                                variant="neutral"
                                            />
                                        )}
                                </Pressable>
                            ))}
                            {(!searchResults || searchResults.length === 0) && searchQuery.length > 0 && (
                                <Typography className="text-center text-gray-500 mt-4">Data tidak ditemukan</Typography>
                            )}
                            {inlineMode && (searchResults || []).length >= visibleLimit && (
                                <Pressable
                                    onPress={() => setVisibleLimit(prev => prev + inlineLimit)}
                                    className="mt-1 mb-3 py-3 rounded-2xl bg-gray-100 border border-gray-200 items-center"
                                >
                                    <Typography className="text-primary text-xs font-bold">Muat lagi</Typography>
                                </Pressable>
                            )}
                        </View>
                    )}
                </View>
            )}

            {/* Search Overlay using Modal (Fixes clipping in ScrollViews on Android) */}
            {!inlineMode && (
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
                            <Typography variant="h3" weight="bold">Cari {type === 'customer' ? 'Customer' : 'Supplier'}</Typography>
                            <Pressable onPress={handleClose} hitSlop={12}>
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

                        <View className="flex-row space-x-2 mb-4">
                            {allowGuest && searchQuery.length > 0 && (
                                <Pressable
                                    onPress={handleGuestSelect}
                                    className={`flex-1 p-3 rounded-2xl border border-dashed flex-row items-center justify-between ${selectedGuestName === searchQuery.trim() && !value ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-300'}`}
                                >
                                    <View className="flex-row items-center flex-1">
                                        <User size={18} color={selectedGuestName === searchQuery.trim() && !value ? '#10B981' : '#4B5563'} />
                                        <View className="ml-2 flex-1">
                                            <Typography weight="semibold" className="text-xs">Guest "{searchQuery}"</Typography>
                                        </View>
                                    </View>
                                    {selectedGuestName === searchQuery.trim() && !value && (
                                        <CheckCircle2 size={20} color="#10B981" />
                                    )}
                                </Pressable>
                            )}

                            {type === 'customer' && (
                                <Pressable onPress={() => setIsAddModalOpen(true)} className="flex-1">
                                    <Card className="p-3 bg-blue-50 border border-dashed border-blue-300 flex-row items-center">
                                        <UserPlus size={18} color="#2563EB" />
                                        <View className="ml-2">
                                            <Typography weight="semibold" className="text-xs text-primary">Daftarkan Baru</Typography>
                                        </View>
                                    </Card>
                                </Pressable>
                            )}
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
            </Modal>
            )}

            {/* Quick Add Customer Modal */}
            {type === 'customer' && (
                <CustomerFormModal
                    visible={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    onSuccess={handleAddNew}
                    initialName={searchQuery}
                />
            )}
        </View>
    );
};

