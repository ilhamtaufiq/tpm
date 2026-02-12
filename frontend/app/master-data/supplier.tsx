import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Platform, Modal } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
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
    RefreshCw,
} from 'lucide-react-native';
import { masterDataService, Supplier } from '../../services/masterData';
import { useSupplierList, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '../../hooks/useMasterData';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';

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
        const total = supplierList.length;
        const uniqueCities = new Set(supplierList.map((s: Supplier) => s.kota).filter(Boolean)).size;
        return { total, uniqueCities };
    }, [supplierList]);

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
        <TouchableOpacity onPress={() => openDetail(item)}>
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
        </TouchableOpacity>
    );

    const renderSheetContent = () => {
        if (viewMode === 'detail' && selectedSupplier) {
            return (
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Typography variant="h2" weight="bold">Detail Supplier</Typography>
                        <TouchableOpacity onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
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
                    <TouchableOpacity onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
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
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-20 px-6 rounded-b-[48px] shadow-2xl z-0">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Supplier</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Database Pemasok</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Dashboard Stats (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="bg-white/20 p-2 rounded-xl mr-3">
                                <Package size={16} color="white" />
                            </View>
                            <Typography className="text-white/90 text-sm font-bold">Total Supplier</Typography>
                        </View>
                        <Typography variant="h2" weight="bold" className="text-white text-3xl tracking-tight">{stats.total}</Typography>
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Kota Area</Typography>
                            <Typography className="text-amber-300 font-bold text-lg">{stats.uniqueCities} Kota</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5 opacity-50">
                            {/* Placeholder for future stat */}
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Active</Typography>
                            <Typography className="text-white font-bold text-lg">-</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Floating Search Overlay - Hide when form is open */}
            {!sheetVisible && (
                <View className="px-6 -mt-10 z-10 mb-4">
                    <View className="bg-white p-2 rounded-[24px] shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                placeholder="Cari nama supplier..."
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

            {/* FAB */}
            <TouchableOpacity
                onPress={() => {
                    openAddForm();
                }}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20"
                activeOpacity={0.8}
            >
                <Plus size={32} color="white" />
            </TouchableOpacity>

            {/* Bottom Sheet UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal
                    visible={sheetVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseSheet}
                >
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <TouchableOpacity
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
