import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Platform, Modal } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import {
    ChevronLeft,
    Search,
    Plus,
    Package,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    X,
    MoreVertical,
} from 'lucide-react-native';
import { masterDataService, Supplier } from '../../services/masterData';
import { useSupplierList, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '../../hooks/useMasterData';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';

export default function SupplierScreen() {
    const router = useRouter(); const [searchQuery, setSearchQuery] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'form'>('detail');
    const [refreshing, setRefreshing] = useState(false);

    // API Hooks
    const { data: listData, isLoading, refetch } = useSupplierList({
        limit: 100,
        search: searchQuery,
    });
    const createMutation = useCreateSupplier();
    const updateMutation = useUpdateSupplier();
    const deleteMutation = useDeleteSupplier();

    const supplierList = listData?.data || [];

    // Stats Calculation
    const stats = useMemo(() => {
        const total = listData?.total || 0;
        const uniqueCities = new Set(supplierList.map((s: Supplier) => s.kota).filter(Boolean)).size;
        return { total, uniqueCities };
    }, [supplierList, listData?.total]);

    // Form state
    const [formData, setFormData] = useState({
        nama: '',
        telepon: '',
        email: '',
        alamat: '',
        kota: '',
        bank: '',
        rekening: '',
    });

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type?: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['85%', '90%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/master-data');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const [sheetVisible, setSheetVisible] = useState(false);

    const handleOpenSheet = useCallback(() => {
        // Set visible for both platforms
        setSheetVisible(true);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.expand();
        }
    }, []);

    const handleCloseSheet = useCallback(() => {
        setSheetVisible(false);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        }
    }, []);

    const openDetail = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setViewMode('detail');
        handleOpenSheet();
    };

    const openAddForm = () => {
        setSelectedSupplier(null);
        setFormData({ nama: '', alamat: '', kota: '', telepon: '', email: '', bank: '', rekening: '' });
        setViewMode('form');
        handleOpenSheet();
    };

    const openEditForm = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setFormData({
            nama: supplier.nama,
            alamat: supplier.alamat || '',
            kota: supplier.kota || '',
            telepon: supplier.telepon || '',
            email: supplier.email || '',
            bank: supplier.bank || '',
            rekening: supplier.rekening || '',
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const handleSubmit = async () => {
        if (!formData.nama) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nama supplier wajib diisi', variant: 'warning' });
            return;
        }

        try {
            if (!onlineManager.isOnline()) {
                if (selectedSupplier) {
                    updateMutation.mutate({ id: selectedSupplier.id, data: formData });
                } else {
                    createMutation.mutate(formData);
                }
                setDialogConfig({ visible: true, title: 'Offline Mode', message: 'Data supplier telah disimpan di antrean offline.', variant: 'info' });
                handleCloseSheet();
                return;
            }

            if (selectedSupplier) {
                await updateMutation.mutateAsync({ id: selectedSupplier.id, data: formData });
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Supplier berhasil diupdate', variant: 'success' });
            } else {
                await createMutation.mutateAsync(formData);
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Supplier baru berhasil ditambahkan', variant: 'success' });
            }
            handleCloseSheet();
        } catch (error) {
            console.error('Failed to save supplier:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menyimpan supplier'), variant: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!selectedSupplier) return;

        setDialogConfig({
            visible: true,
            title: 'Hapus Supplier',
            message: `Yakin ingin menghapus ${selectedSupplier.nama}?`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    if (!onlineManager.isOnline()) {
                        deleteMutation.mutate(selectedSupplier.id);
                        setDialogConfig({ visible: true, title: 'Offline Mode', message: 'Supplier telah dijadwalkan untuk dihapus saat online.', variant: 'info' });
                        handleCloseSheet();
                        return;
                    }

                    await deleteMutation.mutateAsync(selectedSupplier.id);
                    setDialogConfig({ visible: true, title: 'Sukses', message: 'Supplier berhasil dihapus', variant: 'success' });
                    handleCloseSheet();
                } catch (error) {
                    console.error('Failed to delete:', error);
                    setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menghapus supplier'), variant: 'error' });
                }
            }
        });
    };

    const renderSupplierItem = ({ item }: { item: Supplier }) => (
        <Pressable onPress={() => openDetail(item)}>
            <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                <View className="w-16 h-16 bg-amber-50 rounded-[20px] items-center justify-center mr-4 border border-amber-100/50">
                    <Package size={32} color="#F59E0B" />
                </View>
                <View className="flex-1">
                    <Typography variant="body1" weight="bold" className="text-textMain text-lg mb-1">{item.nama}</Typography>

                    <Typography className="text-textGray text-xs">{item.kota || 'Tidak ada lokasi'}</Typography>

                    {item.telepon && (
                        <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                            <Phone size={12} color="#9CA3AF" />
                            <Typography variant="caption" className="text-gray-500 ml-1.5">{item.telepon}</Typography>
                        </View>
                    )}
                </View>
                <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                    <MoreVertical size={16} color="#9CA3AF" />
                </View>
            </View>
        </Pressable>
    );

    const renderSheetContent = () => {
        if (viewMode === 'detail' && selectedSupplier) {
            return (
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Typography variant="h2" weight="bold">Detail Supplier</Typography>
                        <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            <X size={20} color="#6B7280" />
                        </Pressable>
                    </View>

                    <View className="items-center mb-8">
                        <View className="w-24 h-24 bg-amber-50 rounded-[32px] items-center justify-center mb-4 border border-amber-100/50">
                            <Package size={48} color="#F59E0B" />
                        </View>
                        <Typography variant="h2" weight="bold" className="text-center mb-1">{selectedSupplier.nama}</Typography>
                        <Badge label="Supplier" variant="warning" />
                    </View>

                    <Card className="p-5 mb-6 border border-gray-100 rounded-[24px]">
                        <Typography variant="h3" weight="bold" className="mb-4 text-base">Informasi Kontak</Typography>

                        {selectedSupplier.telepon && (
                            <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <Phone size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Telepon</Typography>
                                    <Typography weight="semibold">{selectedSupplier.telepon}</Typography>
                                </View>
                            </View>
                        )}

                        {selectedSupplier.email && (
                            <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <Mail size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Email</Typography>
                                    <Typography weight="semibold">{selectedSupplier.email}</Typography>
                                </View>
                            </View>
                        )}

                        {(selectedSupplier.alamat || selectedSupplier.kota) && (
                            <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <MapPin size={20} color="#6B7280" />
                                </View>
                                <View className="flex-1">
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Alamat</Typography>
                                    <Typography weight="semibold" className="flex-wrap">
                                        {selectedSupplier.alamat ? `${selectedSupplier.alamat}, ` : ''}{selectedSupplier.kota}
                                    </Typography>
                                </View>
                            </View>
                        )}

                        {selectedSupplier.bank && selectedSupplier.rekening && (
                            <View className="flex-row items-center bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <CreditCard size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Rekening Bank</Typography>
                                    <Typography weight="semibold">{selectedSupplier.bank} - {selectedSupplier.rekening}</Typography>
                                </View>
                            </View>
                        )}
                    </Card>

                    <View className="flex-row space-x-3">
                        <Button
                            title="Edit"
                            onPress={() => openEditForm(selectedSupplier)}
                            variant="outline"
                            className="flex-1"
                        />
                        <Button
                            title="Hapus"
                            onPress={handleDelete}
                            variant="danger"
                            className="flex-1"
                        />
                    </View>
                </View>
            );
        }

        return (
            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Typography variant="h2" weight="bold">
                        {selectedSupplier ? 'Edit Supplier' : 'Tambah Supplier'}
                    </Typography>
                    <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </Pressable>
                </View>

                <View className="space-y-4">
                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Supplier *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Contoh: Toko Sparepart Jaya"
                            placeholderTextColor="#9CA3AF"
                            value={formData.nama}
                            onChangeText={(text) => setFormData({ ...formData, nama: text })}
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Telepon</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="08xxxxxxxxxx"
                            placeholderTextColor="#9CA3AF"
                            value={formData.telepon}
                            onChangeText={(text) => setFormData({ ...formData, telepon: text })}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Email (Opsional)</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="email@example.com"
                            placeholderTextColor="#9CA3AF"
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kota</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Contoh: Surabaya"
                            placeholderTextColor="#9CA3AF"
                            value={formData.kota}
                            onChangeText={(text) => setFormData({ ...formData, kota: text })}
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Alamat Lengkap</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[80px]"
                            placeholder="Masukan alamat lengkap..."
                            placeholderTextColor="#9CA3AF"
                            value={formData.alamat}
                            onChangeText={(text) => setFormData({ ...formData, alamat: text })}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Bank</Typography>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                placeholder="BCA"
                                placeholderTextColor="#9CA3AF"
                                value={formData.bank}
                                onChangeText={(text) => setFormData({ ...formData, bank: text })}
                            />
                        </View>
                        <View className="flex-[1.5]">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">No. Rekening</Typography>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                placeholder="1234567890"
                                placeholderTextColor="#9CA3AF"
                                value={formData.rekening}
                                onChangeText={(text) => setFormData({ ...formData, rekening: text })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <Button
                        title={selectedSupplier ? (updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan') : (createMutation.isPending ? 'Menambahkan...' : 'Tambah Supplier')}
                        onPress={handleSubmit}
                        disabled={updateMutation.isPending || createMutation.isPending}
                        loading={updateMutation.isPending || createMutation.isPending}
                        className="mt-4 shadow-lg shadow-primary/30"
                        size="lg"
                    />
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-surface" style={{ position: 'relative' }}>
            <StatusBar barStyle="light-content" />

            <Header
                title="Supplier"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            >
                {!sheetVisible && (
                    <View className="flex-row items-center bg-gray-50 h-11 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" className="ml-4" />
                        <TextInput
                            placeholder="Cari nama supplier..."
                            className="flex-1 ml-3 text-sm font-medium text-textMain"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                )}
            </Header>

            {/* List */}
            <FlatList
                data={supplierList}
                renderItem={renderSupplierItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                ListHeaderComponent={
                    isLoading ? (
                        <View className="mt-4">
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    isLoading ? null : (
                        <View className="mt-10">
                            <EmptyState
                                title="Tidak Ada Supplier"
                                description={searchQuery ? `Tidak ditemukan supplier dengan keyword "${searchQuery}"` : "Belum ada daftar supplier."}
                                icon={Package}
                            />
                        </View>
                    )
                }
            />

            {/* Bottom Sheet UI - Platform Specific */}
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
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {renderSheetContent()}
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
                    backgroundStyle={{ borderRadius: 32, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48 }}
                    onChange={(index) => setSheetVisible(index !== -1)}
                    onClose={() => setSheetVisible(false)}
                >
                    <BottomSheetScrollView>
                        {renderSheetContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            {/* Floating Action Button */}
            <Pressable
                onPress={openAddForm}
                style={{ position: 'absolute', right: 24, bottom: 100, elevation: 5, zIndex: 999, width: 64, height: 64 }}
                className="bg-primary rounded-[24px] items-center justify-center shadow-2xl elevation-8"
            >
                <Plus size={32} color="white" />
            </Pressable>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
