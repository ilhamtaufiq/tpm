import React, { useState, useCallback, useRef, useMemo } from 'react';
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
    X,
    MoreVertical,
    Box,
    MapPin,
    Calendar,
    DollarSign,
    Trash2,
    Clock,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Asset } from '../../services/masterData';
import { useAssetList, useCreateAsset, useUpdateAsset, useDeleteAsset, useAssetStats } from '../../hooks/useMasterData';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { formatCurrency } from '../../utils/format';

const KATEGORI_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'KENDARAAN', label: 'Kendaraan' },
    { key: 'PERALATAN', label: 'Peralatan' },
    { key: 'ELECTRONIC', label: 'Electronic' },
    { key: 'BANGUNAN', label: 'Bangunan' },
    { key: 'TANAH', label: 'Tanah' },
    { key: 'LAINNYA', label: 'Lainnya' },
];

export default function AssetScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'form'>('detail');
    const [refreshing, setRefreshing] = useState(false);

    // API Hooks
    const params = useMemo(() => ({
        page: 1,
        size: 500, // Large enough to show all assets for now
        kategori: selectedFilter === 'all' ? undefined : selectedFilter,
        search: searchQuery.trim() || undefined,
    }), [selectedFilter, searchQuery]);

    const { data: listData, isLoading, refetch } = useAssetList(params);

    const { data: statsData, refetch: refetchStats } = useAssetStats();

    const createMutation = useCreateAsset();
    const updateMutation = useUpdateAsset();
    const deleteMutation = useDeleteAsset();

    const assetList = listData?.data || [];
    const totalAssets = listData?.total || 0;
    const totalValue = listData?.total_value || 0;

    // Form state
    const [formData, setFormData] = useState({
        nama: '',
        kategori: 'PERALATAN',
        tanggal_beli: new Date().toISOString().split('T')[0],
        harga_beli: '',
        nilai_residu: '0',
        umur_ekonomis: '4',
        status: 'AKTIF',
        lokasi: '',
        catatan: '',
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
        await Promise.all([refetch(), refetchStats()]);
        setRefreshing(false);
    }, [refetch, refetchStats]);

    const [sheetVisible, setSheetVisible] = useState(false);

    const handleOpenSheet = useCallback(() => {
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

    const openDetail = (asset: Asset) => {
        setSelectedAsset(asset);
        setViewMode('detail');
        handleOpenSheet();
    };

    const openAddForm = () => {
        setSelectedAsset(null);
        setFormData({
            nama: '',
            kategori: 'PERALATAN',
            tanggal_beli: new Date().toISOString().split('T')[0],
            harga_beli: '',
            nilai_residu: '0',
            umur_ekonomis: '4',
            status: 'AKTIF',
            lokasi: '',
            catatan: '',
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const openEditForm = (asset: Asset) => {
        setSelectedAsset(asset);
        setFormData({
            nama: asset.nama,
            kategori: asset.kategori,
            tanggal_beli: asset.tanggal_beli,
            harga_beli: asset.harga_beli.toString(),
            nilai_residu: asset.nilai_residu.toString(),
            umur_ekonomis: asset.umur_ekonomis.toString(),
            status: asset.status,
            lokasi: asset.lokasi || '',
            catatan: asset.catatan || '',
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const handleCurrencyChange = (text: string, field: 'harga_beli' | 'nilai_residu') => {
        // Remove non-numeric characters except for the first period if decimal is needed, 
        // but project seems to use whole numbers for prices.
        const numericValue = text.replace(/[^0-9]/g, '');
        setFormData({ ...formData, [field]: numericValue });
    };

    const getFormattedValue = (value: string) => {
        if (!value) return '';
        const number = parseInt(value, 10);
        if (isNaN(number)) return '';
        return number.toLocaleString('id-ID');
    };

    const handleSubmit = async () => {
        if (!formData.nama || !formData.harga_beli || !formData.tanggal_beli) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nama, Harga Beli, dan Tanggal Beli wajib diisi', variant: 'warning' });
            return;
        }

        const data = {
            ...formData,
            harga_beli: parseFloat(formData.harga_beli),
            nilai_residu: parseFloat(formData.nilai_residu),
            umur_ekonomis: parseInt(formData.umur_ekonomis),
        };

        try {
            if (selectedAsset) {
                await updateMutation.mutateAsync({ id: selectedAsset.id, data });
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Aset berhasil diupdate', variant: 'success' });
            } else {
                await createMutation.mutateAsync(data);
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Aset baru berhasil ditambahkan', variant: 'success' });
            }
            handleCloseSheet();
            onRefresh();
        } catch (error) {
            console.error('Failed to save asset:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menyimpan aset'), variant: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!selectedAsset) return;

        setDialogConfig({
            visible: true,
            title: 'Hapus Aset',
            message: `Yakin ingin menghapus ${selectedAsset.nama}?`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync(selectedAsset.id);
                    setDialogConfig({ visible: true, title: 'Sukses', message: 'Aset berhasil dihapus', variant: 'success' });
                    handleCloseSheet();
                    onRefresh();
                } catch (error) {
                    console.error('Failed to delete:', error);
                    setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menghapus aset'), variant: 'error' });
                }
            }
        });
    };

    const renderAssetItem = ({ item }: { item: Asset }) => (
        <Pressable onPress={() => openDetail(item)}>
            <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                <View className="w-16 h-16 rounded-[20px] bg-rose-50 border border-rose-100/50 items-center justify-center mr-4">
                    <Box size={32} color="#E11D48" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                        <Typography variant="body1" weight="bold" className="text-textMain text-lg" numberOfLines={1}>{item.nama}</Typography>
                        <View className="bg-rose-50 px-2 py-1 rounded-lg">
                            <Typography className="text-rose-600 text-[10px] font-bold uppercase">{item.kode}</Typography>
                        </View>
                    </View>

                    <Typography className="text-textGray text-xs mb-2">{item.kategori} • {item.lokasi || 'Tanpa Lokasi'}</Typography>

                    <Typography weight="bold" className="text-primary text-sm">{formatCurrency(item.harga_beli)}</Typography>
                </View>
                <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                    <MoreVertical size={16} color="#9CA3AF" />
                </View>
            </View>
        </Pressable>
    );

    const renderSheetContent = () => {
        if (viewMode === 'detail' && selectedAsset) {
            return (
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Typography variant="h2" weight="bold">Detail Aset</Typography>
                        <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            <X size={20} color="#6B7280" />
                        </Pressable>
                    </View>

                    <View className="items-center mb-8">
                        <View className="w-24 h-24 rounded-[32px] bg-rose-50 items-center justify-center mb-4">
                            <Box size={48} color="#E11D48" />
                        </View>
                        <Typography variant="h2" weight="bold" className="text-center mb-1">{selectedAsset.nama}</Typography>
                        <Typography className="text-gray-400 font-bold mb-2">{selectedAsset.kode}</Typography>
                        <Badge label={selectedAsset.status} variant={selectedAsset.status === 'AKTIF' ? 'success' : 'warning'} />
                    </View>

                    <Card className="p-5 mb-6 border border-gray-100 rounded-[24px]">
                        <Typography variant="h3" weight="bold" className="mb-4 text-base">Informasi Aset</Typography>

                        <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-2xl">
                            <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                <DollarSign size={20} color="#E11D48" />
                            </View>
                            <View>
                                <Typography className="text-xs text-gray-400 font-bold uppercase">Harga Perolehan</Typography>
                                <Typography weight="bold" className="text-lg text-primary">{formatCurrency(selectedAsset.harga_beli)}</Typography>
                            </View>
                        </View>

                        <View className="flex-row space-x-3 mb-4">
                            <View className="flex-1 flex-row items-center bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <Calendar size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Tanggal Beli</Typography>
                                    <Typography weight="semibold">{selectedAsset.tanggal_beli}</Typography>
                                </View>
                            </View>
                            <View className="flex-1 flex-row items-center bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <Clock size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Umur</Typography>
                                    <Typography weight="semibold">{selectedAsset.umur_ekonomis} Tahun</Typography>
                                </View>
                            </View>
                        </View>

                        <View className="flex-row items-center bg-gray-50 p-3 rounded-2xl">
                            <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                <MapPin size={20} color="#6B7280" />
                            </View>
                            <View className="flex-1">
                                <Typography className="text-xs text-gray-400 font-bold uppercase">Lokasi / Kategori</Typography>
                                <Typography weight="semibold">{selectedAsset.lokasi || '-'} • {selectedAsset.kategori}</Typography>
                            </View>
                        </View>
                    </Card>

                    {selectedAsset.catatan && (
                        <Card className="p-5 mb-6 border border-gray-100 rounded-[24px]">
                            <Typography variant="h3" weight="bold" className="mb-2 text-base">Catatan</Typography>
                            <Typography className="text-textGray leading-relaxed">{selectedAsset.catatan}</Typography>
                        </Card>
                    )}

                    <View className="flex-row space-x-3">
                        <Button title="Edit" onPress={() => openEditForm(selectedAsset)} variant="outline" className="flex-1" />
                        <Button title="Hapus" onPress={handleDelete} variant="danger" className="flex-1" />
                    </View>
                </View>
            );
        }

        return (
            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Typography variant="h2" weight="bold">{selectedAsset ? 'Edit Aset' : 'Tambah Aset'}</Typography>
                    <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </Pressable>
                </View>

                <View className="space-y-4">
                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Aset *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Contoh: Komputer Kantor"
                            value={formData.nama}
                            onChangeText={(text) => setFormData({ ...formData, nama: text })}
                        />
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kategori</Typography>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                {KATEGORI_FILTERS.filter(f => f.key !== 'all').map(f => (
                                    <Pressable
                                        key={f.key}
                                        onPress={() => setFormData({ ...formData, kategori: f.key })}
                                        className={`mr-2 px-3 py-2 rounded-xl border ${formData.kategori === f.key ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}
                                    >
                                        <Typography className={`text-[10px] font-bold ${formData.kategori === f.key ? 'text-white' : 'text-gray-500'}`}>{f.label}</Typography>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Tanggal Beli *</Typography>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium"
                                placeholder="YYYY-MM-DD"
                                value={formData.tanggal_beli}
                                onChangeText={(text) => setFormData({ ...formData, tanggal_beli: text })}
                            />
                        </View>
                        <View className="flex-1">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Beli *</Typography>
                            <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-primary">
                                <Typography className="text-textGray mr-2 font-bold text-xs">Rp</Typography>
                                <TextInput
                                    className="flex-1 text-textMain font-medium"
                                    placeholder="0"
                                    value={getFormattedValue(formData.harga_beli)}
                                    onChangeText={(text) => handleCurrencyChange(text, 'harga_beli')}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Umur (Tahun)</Typography>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium"
                                value={formData.umur_ekonomis}
                                onChangeText={(text) => setFormData({ ...formData, umur_ekonomis: text })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="flex-1">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Lokasi</Typography>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium"
                                placeholder="Cabang / Ruangan"
                                value={formData.lokasi}
                                onChangeText={(text) => setFormData({ ...formData, lokasi: text })}
                            />
                        </View>
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Catatan</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium min-h-[80px]"
                            placeholder="Detail aset..."
                            value={formData.catatan}
                            onChangeText={(text) => setFormData({ ...formData, catatan: text })}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <Button
                        title={selectedAsset ? 'Simpan Perubahan' : 'Tambah Aset'}
                        onPress={handleSubmit}
                        disabled={updateMutation.isPending || createMutation.isPending}
                        loading={updateMutation.isPending || createMutation.isPending}
                        className="mt-4"
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
                title="Aset"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            >
                {!sheetVisible && (
                    <View className="flex-row items-center bg-gray-50 h-11 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" className="ml-4" />
                        <TextInput
                            placeholder="Cari nama atau kode..."
                            className="flex-1 ml-3 text-sm font-medium text-textMain"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                )}
            </Header>

            {!sheetVisible && (
                <View className="px-6 mt-1">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                        {KATEGORI_FILTERS.map((filter) => (
                            <Pressable
                                key={filter.key}
                                onPress={() => setSelectedFilter(filter.key)}
                                className={`mr-3 px-5 py-2.5 rounded-2xl border ${selectedFilter === filter.key ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}
                            >
                                <Typography className={selectedFilter === filter.key ? 'text-white' : 'text-gray-500'} weight={selectedFilter === filter.key ? 'bold' : 'medium'} variant="caption">
                                    {filter.label}
                                </Typography>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}

            <FlatList
                data={assetList}
                renderItem={renderAssetItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                ListEmptyComponent={
                    isLoading ? (
                        <View className="mt-4"><SkeletonCard /><SkeletonCard /></View>
                    ) : (
                        <View className="mt-10"><EmptyState title="Tidak Ada Aset" description="Belum ada daftar aset perusahaan." icon={Box} /></View>
                    )
                }
            />

            {Platform.OS === 'web' ? (
                <Modal visible={sheetVisible} transparent={true} animationType="fade" onRequestClose={handleCloseSheet}>
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleCloseSheet} />
                        <View className="bg-white rounded-t-[32px] shadow-2xl h-[90%] max-w-[640px] self-center w-full">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">{renderSheetContent()}</ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet ref={bottomSheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ borderRadius: 32 }} onClose={() => setSheetVisible(false)}>
                    <BottomSheetScrollView>{renderSheetContent()}</BottomSheetScrollView>
                </BottomSheet>
            )}

            <AlertDialog visible={dialogConfig.visible} title={dialogConfig.title} message={dialogConfig.message} variant={dialogConfig.variant} type={dialogConfig.type} onConfirm={dialogConfig.onConfirm} onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))} />
        </View>
    );
}
