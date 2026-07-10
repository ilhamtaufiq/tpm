import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, RefreshControl as RNRefreshControl, ActivityIndicator, FlatList, Image, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Typography } from '../../components/ui/Typography';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { appAlert } from '../../utils/appAlert';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    Search,
    Plus,
    AlertTriangle,
    Package,
    ArrowUpDown,
    Barcode as BarcodeIcon,
    Edit3,
    Minus,
    X,
    CheckCircle2,
    Check,
    Circle,
    Download,
    Boxes,
    TrendingUp,
    ShoppingCart,
    ChevronRight,
    Receipt,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useSparePartsList, useLowStockParts, useUpdateSparePart, useUpdateSparePartStock, useSparePartStats, useExportSpareParts, useSparePartStockValue } from '../../hooks/useBengkel';
import { BarcodeScannerModal } from '../../components/ui/BarcodeScannerModal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatNumber } from '../../utils/format';
import { findSparePartByBarcode } from '../../utils/barcodeScan';
import { BaseModal } from '../../components/ui/BaseModal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { FILE_URL } from '../../utils/api';
import { isAlwaysReadyStock } from '../../utils/sparepartStock';

type StockFilter = 'ALL' | 'low' | 'available' | 'empty' | 'always';

const getPartStockStatus = (part: any): 'always' | 'low' | 'empty' | 'ok' => {
    if (isAlwaysReadyStock(part.stok)) return 'always';
    if (Number(part.stok || 0) <= 0) return 'empty';
    if (Number(part.stok) < Number(part.stok_minimum || 0)) return 'low';
    return 'ok';
};

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
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
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
    } = useSparePartsList({
        search,
        sort_by: sortBy,
        sort_order: sortOrder,
        low_stock_only: stockFilter === 'low',
    });
    const { data: lowStockData } = useLowStockParts();
    const { data: statsData } = useSparePartStats();
    const { data: stockValueData, isLoading: isStockValueLoading } = useSparePartStockValue();
    const updatePartMutation = useUpdateSparePart();

    const parts = React.useMemo(() =>
        partsData?.pages.flatMap((page: any) => page.data) || [],
        [partsData]);
    const totalProducts = partsData?.pages?.[0]?.total ?? parts.length;
    const lowStockCount = lowStockData?.length || 0;

    const filteredParts = useMemo(() => {
        if (stockFilter === 'ALL' || stockFilter === 'low') return parts;
        return parts.filter((part: any) => {
            const status = getPartStockStatus(part);
            if (stockFilter === 'always') return status === 'always';
            if (stockFilter === 'empty') return status === 'empty';
            if (stockFilter === 'available') return status === 'always' || status === 'ok' || status === 'low';
            return true;
        });
    }, [parts, stockFilter]);

    const stockFilterStats = useMemo(() => {
        return parts.reduce((acc: Record<string, number>, part: any) => {
            const status = getPartStockStatus(part);
            acc.ALL += 1;
            if (status === 'low') acc.low += 1;
            if (status === 'empty') acc.empty += 1;
            if (status === 'always') acc.always += 1;
            if (status === 'always' || status === 'ok' || status === 'low') acc.available += 1;
            return acc;
        }, { ALL: 0, low: 0, available: 0, empty: 0, always: 0 });
    }, [parts]);

    const exportMutation = useExportSpareParts();
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredParts.length && filteredParts.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredParts.map((item: any) => item.id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkExport = async (ids?: number[]) => {
        try {
            const data = await exportMutation.mutateAsync(ids);
            const filename = `inventory_export_${new Date().getTime()}.xlsx`;

            if (Platform.OS === 'web') {
                const url = window.URL.createObjectURL(new Blob([data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } else {
                appAlert('Export', 'Fitur download di mobile akan segera hadir. Gunakan format Web untuk export.');
            }
        } catch (error) {
            appAlert('Error', 'Gagal mengekspor data.');
        }
    };

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
            appAlert('Sukses', 'Data sparepart berhasil diperbarui');
            setIsEditing(false);
            refetch();
        } catch (error) {
            appAlert('Error', 'Gagal memperbarui data sparepart');
        }
    };

    const handleScanForStockUpdate = (scannedData: string): boolean => {
        const part = findSparePartByBarcode(parts, scannedData);

        if (part) {
            setIsScannerOpen(false);
            setScannedPart(part);
            setStockChange('1');
            setStockOp('add');
            setIsQuickStockVisible(true);
            return true;
        }

        appAlert('Tidak Ditemukan', `Kode "${scannedData}" tidak terdaftar di database.`);
        return false;
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
            appAlert('Error', 'Gagal memperbarui stok.');
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
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

    const renderStockBadge = (part: any) => {
        const status = getPartStockStatus(part);
        if (status === 'always') {
            return <Badge label="Always Ready" variant="success" />;
        }
        if (status === 'empty') {
            return <Badge label="Stok Habis" variant="error" />;
        }
        if (status === 'low') {
            return <Badge label={`Stok ${part.stok} ${part.satuan || 'pcs'}`} variant="warning" />;
        }
        return <Badge label={`Stok ${part.stok} ${part.satuan || 'pcs'}`} variant="neutral" />;
    };

    const listHeader = (
        <View>
            <View className="flex-row gap-3 mb-4">
                {[
                    { label: 'Total SKU', value: formatNumber(totalProducts), icon: Boxes, color: '#023C69', bg: 'bg-primary/5' },
                    { label: 'Stok Menipis', value: formatNumber(lowStockCount), icon: AlertTriangle, color: '#D97706', bg: 'bg-amber-50' },
                    { label: 'Nilai Modal', value: isStockValueLoading ? '...' : formatCurrency(stockValueData?.total_value || 0), icon: TrendingUp, color: '#059669', bg: 'bg-emerald-50' },
                ].map((stat) => {
                    const StatIcon = stat.icon;
                    return (
                        <View key={stat.label} className={`flex-1 ${stat.bg} rounded-2xl p-3 border border-gray-100`}>
                            <View className="flex-row items-center mb-2">
                                <StatIcon size={14} color={stat.color} />
                                <Typography className="text-[9px] font-bold text-gray-500 ml-1.5 uppercase tracking-wide">{stat.label}</Typography>
                            </View>
                            <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>{stat.value}</Typography>
                        </View>
                    );
                })}
            </View>

            <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 mb-3">
                <Search size={18} color="#9CA3AF" />
                <TextInput
                    placeholder="Cari nama, kode, atau kategori..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 ml-3 text-sm font-medium text-textMain"
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')} className="p-1 mr-1">
                        <X size={16} color="#9CA3AF" />
                    </Pressable>
                )}
                <Pressable
                    onPress={handlePresentSortSheet}
                    className={`w-9 h-9 rounded-xl items-center justify-center ${sortBy !== 'nama' || sortOrder !== 'asc' ? 'bg-primary/10' : 'bg-white border border-gray-100'}`}
                >
                    <ArrowUpDown size={16} color={sortBy !== 'nama' || sortOrder !== 'asc' ? '#023C69' : '#6B7280'} />
                </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
                {([
                    { id: 'ALL' as StockFilter, label: 'Semua', count: totalProducts, active: 'bg-primary border-primary', inactive: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
                    { id: 'low' as StockFilter, label: 'Menipis', count: lowStockCount, active: 'bg-amber-500 border-amber-500', inactive: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                    { id: 'available' as StockFilter, label: 'Tersedia', count: stockFilterStats.available, active: 'bg-emerald-500 border-emerald-500', inactive: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                    { id: 'empty' as StockFilter, label: 'Habis', count: stockFilterStats.empty, active: 'bg-rose-500 border-rose-500', inactive: 'bg-rose-50 border-rose-100', text: 'text-rose-700' },
                    { id: 'always' as StockFilter, label: 'Always Ready', count: stockFilterStats.always, active: 'bg-blue-500 border-blue-500', inactive: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
                ]).map((filter) => {
                    const isActive = stockFilter === filter.id;
                    return (
                        <Pressable
                            key={filter.id}
                            onPress={() => setStockFilter(filter.id)}
                            className={`px-4 py-2 rounded-full border mr-2 ${isActive ? filter.active : filter.inactive}`}
                        >
                            <Typography variant="caption" weight="bold" className={isActive ? 'text-white' : filter.text}>
                                {filter.label} ({filter.count})
                            </Typography>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <View className="flex-row gap-2 mb-4">
                {[
                    { label: 'Scan', icon: BarcodeIcon, color: '#2563EB', onPress: () => setIsScannerOpen(true) },
                    { label: 'Restock', icon: ShoppingCart, color: '#059669', onPress: () => router.push('/bengkel/purchase') },
                    { label: 'Export', icon: Download, color: '#D97706', onPress: () => setIsExportModalVisible(true) },
                    { label: 'Transaksi', icon: Receipt, color: '#023C69', onPress: () => router.push({ pathname: '/bengkel/transaksi', params: { mode: 'all' } } as any) },
                ].map((action) => {
                    const ActionIcon = action.icon;
                    return (
                        <Pressable
                            key={action.label}
                            onPress={action.onPress}
                            className="flex-1 bg-white border border-gray-100 rounded-2xl py-3 items-center active:opacity-80"
                        >
                            <ActionIcon size={18} color={action.color} />
                            <Typography className="text-[9px] font-bold text-gray-600 mt-1">{action.label}</Typography>
                        </Pressable>
                    );
                })}
            </View>

            {lowStockCount > 0 && stockFilter !== 'low' && (
                <Pressable
                    onPress={() => setStockFilter('low')}
                    className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4 flex-row items-center active:opacity-90"
                >
                    <View className="bg-amber-500 p-2 rounded-full mr-3">
                        <AlertTriangle size={18} color="white" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body2" weight="bold" className="text-amber-800">Stok Menipis</Typography>
                        <Typography variant="caption" className="text-amber-700/80">{lowStockCount} item di bawah stok minimum — ketuk untuk filter</Typography>
                    </View>
                    <ChevronRight size={18} color="#D97706" />
                </Pressable>
            )}

            {filteredParts.length > 0 && (
                <View className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                        <Pressable onPress={toggleSelectAll} className="flex-row items-center mr-3">
                            <View className={`w-6 h-6 rounded-lg border items-center justify-center ${selectedIds.length === filteredParts.length && filteredParts.length > 0 ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                {selectedIds.length === filteredParts.length && filteredParts.length > 0 && <Check size={14} color="white" />}
                            </View>
                            <Typography className="ml-2 text-xs font-bold text-textGray">Pilih Semua</Typography>
                        </Pressable>
                        {selectedIds.length > 0 && (
                            <Typography className="text-xs font-bold text-primary px-2 py-1 bg-primary/5 rounded-lg">
                                {selectedIds.length} terpilih
                            </Typography>
                        )}
                    </View>
                    <Typography className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {filteredParts.length} item
                    </Typography>
                </View>
            )}

            {statsData?.top_sales?.length > 0 && (
                <View className="mb-4">
                    <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest text-[10px] mb-2 ml-1">
                        Terlaris
                    </Typography>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {statsData.top_sales.slice(0, 5).map((item: any) => (
                            <Pressable
                                key={`top-${item.id}`}
                                onPress={() => handleOpenDetail(item)}
                                className="bg-white border border-gray-100 rounded-2xl p-3 mr-3 min-w-[140px] active:opacity-90"
                            >
                                <Typography weight="bold" className="text-textMain text-xs" numberOfLines={2}>{item.nama}</Typography>
                                <Typography className="text-emerald-600 text-[10px] font-bold mt-2">{item.total_sales} terjual</Typography>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View>
                        <Typography variant="h2" weight="bold">Inventory Sparepart</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">Kelola stok, harga, dan restock</Typography>
                    </View>
                </View>
                <Pressable
                    onPress={() => router.push('/bengkel/purchase')}
                    className="bg-primary px-4 py-2 rounded-xl flex-row items-center active:opacity-90"
                >
                    <Plus size={16} color="white" />
                    <Typography weight="bold" className="text-white text-xs ml-1">Restock</Typography>
                </Pressable>
            </View>

            {isLoading ? (
                <View className="flex-1 px-6 pt-6">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
            ) : (
                <FlatList
                    data={filteredParts}
                    keyExtractor={(item: any) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24), paddingTop: 16 }}
                    ListHeaderComponent={listHeader}
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
                        ) : hasNextPage ? null : filteredParts.length > 0 ? (
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
                        const isSelected = selectedIds.includes(part.id);
                        const status = getPartStockStatus(part);
                        return (
                            <Pressable
                                onPress={() => handleOpenDetail(part)}
                                className="bg-white p-4 rounded-[28px] mb-4 border border-gray-50 shadow-sm active:scale-[0.98]"
                            >
                                <View className="flex-row items-center">
                                    <Pressable
                                        onPress={(e: any) => {
                                            e?.stopPropagation?.();
                                            toggleSelect(part.id);
                                        }}
                                        className="mr-3"
                                    >
                                        {isSelected ? (
                                            <View className="w-7 h-7 bg-primary rounded-lg items-center justify-center">
                                                <Check size={14} color="white" />
                                            </View>
                                        ) : (
                                            <Circle size={26} color="#CBD5E1" strokeWidth={1.5} />
                                        )}
                                    </Pressable>

                                    <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-3 overflow-hidden border ${
                                        status === 'low' ? 'bg-amber-50 border-amber-100' :
                                        status === 'empty' ? 'bg-rose-50 border-rose-100' :
                                        status === 'always' ? 'bg-emerald-50 border-emerald-100' :
                                        'bg-primary/5 border-primary/10'
                                    }`}>
                                        {imageUrl ? (
                                            <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                                        ) : (
                                            <Package size={22} color={
                                                status === 'low' ? '#D97706' :
                                                status === 'empty' ? '#F43F5E' :
                                                status === 'always' ? '#059669' : '#023C69'
                                            } />
                                        )}
                                    </View>

                                    <View className="flex-1">
                                        <View className="flex-row items-start justify-between gap-2">
                                            <Typography weight="bold" className="text-textMain text-sm flex-1" numberOfLines={2}>
                                                {part.nama}
                                            </Typography>
                                            {renderStockBadge(part)}
                                        </View>
                                        <Typography className="text-textGray text-[11px] mt-1" numberOfLines={1}>
                                            {[part.kode_part, part.kode_ean, part.kode].filter(Boolean).join(' • ') || '-'} • {part.kategori || 'Suku Cadang'}
                                        </Typography>
                                        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                            <Typography className="text-textGray text-[10px] font-semibold">
                                                {!isAlwaysReadyStock(part.stok) ? `Min: ${part.stok_minimum} ${part.satuan || 'pcs'}` : 'Katalog referensi'}
                                            </Typography>
                                            <Typography weight="bold" className="text-primary text-sm">
                                                {formatCurrency(part.harga_jual)}
                                            </Typography>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={
                        <EmptyState
                            title="Sparepart tidak ditemukan"
                            description={search ? `Tidak ada hasil untuk "${search}"` : stockFilter !== 'ALL' ? 'Tidak ada item pada filter ini.' : 'Belum ada item sparepart di database.'}
                            icon={Package}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            {selectedPart && (
                <Modal
                    visible={isModalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => {
                        setIsModalVisible(false);
                        setIsEditing(false);
                    }}
                    statusBarTranslucent
                >
                    <View className="flex-1 justify-end bg-black/50">
                        <Pressable
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            onPress={() => {
                                setIsModalVisible(false);
                                setIsEditing(false);
                            }}
                        />
                        <View className="bg-white rounded-t-[48px] p-6 max-h-[90%]">
                            <View className="flex-row justify-between items-center mb-5">
                                <View>
                                    <Typography variant="h3" weight="bold">
                                        {isEditing ? 'Edit Sparepart' : 'Detail Sparepart'}
                                    </Typography>
                                    <Typography className="text-gray-400 text-xs mt-0.5">
                                        {formData.kode || selectedPart.kode || '-'}
                                    </Typography>
                                </View>
                                <Pressable
                                    onPress={() => {
                                        setIsModalVisible(false);
                                        setIsEditing(false);
                                    }}
                                    className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                                >
                                    <X size={18} color="#4B5563" />
                                </Pressable>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="items-center mb-5">
                                    <View className="w-32 h-32 bg-gray-50 rounded-3xl items-center justify-center overflow-hidden border border-gray-100">
                                        {formData.gambar ? (
                                            <Image
                                                source={{ uri: `${FILE_URL}/uploads/${formData.gambar}` }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <Package size={40} color="#9CA3AF" strokeWidth={1} />
                                        )}
                                    </View>
                                    {!isEditing && selectedPart && (
                                        <View className="mt-3">
                                            {renderStockBadge(selectedPart)}
                                        </View>
                                    )}
                                </View>

                                <View className="space-y-4">
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

                                    {!isEditing && !isAlwaysReadyStock(selectedPart?.stok) && (
                                        <Pressable
                                            onPress={() => {
                                                setScannedPart(selectedPart);
                                                setStockChange('1');
                                                setStockOp('add');
                                                setIsQuickStockVisible(true);
                                            }}
                                            className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex-row items-center active:opacity-90"
                                        >
                                            <BarcodeIcon size={20} color="#023C69" />
                                            <Typography weight="bold" className="text-primary text-sm ml-3">Update Stok Cepat</Typography>
                                        </Pressable>
                                    )}

                                    <View className="mt-2 pb-6">
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
                                            <Button
                                                title="Ubah Data"
                                                variant="outline-neutral"
                                                className="bg-gray-100 border-0"
                                                onPress={() => setIsEditing(true)}
                                                icon={<Edit3 size={16} color="#4B5563" style={{ marginRight: 8 }} />}
                                            />
                                        )}
                                    </View>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
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
                            Kode: {scannedPart?.kode} • Stok Saat Ini: {isAlwaysReadyStock(scannedPart?.stok) ? 'Always Ready' : `${scannedPart?.stok} ${scannedPart?.satuan || 'pcs'}`}
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

            {/* Export Selection Modal */}
            <BaseModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                title="Download Excel"
            >
                <View className="p-4">
                    <Typography className="text-textGray mb-6 text-center">
                        Pilih cakupan data yang ingin Anda unduh dalam format Excel.
                    </Typography>
                    <View className="space-y-4">
                        <Pressable
                            onPress={() => {
                                setIsExportModalVisible(false);
                                handleBulkExport(undefined);
                            }}
                            className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex-row items-center"
                        >
                            <View className="bg-primary/10 p-3 rounded-xl mr-4">
                                <Package size={24} color="#023C69" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-primary">Download Seluruh Data</Typography>
                                <Typography variant="caption" className="text-textGray">Ekspor seluruh data dari database.</Typography>
                            </View>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                setIsExportModalVisible(false);
                                handleBulkExport(parts.map((i: any) => i.id));
                            }}
                            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row items-center"
                        >
                            <View className="bg-emerald-100 p-3 rounded-xl mr-4">
                                <Check size={24} color="#059669" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-emerald-700">Download Yang Tampil</Typography>
                                <Typography variant="caption" className="text-textGray">Hanya item yang sudah dimuat di layar ({parts.length} item).</Typography>
                            </View>
                        </Pressable>
                        {selectedIds.length > 0 && (
                            <Pressable
                                onPress={() => {
                                    setIsExportModalVisible(false);
                                    handleBulkExport(selectedIds);
                                }}
                                className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex-row items-center"
                            >
                                <View className="bg-amber-100 p-3 rounded-xl mr-4">
                                    <Check size={24} color="#D97706" />
                                </View>
                                <View className="flex-1">
                                    <Typography variant="body1" weight="bold" className="text-amber-700">Download Data Terpilih</Typography>
                                    <Typography variant="caption" className="text-textGray">Ekspor {selectedIds.length} item yang telah Anda centang.</Typography>
                                </View>
                            </Pressable>
                        )}
                        <Button
                            title="Tutup"
                            variant="outline"
                            onPress={() => setIsExportModalVisible(false)}
                            className="mt-4"
                        />
                    </View>
                </View>
            </BaseModal>


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
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
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
                                <Pressable
                                    key={option.id}
                                    onPress={() => {
                                        setSortBy(option.id);
                                        if (option.id === 'penjualan' || option.id === 'stok') {
                                            setSortOrder('desc');
                                        } else {
                                            setSortOrder('asc');
                                        }
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 16,
                                        borderRadius: 24,
                                        borderWidth: 2,
                                        backgroundColor: sortBy === option.id ? 'rgba(2, 60, 105, 0.05)' : 'white',
                                        borderColor: sortBy === option.id ? 'rgba(2, 60, 105, 0.2)' : 'rgba(249, 250, 251, 1)',
                                        opacity: pressed ? 0.7 : 1
                                    })}
                                    className="shadow-sm shadow-gray-200"
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
                                </Pressable>
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
