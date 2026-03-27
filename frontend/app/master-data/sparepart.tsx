import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, FlatList, ActivityIndicator, Image, Platform, Modal, TextInput } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    Plus,
    Search,
    Edit2,
    Trash2,
    Package,
    Settings,
    AlertTriangle,
    RefreshCw,
    X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import {
    useSparePartsList,
    useCreateSparePart,
    useUpdateSparePart,
    useDeleteSparePart,
    useDebounce
} from '../../hooks';
import { formatNumber, parseNumber } from '../../utils/format';
import { onlineManager } from '@tanstack/react-query';
import { Alert } from 'react-native';

interface SparePartForm {
    id?: number;
    kode?: string;
    nama: string;
    harga_beli: string;
    harga_jual: string;
    stok: string;
    stok_minimum: string;
    kategori: string;
    satuan: string;
    lokasi_rak: string;
    catatan: string;
}

const INITIAL_FORM: SparePartForm = {
    nama: '',
    harga_beli: '',
    harga_jual: '',
    stok: '',
    stok_minimum: '5',
    kategori: 'Umum',
    satuan: 'pcs',
    lokasi_rak: '',
    catatan: '',
};

export default function SparePartMasterScreen() {
    const router = useRouter();
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Queries
    const {
        data: sparePartsData,
        isLoading,
        refetch,
        isRefetching
    } = useSparePartsList({
        search: debouncedSearch,
        limit: 100 // Load more to start
    });

    const sparePartsList = sparePartsData?.data || [];

    // Stats Calculation
    const stats = useMemo(() => {
        const total = sparePartsList.length;
        const lowStock = sparePartsList.filter((item: any) => item.stok <= item.stok_minimum).length;
        return { total, lowStock };
    }, [sparePartsList]);

    // Mutations
    const createMutation = useCreateSparePart();
    const updateMutation = useUpdateSparePart();
    const deleteMutation = useDeleteSparePart();

    // Form State
    const [form, setForm] = useState<SparePartForm>(INITIAL_FORM);
    const [isEditing, setIsEditing] = useState(false);

    const [sheetVisible, setSheetVisible] = useState(false);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['85%', '95%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/master-data');
        }
    };

    const handleOpenSheet = (item?: any) => {
        if (item) {
            setIsEditing(true);
            setForm({
                id: item.id,
                kode: item.kode,
                nama: item.nama,
                harga_beli: formatNumber(item.harga_beli.toString()),
                harga_jual: formatNumber(item.harga_jual.toString()),
                stok: item.stok.toString(),
                stok_minimum: item.stok_minimum.toString(),
                kategori: item.kategori || 'Umum',
                satuan: item.satuan || 'pcs',
                lokasi_rak: item.lokasi_rak || '',
                catatan: item.catatan || '',
            });
        } else {
            setIsEditing(false);
            setForm(INITIAL_FORM);
        }

        // Set visible for both platforms
        setSheetVisible(true);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = () => {
        setSheetVisible(false);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        }

        setForm(INITIAL_FORM);
        setIsEditing(false);
    };

    const handleSubmit = async () => {
        try {
            const payload = {
                ...form,
                harga_beli: parseNumber(form.harga_beli),
                harga_jual: parseNumber(form.harga_jual),
                stok: Number(form.stok),
                stok_minimum: Number(form.stok_minimum),
            };

            if (!onlineManager.isOnline()) {
                if (isEditing && form.id) {
                    updateMutation.mutate({ id: form.id, data: payload });
                } else {
                    createMutation.mutate(payload);
                }
                Alert.alert('Offline Mode', 'Data barang telah disimpan di antrean offline.');
                handleCloseSheet();
                return;
            }

            if (isEditing && form.id) {
                await updateMutation.mutateAsync({ id: form.id, data: payload });
            } else {
                await createMutation.mutateAsync(payload);
            }
            handleCloseSheet();
        } catch (error) {
            console.error('Failed to save sparepart:', error);
            if (Platform.OS === 'web') {
                alert('Gagal menyimpan data barang. Periksa kembali input Anda.');
            } else {
                alert('Gagal menyimpan data barang. Periksa kembali input Anda.');
            }
        }
    };

    const handleDelete = (id: number) => {
        if (!onlineManager.isOnline()) {
            deleteMutation.mutate(id);
            Alert.alert('Offline Mode', 'Barang telah dijadwalkan untuk dihapus saat online.');
            return;
        }
        deleteMutation.mutate(id);
    };

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
            />
        ),
        []
    );

    const renderItem = ({ item }: { item: any }) => {
        const isLowStock = item.stok <= item.stok_minimum;
        return (
            <Pressable onPress={() => handleOpenSheet(item)}>
                <View className={`p-5 rounded-[32px] mb-4 shadow-sm flex-row items-center ${isLowStock ? 'bg-red-50/50 border border-red-200' : 'bg-white border border-gray-50'}`}>
                    <View className={`w-16 h-16 rounded-[24px] items-center justify-center mr-4 ${isLowStock ? 'bg-red-100' : 'bg-emerald-50 border border-emerald-100/50'}`}>
                        <Package size={32} color={isLowStock ? '#EF4444' : '#10B981'} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                            <Typography variant="body1" weight="bold" className="text-textMain text-lg flex-1 mr-2" numberOfLines={1}>{item.nama}</Typography>
                            {isLowStock && (
                                <View className="bg-red-100 px-2 py-1 rounded-lg flex-row items-center">
                                    <AlertTriangle size={10} color="#EF4444" className="mr-1" />
                                    <Typography className="text-red-600 text-[10px] font-bold uppercase">Stok Rendah</Typography>
                                </View>
                            )}
                        </View>

                        <View className="flex-row items-center mb-1">
                            <Typography className="text-primary font-bold text-base mr-2">
                                Rp {Number(item.harga_jual).toLocaleString('id-ID')}
                            </Typography>
                            <Typography className="text-gray-400 text-xs">/ {item.satuan}</Typography>
                        </View>

                        <View className="flex-row items-center pt-2 mt-2 border-t border-gray-100/50 border-dashed">
                            <Typography className="text-textGray text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-md mr-2">
                                Stok: {item.stok}
                            </Typography>
                            <Typography className="text-textGray/60 text-xs">
                                Rak: {item.lokasi_rak || '-'}
                            </Typography>
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };

    const renderFormContent = () => (
        <View className="p-6 pb-12">
            <View className="flex-row justify-between items-center mb-6">
                <Typography variant="h2" weight="bold">
                    {isEditing ? 'Edit Sparepart' : 'Tambah Sparepart'}
                </Typography>
                <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                    <X size={20} color="#6B7280" />
                </Pressable>
            </View>

            <View className="space-y-4">
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Barang *</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                        placeholder="Contoh: Oli Yamalube"
                        placeholderTextColor="#9CA3AF"
                        value={form.nama}
                        onChangeText={(t) => setForm({ ...form, nama: t })}
                    />
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Beli</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.harga_beli}
                            onChangeText={(t) => setForm({ ...form, harga_beli: formatNumber(t) })}
                        />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Jual</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.harga_jual}
                            onChangeText={(t) => setForm({ ...form, harga_jual: formatNumber(t) })}
                        />
                    </View>
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Stok Awal</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.stok}
                            onChangeText={(t) => setForm({ ...form, stok: t })}
                        />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Min. Stok</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="5"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.stok_minimum}
                            onChangeText={(t) => setForm({ ...form, stok_minimum: t })}
                        />
                    </View>
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Satuan</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="pcs"
                            placeholderTextColor="#9CA3AF"
                            value={form.satuan}
                            onChangeText={(t) => setForm({ ...form, satuan: t })}
                        />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kategori</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Umum"
                            placeholderTextColor="#9CA3AF"
                            value={form.kategori}
                            onChangeText={(t) => setForm({ ...form, kategori: t })}
                        />
                    </View>
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Lokasi Rak (Opsional)</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                        placeholder="Contoh: Rak A-1"
                        placeholderTextColor="#9CA3AF"
                        value={form.lokasi_rak}
                        onChangeText={(t) => setForm({ ...form, lokasi_rak: t })}
                    />
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Catatan (Opsional)</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[80px]"
                        placeholder="Keterangan tambahan..."
                        placeholderTextColor="#9CA3AF"
                        value={form.catatan}
                        onChangeText={(t) => setForm({ ...form, catatan: t })}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                <View className="flex-col space-y-3 mt-4">
                    <Button
                        title={isEditing ? "Simpan Perubahan" : "Simpan Barang"}
                        onPress={handleSubmit}
                        loading={createMutation.isPending || updateMutation.isPending}
                        className="shadow-lg shadow-primary/30"
                        size="lg"
                    />
                    {isEditing && (
                        <Button
                            title="Hapus Barang"
                            variant="danger"
                            onPress={() => {
                                if (form.id) handleDelete(form.id);
                                handleCloseSheet();
                            }}
                            className="mt-2"
                        />
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-20 px-6 rounded-b-[48px] shadow-2xl z-0">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Sparepart</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Stok & Harga Barang</Typography>
                        </View>
                    </View>
                    <Pressable
                        onPress={() => refetch()}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {isRefetching ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                    </Pressable>
                </View>

                {/* Dashboard Stats (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="bg-white/20 p-2 rounded-xl mr-3">
                                <Package size={16} color="white" />
                            </View>
                            <Typography className="text-white/90 text-sm font-bold">Total Barang</Typography>
                        </View>
                        <Typography variant="h2" weight="bold" className="text-white text-3xl tracking-tight">{stats.total}</Typography>
                    </View>

                    {stats.lowStock > 0 ? (
                        <View className="bg-red-500/20 p-3 rounded-2xl border border-red-500/30 flex-row items-center">
                            <View className="bg-red-500/20 p-1.5 rounded-lg mr-3">
                                <AlertTriangle size={14} color="#FCA5A5" />
                            </View>
                            <View>
                                <Typography className="text-red-200 text-[10px] font-bold uppercase tracking-widest">Perhatian</Typography>
                                <Typography className="text-white font-bold">{stats.lowStock} Barang Stok Menipis</Typography>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/30 flex-row items-center">
                            <View className="bg-emerald-500/20 p-1.5 rounded-lg mr-3">
                                <Package size={14} color="#6EE7B7" />
                            </View>
                            <View>
                                <Typography className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest">Status Aman</Typography>
                                <Typography className="text-white font-bold">Stok Semua Barang Aman</Typography>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* Floating Search Overlay - Hide when form is open */}
            {!sheetVisible && (
                <View className="px-6 -mt-10 z-10 mb-4">
                    <View className="bg-white p-2 rounded-[24px] shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                placeholder="Cari sparepart..."
                                className="flex-1 ml-3 text-sm font-medium text-textMain"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>
                </View>
            )}

            {/* List */}
            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#16A34A" />
                </View>
            ) : (
                <FlatList
                    data={sparePartsList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#023C69" />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20 mt-10">
                            <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-4">
                                <Package size={32} color="#D1D5DB" />
                            </View>
                            <Typography className="text-gray-400 text-center font-medium">
                                Belum ada data sparepart.{'\n'}Tap + untuk menambah.
                            </Typography>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <Pressable
                onPress={() => handleOpenSheet()}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20"
                activeOpacity={0.8}
            >
                <Plus size={32} color="white" />
            </Pressable>

            {/* Form UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal
                    visible={sheetVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseSheet}
                >
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <Pressable
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            onPress={handleCloseSheet}
                            activeOpacity={1}
                        />
                        <View
                            className="bg-white rounded-t-[32px] shadow-2xl h-[90%]"
                            style={{
                                width: '100%',
                                maxWidth: 640,
                                alignSelf: 'center',
                            }}
                        >
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                            <ScrollView className="flex-1">
                                {renderFormContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ borderRadius: 32, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48 }}
                    onChange={(index) => setSheetVisible(index !== -1)}
                    onClose={() => setSheetVisible(false)}
                >
                    <BottomSheetScrollView>
                        {renderFormContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}
        </View>
    );
}
