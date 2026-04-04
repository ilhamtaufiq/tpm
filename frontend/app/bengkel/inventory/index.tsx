import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
    View, 
    ScrollView, 
    Pressable, 
    TextInput, 
    StatusBar, 
    Alert, 
    RefreshControl as RNRefreshControl, 
    TouchableOpacity, 
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Platform,
    Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import {
    ChevronLeft,
    Search,
    Plus,
    AlertTriangle,
    Package,
    ArrowUpDown,
    Filter,
    Barcode as BarcodeIcon,
    Edit3,
    Minus,
    X,
    CheckCircle2
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useSparePartsList, useLowStockParts, useUpdateSparePart, useUpdateSparePartStock, useSparePartStats } from '../../../hooks/useBengkel';
import { BarcodeScannerModal } from '../../../components/ui/BarcodeScannerModal';
import { SkeletonCard, SkeletonListItem } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatCurrency } from '../../../utils/format';
import { BaseModal } from '../../../components/ui/BaseModal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import * as Print from 'expo-print';
import { FILE_URL } from '../../../utils/api';

export default function InventoryScreen() {
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const qrRef = React.useRef<any>(null);
    
    // Quick Stock States
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isQuickStockVisible, setIsQuickStockVisible] = useState(false);
    const [scannedPart, setScannedPart] = useState<any>(null);
    const [stockChange, setStockChange] = useState('0');
    const [stockOp, setStockOp] = useState<'add' | 'subtract'>('add');
    const [sortBy, setSortBy] = useState('nama');
    const [sortOrder, setSortOrder] = useState('asc');
    const [sheetIndex, setSheetIndex] = useState(-1);
    const sortSheetRef = useRef<BottomSheet>(null);
    const insets = useSafeAreaInsets();
    const updateStockMutation = useUpdateSparePartStock();



    // Form State
    const [formData, setFormData] = useState({
        nama: '',
        kode: '',
        kategori: '',
        stok: '0',
        stok_minimum: '0',
        harga_jual: '0',
        satuan: '',
        gambar: ''
    });

    // API Hooks
    const { 
        data: partsData, 
        isLoading, 
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useSparePartsList({ search, sort_by: sortBy, sort_order: sortOrder });
    const { data: lowStockData } = useLowStockParts();
    const { data: statsData, isLoading: isStatsLoading } = useSparePartStats();
    const updatePartMutation = useUpdateSparePart();

    const parts = React.useMemo(() => 
        partsData?.pages.flatMap((page: any) => page.data) || [],
    [partsData]);
    const lowStockCount = lowStockData?.length || 0;

    const handleOpenDetail = (part: any) => {
        setSelectedPart(part);
        setFormData({
            nama: part.nama || '',
            kode: part.kode || '',
            kategori: part.kategori || '',
            stok: String(part.stok || 0),
            stok_minimum: String(part.stok_minimum || 0),
            harga_jual: String(part.harga_jual || 0),
            satuan: part.satuan || '',
            gambar: part.gambar || ''
        });
        setIsModalVisible(true);
        setIsEditing(false);
    };

    const handleUpdate = async () => {
        if (!selectedPart) return;

        try {
            await updatePartMutation.mutateAsync({
                id: selectedPart.id,
                data: {
                    ...formData,
                    stok: parseInt(formData.stok) || 0,
                    stok_minimum: parseInt(formData.stok_minimum) || 0,
                    harga_jual: parseFloat(formData.harga_jual) || 0
                }
            });
            Alert.alert('Sukses', 'Data sparepart berhasil diperbarui');
            setIsEditing(false);
            refetch();
        } catch (error) {
            Alert.alert('Error', 'Gagal memperbarui data sparepart');
        }
    };

    const handleScanForStockUpdate = (scannedData: string) => {
        setIsScannerOpen(false);
        const cleanData = scannedData.trim();
        // search for part locally
        const part = parts.find((p: any) => 
            p.kode === cleanData || 
            (p.kode_part && p.kode_part === cleanData)
        );

        if (part) {
            setScannedPart(part);
            setStockChange('1');
            setStockOp('add');
            setIsQuickStockVisible(true);
        } else {
            Alert.alert('Tidak Ditemukan', `Kode "${scannedData}" tidak terdaftar di database.`);
        }
    };

    const handleQuickStockUpdate = async () => {
        if (!scannedPart || !stockChange) return;
        
        try {
            await updateStockMutation.mutateAsync({
                id: scannedPart.id,
                quantity: parseInt(stockChange) || 0,
                operation: stockOp
            });
            setIsQuickStockVisible(false);
            setScannedPart(null);
            refetch();
        } catch (error) {
            Alert.alert('Error', 'Gagal memperbarui stok.');
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handlePresentSortSheet = () => {
        if (Platform.OS === 'web') {
            setSheetIndex(0);
        } else {
            sortSheetRef.current?.snapToIndex(0);
        }
    };

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior="close"
            />
        ),
        []
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <Typography variant="h2" weight="bold">Stok Sparepart</Typography>
                </View>
                <View className="flex-row items-center">
                    <Pressable
                        onPress={() => setIsScannerOpen(true)}
                        className="bg-primary/5 p-2 rounded-full mr-2"
                    >
                        <BarcodeIcon size={22} color="#023C69" />
                    </Pressable>
                    <Pressable
                        onPress={() => router.push('/bengkel/purchase')}
                        className="bg-primary/10 px-3 py-1.5 rounded-full flex-row items-center"
                    >
                        <Plus size={16} color="#023C69" />
                        <Typography className="text-primary text-xs font-bold ml-1">Restock</Typography>
                    </Pressable>
                </View>
            </View>

            <View className="p-6 pb-0 bg-white">
                {/* Search & Filter */}
                <View className="flex-row items-center space-x-3 mb-6">
                    <View className="flex-1 flex-row items-center bg-gray-100 rounded-2xl px-4 h-12">
                        <Search size={20} color="#767676" />
                        <TextInput
                            placeholder="Cari nama atau kode part..."
                            className="flex-1 ml-2 text-text font-outfit"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <Pressable 
                        onPress={handlePresentSortSheet}
                        className={`w-12 h-12 rounded-2xl items-center justify-center ${sortBy !== 'nama' ? 'bg-primary/10 border border-primary/20' : 'bg-gray-100'}`}
                    >
                        <Filter size={20} color={sortBy !== 'nama' ? '#023C69' : '#1C1C1C'} />
                    </Pressable>
                </View>

                {/* Stats Section */}
                {!search && (
                    <View className="mb-6">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                            {/* Top Sales */}
                            <Card className="mr-4 p-4 bg-emerald-50/50 border-emerald-100 min-w-[280px]">
                                <View className="flex-row items-center justify-between mb-3">
                                    <Typography variant="body2" weight="bold" className="text-emerald-800">🔥 Penjualan Terbanyak</Typography>
                                    <View className="bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        <Typography variant="caption" className="text-emerald-700 font-bold">TOP 5</Typography>
                                    </View>
                                </View>
                                {isStatsLoading ? (
                                    <ActivityIndicator size="small" color="#10B981" />
                                ) : (
                                    statsData?.top_sales.map((item: any, idx: number) => (
                                        <Pressable 
                                            key={item.id} 
                                            onPress={() => handleOpenDetail(item)}
                                            className="flex-row items-center justify-between mb-2 active:opacity-60"
                                        >
                                            <Typography variant="caption" className="text-emerald-900/80 flex-1 mr-2" numberOfLines={1}>{idx + 1}. {item.nama}</Typography>
                                            <Typography variant="caption" weight="bold" className="text-emerald-700">{item.total_sales} terjual</Typography>
                                        </Pressable>
                                    ))
                                )}
                            </Card>

                            {/* Lowest Stock */}
                            <Card className="mr-4 p-4 bg-rose-50/50 border-rose-100 min-w-[280px]">
                                <View className="flex-row items-center justify-between mb-3">
                                    <Typography variant="body2" weight="bold" className="text-rose-800">⚠️ Stok Terendah</Typography>
                                    <View className="bg-rose-500/10 px-2 py-0.5 rounded-full">
                                        <Typography variant="caption" className="text-rose-700 font-bold">REFILL</Typography>
                                    </View>
                                </View>
                                {isStatsLoading ? (
                                    <ActivityIndicator size="small" color="#F43F5E" />
                                ) : (
                                    statsData?.lowest_stock.map((item: any, idx: number) => (
                                        <Pressable 
                                            key={item.id} 
                                            onPress={() => handleOpenDetail(item)}
                                            className="flex-row items-center justify-between mb-2 active:opacity-60"
                                        >
                                            <Typography variant="caption" className="text-rose-900/80 flex-1 mr-2" numberOfLines={1}>{idx + 1}. {item.nama}</Typography>
                                            <Typography variant="caption" weight="bold" className={item.stok <= item.stok_minimum ? 'text-rose-600' : 'text-rose-900/60'}>Stok: {item.stok}</Typography>
                                        </Pressable>
                                    ))
                                )}
                            </Card>
                        </ScrollView>
                    </View>
                )}

                {/* Low Stock Banner */}
                {lowStockCount > 0 && (
                    <Card className="bg-secondary/10 border border-secondary/20 p-4 mb-6 flex-row items-center">
                        <View className="bg-secondary p-2 rounded-full mr-4">
                            <AlertTriangle size={20} color="white" />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body2" weight="bold" className="text-secondary">Peringatan Stok Menipis</Typography>
                            <Typography variant="caption" className="text-secondary/80">Ada {lowStockCount} item yang berada di bawah stok minimum.</Typography>
                        </View>
                    </Card>
                )}
            </View>

            {isLoading ? (
                <View className="flex-1 px-6 pt-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
            ) : (
                <FlatList
                    data={parts}
                    keyExtractor={(item: any) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                    onEndReached={() => {
                        if (hasNextPage && !isFetchingNextPage) {
                            fetchNextPage();
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={() => (
                        isFetchingNextPage ? (
                            <View className="py-4 items-center">
                                <ActivityIndicator size="small" color="#023C69" />
                            </View>
                        ) : hasNextPage ? null : parts.length > 0 ? (
                            <View className="py-8 items-center border-t border-gray-100 border-dashed mt-4">
                                <Typography className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Semua data telah dimuat</Typography>
                            </View>
                        ) : null
                    )}
                    refreshControl={
                        <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                    }
                    renderItem={({ item: part }: { item: any }) => {
                        const imageUrl = part.gambar ? `${FILE_URL}/uploads/${part.gambar}` : null;
                        return (
                            <Card key={part.id} className="mb-4 p-4 flex-row items-center border-gray-50/50">
                                <View className="w-16 h-16 bg-gray-50 rounded-2xl items-center justify-center mr-4 overflow-hidden border border-gray-100">
                                    {imageUrl ? (
                                        <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                                    ) : (
                                        <Package size={24} color={part.stok < part.stok_minimum ? '#EE2737' : '#023C69'} />
                                    )}
                                </View>

                                <View className="flex-1">
                                    <Typography variant="body2" weight="bold" className="text-textMain">{part.nama}</Typography>
                                    <Typography variant="caption" className="text-textGray/60">{part.kode} • {part.kategori || 'Suku Cadang'}</Typography>

                                    <View className="flex-row items-center mt-2">
                                        <View className={`px-2 py-0.5 rounded-lg mr-2 ${part.stok === 999 ? 'bg-emerald-50' : (part.stok < part.stok_minimum ? 'bg-secondary/10' : 'bg-primary/5')}`}>
                                            <Typography
                                                variant="caption"
                                                weight="bold"
                                                className={part.stok === 999 ? 'text-emerald-600' : (part.stok < part.stok_minimum ? 'text-secondary' : 'text-primary')}
                                            >
                                                Stok: {part.stok === 999 ? 'Always Ready' : `${part.stok} ${part.satuan || 'Unit'}`}
                                            </Typography>
                                        </View>
                                        {part.stok !== 999 && (
                                            <Typography variant="caption" className="text-gray-400 font-medium">Min: {part.stok_minimum}</Typography>
                                        )}
                                    </View>
                                </View>

                            <View className="items-end">
                                <Typography variant="body2" weight="bold" className="text-primary">{formatCurrency(part.harga_jual)}</Typography>
                                <Pressable
                                    className="mt-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100"
                                    onPress={() => handleOpenDetail(part)}
                                >
                                    <Typography className="text-primary text-[10px] font-bold">Detail</Typography>
                                </Pressable>
                            </View>
                        </Card>
                        );
                    }}
                    ListEmptyComponent={
                        <EmptyState
                            title="Sparepart tidak ditemukan"
                            description={search ? `Tidak ada hasil for "${search}"` : "Belum ada item sparepart di database."}
                            icon={Package}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Detail & Edit Modal */}
            <BaseModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                title={isEditing ? "Edit Sparepart" : "Detail Sparepart"}
                maxHeight="92%"
                containerClassName="p-0 border-0"
            >
                <View className="flex-1">
                    <View className="items-center mb-6">
                        <View className="w-40 h-40 bg-gray-50 rounded-3xl items-center justify-center overflow-hidden border border-gray-100">
                            {formData.gambar ? (
                                <Image 
                                    source={{ uri: `${FILE_URL}/uploads/${formData.gambar}` }} 
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <Package size={48} color="#9CA3AF" strokeWidth={1} />
                            )}
                        </View>
                    </View>
                    <View className="space-y-4 px-1">
                            <Input
                                label="Nama Sparepart"
                                value={formData.nama}
                                onChangeText={(text) => setFormData({ ...formData, nama: text })}
                                editable={isEditing}
                                placeholder="Contoh: Oli MPX 2"
                            />
                            <Input
                                label="Kode Part"
                                value={formData.kode}
                                onChangeText={(text) => setFormData({ ...formData, kode: text })}
                                editable={isEditing}
                                placeholder="Contoh: OL-001"
                            />
                            <View className="flex-row space-x-3">
                                <Input
                                    label="Kategori"
                                    value={formData.kategori}
                                    containerClassName="flex-1"
                                    onChangeText={(text) => setFormData({ ...formData, kategori: text })}
                                    editable={isEditing}
                                    placeholder="Pelumas"
                                />
                                <Input
                                    label="Satuan"
                                    value={formData.satuan}
                                    containerClassName="flex-[0.7]"
                                    onChangeText={(text) => setFormData({ ...formData, satuan: text })}
                                    editable={isEditing}
                                    placeholder="Unit"
                                />
                            </View>
                            <View className="flex-row space-x-3">
                                <View className="flex-1">
                                    <Input
                                        label="Stok"
                                        value={formData.stok}
                                        onChangeText={(text) => setFormData({ ...formData, stok: text })}
                                        editable={isEditing}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Input
                                        label="Stok Min."
                                        value={formData.stok_minimum}
                                        onChangeText={(text) => setFormData({ ...formData, stok_minimum: text })}
                                        editable={isEditing}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                            <Input
                                label="Harga Jual (Rp)"
                                value={formData.harga_jual}
                                onChangeText={(text) => setFormData({ ...formData, harga_jual: text })}
                                editable={isEditing}
                                keyboardType="numeric"
                            />

                            <View className="mt-6">
                                {isEditing ? (
                                    <View className="space-y-3">
                                        <Button
                                            title="Simpan Perubahan"
                                            onPress={handleUpdate}
                                            loading={updatePartMutation.isPending}
                                        />
                                        <Button
                                            title="Batal"
                                            variant="outline"
                                            onPress={() => setIsEditing(false)}
                                        />
                                    </View>
                                ) : (
                                    <View className="space-y-3">
                                        <Button
                                            title="Ubah Data"
                                            variant="outline-neutral"
                                            className="bg-gray-100 border-0"
                                            onPress={() => setIsEditing(true)}
                                            icon={<Edit3 size={16} color="#4B5563" style={{ marginRight: 8 }} />}
                                        />
                                    </View>
                                )}
                            </View>
                        </View>

                </View>
            </BaseModal>
            {/* Quick Stock Modal */}
            <BaseModal
                visible={isQuickStockVisible}
                onClose={() => setIsQuickStockVisible(false)}
                title="Update Stok Cepat"
            >
                <View className="p-1">
                    <Card className="bg-gray-50 border-gray-100 p-4 mb-6">
                        <Typography variant="body1" weight="bold">{scannedPart?.nama}</Typography>
                        <Typography variant="caption" className="text-textGray mt-1">
                            Kode: {scannedPart?.kode} • Stok Saat Ini: {scannedPart?.stok === 999 ? 'Always Ready' : `${scannedPart?.stok} ${scannedPart?.satuan || 'pcs'}`}
                        </Typography>
                    </Card>

                    <View className="flex-row space-x-3 mb-6">
                        <Pressable 
                            onPress={() => setStockOp('add')}
                            className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-2 ${stockOp === 'add' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-gray-100'}`}
                        >
                            <Plus size={20} color={stockOp === 'add' ? '#10B981' : '#94A3B8'} />
                            <Typography className={`ml-2 font-bold ${stockOp === 'add' ? 'text-emerald-700' : 'text-gray-400'}`}>Tambah</Typography>
                        </Pressable>
                        <Pressable 
                            onPress={() => setStockOp('subtract')}
                            className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-2 ${stockOp === 'subtract' ? 'bg-rose-50 border-rose-500' : 'bg-white border-gray-100'}`}
                        >
                            <Minus size={20} color={stockOp === 'subtract' ? '#F43F5E' : '#94A3B8'} />
                            <Typography className={`ml-2 font-bold ${stockOp === 'subtract' ? 'text-rose-700' : 'text-gray-400'}`}>Kurang</Typography>
                        </Pressable>
                    </View>

                    <Typography variant="caption" weight="bold" className="text-textGray mb-2 ml-1">Jumlah Perubahan</Typography>
                    <View className="flex-row items-center space-x-4 mb-8">
                        <Pressable 
                            onPress={() => setStockChange(prev => Math.max(0, parseInt(prev) - 1).toString())}
                            className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <Minus size={20} color="#4B5563" />
                        </Pressable>
                        <View className="flex-1">
                            <TextInput
                                keyboardType="numeric"
                                value={stockChange}
                                onChangeText={setStockChange}
                                className="h-12 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-bold font-outfit"
                            />
                        </View>
                        <Pressable 
                            onPress={() => setStockChange(prev => (parseInt(prev || '0') + 1).toString())}
                            className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <Plus size={20} color="#4B5563" />
                        </Pressable>
                    </View>

                    <Button
                        title={`Konfirmasi ${stockOp === 'add' ? 'Penambahan' : 'Pengurangan'}`}
                        onPress={handleQuickStockUpdate}
                        loading={updateStockMutation.isPending}
                    />
                </View>
            </BaseModal>

            <BarcodeScannerModal 
                visible={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScan={handleScanForStockUpdate} 
            />

            {/* Sort UI - Hybrid (BottomSheet on Mobile, Modal on Web) */}
            {Platform.OS === 'web' ? (
                <Modal 
                    visible={sheetIndex !== -1} 
                    transparent 
                    animationType="slide" 
                    onRequestClose={() => setSheetIndex(-1)}
                >
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setSheetIndex(-1)} />
                        <View className="bg-white rounded-t-[48px] shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: 640, height: '80%', alignSelf: 'center' }}>
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                                {renderSortContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={sortSheetRef}
                    index={-1}
                    snapPoints={['65%', '85%']}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ borderRadius: 32 }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 40 }}
                    onChange={setSheetIndex}
                >
                    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, paddingTop: 12 }}>
                        {renderSortContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}
        </SafeAreaView>
    );

    function renderSortContent() {
        const onClose = () => {
            if (Platform.OS === 'web') setSheetIndex(-1);
            else sortSheetRef.current?.close();
        };

        return (
            <>
                <View className="flex-row items-center justify-between mb-8">
                    <Typography variant="h3" weight="bold">Urutkan Sparepart</Typography>
                    <Pressable 
                        onPress={onClose}
                        className="bg-gray-100 p-2 rounded-full"
                    >
                        <X size={20} color="#4B5563" />
                    </Pressable>
                </View>

                <View className="space-y-6">
                    <View>
                        <Typography variant="caption" weight="bold" className="text-textGray mb-4 ml-1 uppercase tracking-widest text-[10px]">Urutkan Berdasarkan</Typography>
                        <View className="space-y-3">
                            {[
                                { id: 'nama', label: 'Nama Sparepart', icon: Package },
                                { id: 'penjualan', label: 'Penjualan Terbanyak', icon: ArrowUpDown },
                                { id: 'stok', label: 'Jumlah Stok', icon: AlertTriangle },
                                { id: 'harga_jual', label: 'Harga Jual', icon: Edit3 },
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setSortBy(option.id);
                                        if (option.id === 'penjualan' || option.id === 'stok') {
                                            setSortOrder('desc');
                                        } else {
                                            setSortOrder('asc');
                                        }
                                    }}
                                    className={`flex-row items-center p-4 rounded-3xl border-2 ${sortBy === option.id ? 'bg-primary/5 border-primary/20' : 'bg-white border-gray-50 shadow-sm shadow-gray-200'}`}
                                >
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${sortBy === option.id ? 'bg-primary/10' : 'bg-gray-50'}`}>
                                        <View>
                                            {React.createElement(option.icon, { size: 22, color: sortBy === option.id ? '#023C69' : '#94A3B8' })}
                                        </View>
                                    </View>
                                    <View className="flex-1">
                                        <Typography weight={sortBy === option.id ? 'bold' : 'medium'} className={sortBy === option.id ? 'text-primary text-base' : 'text-textMain text-base'}>
                                            {option.label}
                                        </Typography>
                                        <Typography variant="caption" className={sortBy === option.id ? 'text-primary/60' : 'text-textGray'}>
                                            {option.id === 'nama' ? 'A-Z' : option.id === 'penjualan' ? 'Penjualan Tertinggi' : option.id === 'stok' ? 'Banyak ke Sedikit' : 'Harga'}
                                        </Typography>
                                    </View>
                                    {sortBy === option.id && (
                                        <View className="bg-primary rounded-full p-1.5">
                                            <CheckCircle2 size={16} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View className="pt-4 border-t border-gray-100">
                        <Typography variant="caption" weight="bold" className="text-textGray mb-4 ml-1 uppercase tracking-widest text-[10px]">Arah Urutan</Typography>
                        <View className="flex-row space-x-3">
                            <Pressable
                                onPress={() => setSortOrder('asc')}
                                className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-2 ${sortOrder === 'asc' ? 'bg-primary border-primary shadow-lg shadow-primary/30' : 'bg-white border-gray-100 shadow-sm'}`}
                            >
                                <Typography weight="bold" className={sortOrder === 'asc' ? 'text-white' : 'text-textMain'}>Terkecil/A-Z</Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setSortOrder('desc')}
                                className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-2 ${sortOrder === 'desc' ? 'bg-primary border-primary shadow-lg shadow-primary/30' : 'bg-white border-gray-100 shadow-sm'}`}
                            >
                                <Typography weight="bold" className={sortOrder === 'desc' ? 'text-white' : 'text-textMain'}>Terbesar/Z-A</Typography>
                            </Pressable>
                        </View>
                    </View>

                    <Button
                        title="Terapkan Filter"
                        onPress={onClose}
                        className="mt-8 h-14 rounded-2xl shadow-xl shadow-primary/30"
                    />
                    <View className="h-8" />
                </View>
            </>
        );
    }
}
