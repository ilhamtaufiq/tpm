import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Search,
    Plus,
    Car,
    Filter,
    Info,
    Calendar,
    GaugeCircle,
    CircleDollarSign,
    Calculator,
    TrendingUp,
    Trash2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetView, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MobilForm } from '../../components/MobilForm';
import { MobilDetail } from '../../components/MobilDetail';
import { MobilSalesForm } from '../../components/MobilSalesForm';
import { MobilCostForm } from '../../components/MobilCostForm';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { useMobilList, useDeleteMobil } from '../../hooks/useMobil';
import { FILE_URL } from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import { Platform, Modal } from 'react-native';

export default function MobilInventoryScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('tersedia');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [selectedDetailUnit, setSelectedDetailUnit] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Dialog State
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    // Fetch Data
    const { data, isLoading, refetch } = useMobilList({
        status: activeTab,
        search: searchQuery
    });

    const deleteMutation = useDeleteMobil();

    const mobils = data?.data || [];

    // Bottom Sheet Logic (Registration)
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['90%'], []);
    const detailSnapPoints = useMemo(() => ['95%'], []);

    // Bottom Sheet Logic (Sales)
    const salesBottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Bottom Sheet Logic (Costs)
    const costBottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Bottom Sheet Logic (Edit)
    const editBottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Bottom Sheet Logic (Detail)
    const detailBottomSheetModalRef = useRef<BottomSheetModal>(null);


    // Derived state for reactive updates
    const selectedUnitData = useMemo(() => {
        if (!selectedUnit) return null;
        return mobils.find((m: any) => m.id === selectedUnit.id) || selectedUnit;
    }, [selectedUnit, mobils]);

    const [webModal, setWebModal] = useState<'new' | 'edit' | 'sales' | 'cost' | 'detail' | null>(null);
    const [editingUnit, setEditingUnit] = useState<any>(null);

    const handlePresentModalPress = useCallback(() => {
        if (Platform.OS === 'web') {
            setWebModal('new');
        } else {
            bottomSheetModalRef.current?.present();
        }
    }, [bottomSheetModalRef]);

    const handlePresentSalesModal = useCallback((unit: any) => {
        setSelectedUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('sales');
        } else {
            salesBottomSheetModalRef.current?.present();
        }
    }, [salesBottomSheetModalRef]);

    const handlePresentCostModal = useCallback((unit: any) => {
        setSelectedUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('cost');
        } else {
            costBottomSheetModalRef.current?.present();
        }
    }, [costBottomSheetModalRef]);

    const handlePresentDetailModal = useCallback((unit: any) => {
        setSelectedDetailUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('detail');
        } else {
            detailBottomSheetModalRef.current?.present();
        }
    }, [detailBottomSheetModalRef]);

    const handlePresentEditModal = useCallback((unit: any) => {
        setEditingUnit(unit);
        if (Platform.OS === 'web') {
            setWebModal('edit');
        } else {
            editBottomSheetModalRef.current?.present();
        }
    }, [editBottomSheetModalRef]);

    const handleDeleteMobil = (unit: any) => {
        setDialogConfig({
            visible: true,
            title: "Hapus Unit",
            message: `Apakah Anda yakin ingin menghapus ${unit.merek} ${unit.model} (${unit.nomor_plat})? Data yang dihapus tidak dapat dikembalikan.`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);
                    await deleteMutation.mutateAsync(unit.id);
                    refetch();
                    closeDialog();
                } catch (error) {
                    console.error("Gagal menghapus mobil:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: "Gagal menghapus unit mobil",
                            variant: 'error',
                            type: 'alert'
                        });
                    }, 500);
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'tersedia': return '#023C69';
            case 'booking': return '#FF9500';
            case 'terjual': return '#8E8E93';
            default: return '#EE2737';
        }
    };

    const stats = useMemo(() => {
        return {
            total: mobils.length,
            tersedia: mobils.filter((m: any) => m.status === 'tersedia').length,
            terjual: mobils.filter((m: any) => m.status === 'terjual').length
        };
    }, [mobils]);

    return (
        <BottomSheetModalProvider>
            <View className="flex-1 bg-surface">
                <StatusBar barStyle="light-content" />

                {/* Header Section (Home Style) */}
                <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-row items-center">
                            <TouchableOpacity
                                onPress={handleGoBack}
                                className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                            >
                                <ChevronLeft size={24} color="white" />
                            </TouchableOpacity>
                            <View>
                                <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Unit Mobil</Typography>
                                <Typography className="text-white/50 text-xs mt-0.5">Manajemen Inventaris & Penjualan</Typography>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: '/laporan/pembelian-mobil' })}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <TrendingUp size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Bento Stats (Home Style) */}
                    <View className="flex-row justify-between">
                        <View className="flex-1 bg-white/10 p-4 rounded-[24px] mr-2 border border-white/5">
                            <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1">Total Unit</Typography>
                            <Typography weight="bold" className="text-white text-xl">{stats.total}</Typography>
                        </View>
                        <View className="flex-1 bg-white/10 p-4 rounded-[24px] mr-2 border border-white/5">
                            <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1">Tersedia</Typography>
                            <Typography weight="bold" className="text-emerald-400 text-xl">{stats.tersedia}</Typography>
                        </View>
                        <View className="flex-1 bg-emerald-500 p-4 rounded-[24px] border border-white/10">
                            <Typography className="text-white/60 text-[10px] uppercase font-bold mb-1">Terjual</Typography>
                            <Typography weight="bold" className="text-white text-xl">{stats.terjual}</Typography>
                        </View>
                    </View>
                </View>

                {/* Filters & Search */}
                <View className="px-6 -mt-6">
                    <View className="bg-white p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-sm font-medium text-textMain"
                                placeholder="Cari unit..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <TouchableOpacity className="ml-2 w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
                            <Filter size={20} color="#023C69" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tabs */}
                <View className="flex-row px-6 mt-6 mb-2 space-x-2">
                    {['tersedia', 'booking', 'terjual'].map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            className={`px-5 py-2.5 rounded-2xl border ${activeTab === tab ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white border-gray-100'}`}
                        >
                            <Typography className={`capitalize text-xs font-bold ${activeTab === tab ? 'text-white' : 'text-gray-500'}`}>
                                {tab}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView
                    className="flex-1 px-6 pt-4"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isLoading && mobils.length > 0} onRefresh={refetch} colors={['#023C69']} />
                    }
                >
                    {isLoading && mobils.length === 0 ? (
                        <View className="space-y-4">
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    ) : mobils.length === 0 ? (
                        <EmptyState
                            title="Mobil tidak ditemukan"
                            description={searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : "Belum ada unit mobil dalam kategori ini."}
                            icon={Car}
                        />
                    ) : (
                        mobils.map((item: any) => (
                            <TouchableOpacity
                                key={item.id}
                                activeOpacity={0.9}
                                onPress={() => handlePresentDetailModal(item)}
                                className="mb-6"
                            >
                                <Card className="overflow-hidden border-0 shadow-lg bg-white rounded-[32px]">
                                    {/* Image Section */}
                                    <View className="h-56 bg-gray-100">
                                        {item.media && item.media.length > 0 ? (
                                            <Image
                                                source={{
                                                    uri: `${(FILE_URL || '').replace(/\/$/, '')}/uploads/${item.media[0].file_path.replace(/^\//, '')}?t=${Date.now()}`
                                                }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center bg-emerald-50">
                                                <Car size={64} color="#10B981" opacity={0.2} />
                                            </View>
                                        )}
                                        {/* Glassmorphism Badges */}
                                        <View className="absolute top-4 left-4 right-4 flex-row justify-between">
                                            <View className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                    {item.status}
                                                </Typography>
                                            </View>
                                            <View className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm">
                                                <Typography variant="caption" weight="bold" className="text-primary text-[10px]">
                                                    {item.tahun}
                                                </Typography>
                                            </View>
                                        </View>
                                        <View className="absolute bottom-4 left-4 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                                            <Typography variant="caption" weight="bold" className="text-white text-[10px]">
                                                {item.nomor_plat}
                                            </Typography>
                                        </View>
                                    </View>

                                    <View className="p-5">
                                        <View className="flex-row justify-between items-start mb-4">
                                            <View className="flex-1 mr-4">
                                                <Typography variant="h3" weight="bold" className="text-xl tracking-tight text-textMain">
                                                    {item.merek} {item.model}
                                                </Typography>
                                                <Typography variant="caption" className="text-textGray font-medium mt-1">
                                                    {item.transmisi} • {item.tipe_kepemilikan}
                                                </Typography>
                                            </View>
                                            <View className="items-end">
                                                <Typography variant="h3" weight="bold" className="text-primary text-xl">
                                                    {formatCurrency(item.total_modal || item.harga_beli)}
                                                </Typography>
                                                <Typography variant="caption" className="text-textGray mt-1">Estimasi Modal</Typography>
                                            </View>
                                        </View>

                                        <View className="flex-row items-center justify-between pt-4 border-t border-gray-50">
                                            <View className="flex-row items-center space-x-4">
                                                <View className="flex-row items-center">
                                                    <GaugeCircle size={14} color="#9CA3AF" />
                                                    <Typography className="ml-1.5 text-xs text-textGray font-bold">
                                                        {item.kilometer?.toLocaleString()} KM
                                                    </Typography>
                                                </View>
                                            </View>
                                            <View className="flex-row items-center space-x-3">
                                                {(item.status === 'tersedia' || item.status === 'booking') && (
                                                    <TouchableOpacity
                                                        className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center border border-emerald-100"
                                                        onPress={() => handlePresentSalesModal(item)}
                                                    >
                                                        <CircleDollarSign size={18} color="#10B981" />
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center border border-blue-100"
                                                    onPress={() => handlePresentCostModal(item)}
                                                >
                                                    <TrendingUp size={18} color="#3B82F6" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100"
                                                    onPress={() => handleDeleteMobil(item)}
                                                >
                                                    <Trash2 size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))
                    )}
                    <View className="h-32" />
                </ScrollView>

                {/* FAB matching Home */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePresentModalPress}
                    className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/30 border-4 border-white/20"
                >
                    <Plus size={32} color="white" strokeWidth={3} />
                </TouchableOpacity>

                {/* Hybrid UI Logic modals (Web & Native) unchanged for logic consistency */}
                {Platform.OS === 'web' ? (
                    <Modal visible={!!webModal} transparent animationType="slide" onRequestClose={() => setWebModal(null)}>
                        <View className="flex-1 justify-end bg-black/40">
                            <TouchableOpacity className="absolute inset-0" onPress={() => setWebModal(null)} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                                {webModal === 'new' && <MobilForm onSuccess={() => { setWebModal(null); refetch(); }} />}
                                {webModal === 'edit' && editingUnit && <MobilForm initialData={editingUnit} onSuccess={() => { setWebModal(null); refetch(); }} />}
                                {webModal === 'sales' && selectedUnitData && <MobilSalesForm unit={selectedUnitData} onSuccess={() => { setWebModal(null); refetch(); }} />}
                                {webModal === 'cost' && selectedUnitData && <MobilCostForm unit={selectedUnitData} onSuccess={() => { setWebModal(null); refetch(); }} />}
                                {webModal === 'detail' && selectedDetailUnit && <MobilDetail unit={selectedDetailUnit} onClose={() => setWebModal(null)} onSell={(u) => { setWebModal('sales'); setSelectedUnit(u); }} onEdit={() => { setWebModal('edit'); setEditingUnit(selectedDetailUnit); }} />}
                            </View>
                        </View>
                    </Modal>
                ) : (
                    <>
                        <BottomSheetModal ref={bottomSheetModalRef} index={0} snapPoints={snapPoints} enablePanDownToClose backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}>
                            <View className="flex-1">
                                <MobilForm onSuccess={() => { bottomSheetModalRef.current?.dismiss(); refetch(); }} />
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal ref={salesBottomSheetModalRef} index={0} snapPoints={snapPoints} enablePanDownToClose backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}>
                            <View className="flex-1">
                                {selectedUnitData && <MobilSalesForm unit={selectedUnitData} onSuccess={() => { salesBottomSheetModalRef.current?.dismiss(); refetch(); }} />}
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal ref={costBottomSheetModalRef} index={0} snapPoints={snapPoints} enablePanDownToClose backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}>
                            <View className="flex-1">
                                {selectedUnitData && <MobilCostForm unit={selectedUnitData} onSuccess={() => { costBottomSheetModalRef.current?.dismiss(); refetch(); }} />}
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal ref={detailBottomSheetModalRef} index={0} snapPoints={detailSnapPoints} enablePanDownToClose backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}>
                            <View className="flex-1">
                                {selectedDetailUnit && <MobilDetail unit={selectedDetailUnit} onClose={() => detailBottomSheetModalRef.current?.dismiss()} onSell={(u) => { detailBottomSheetModalRef.current?.dismiss(); handlePresentSalesModal(u); }} onEdit={() => { detailBottomSheetModalRef.current?.dismiss(); handlePresentEditModal(selectedDetailUnit); }} />}
                            </View>
                        </BottomSheetModal>
                        <BottomSheetModal ref={editBottomSheetModalRef} index={0} snapPoints={snapPoints} enablePanDownToClose backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}>
                            <View className="flex-1">
                                {editingUnit && <MobilForm initialData={editingUnit} onSuccess={() => { editBottomSheetModalRef.current?.dismiss(); refetch(); }} />}
                            </View>
                        </BottomSheetModal>
                    </>
                )}
            </View>
            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={closeDialog}
                onConfirm={dialogConfig.onConfirm}
                loading={actionLoading}
            />
        </BottomSheetModalProvider>
    );
}
