import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
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
    Trash2,
    X
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import BottomSheet, { BottomSheetView, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MobilForm } from '../../components/MobilForm';
import { MobilDetail } from '../../components/MobilDetail';
import { MobilSalesForm } from '../../components/MobilSalesForm';
import { MobilCostForm } from '../../components/MobilCostForm';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { format, startOfMonth, isValid, parse } from 'date-fns';
import { useMobilList, useDeleteMobil, usePenjualanSummary } from '../../hooks/useMobil';
import { FILE_URL } from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import { useKasBankBalances } from '../../hooks/useKeuangan';
import { Platform, Modal } from 'react-native';

export default function MobilInventoryScreen() {
    const router = useRouter();
    // Filters
    const [dateRange, setDateRange] = useState({
        dari: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        sampai: format(new Date(), 'yyyy-MM-dd')
    });
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [tempDateRange, setTempDateRange] = useState({ ...dateRange });
    const dateSheetRef = useRef<BottomSheetModal>(null);
    const dateSnapPoints = useMemo(() => ['50%', '75%'], []);

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

    // API Hooks
    const { data, isLoading, refetch } = useMobilList({
        status: activeTab,
        search: searchQuery,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 15000 // Polling every 15 seconds
    });

    const { data: summaryData, refetch: refetchSummary } = usePenjualanSummary({
        search: searchQuery,
        tanggal_dari: dateRange.dari,
        tanggal_sampai: dateRange.sampai
    }, {
        refetchInterval: 15000 // Polling every 15 seconds
    });

    const { data: balancesData } = useKasBankBalances();
    const unitBalance = balancesData?.kas_unit_mobil?.saldo || 0;

    const deleteMutation = useDeleteMobil();

    const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'LUNAS' | 'PARTIAL' | 'UNPAID' | 'BATAL'>('ALL');

    const mobilsData = data?.data || [];

    const stats = useMemo(() => {
        if (summaryData) {
            return {
                total: summaryData.total_transaksi || 0,
                lunas: summaryData.lunas_count || 0,
                partial: summaryData.partial_count || 0,
                unpaid: summaryData.unpaid_count || 0,
                batal: summaryData.batal_count || 0,
                total_penjualan: summaryData.total_penjualan || 0,
                laba_tpm: summaryData.total_laba_tpm || 0,
                saldo_bop: summaryData.saldo_bop || 0
            };
        }
        return { total: 0, lunas: 0, partial: 0, unpaid: 0, batal: 0, total_penjualan: 0, laba_tpm: 0, saldo_bop: 0 };
    }, [summaryData]);

    const mobils = useMemo(() => {
        let result = mobilsData;
        if (paymentFilter === 'LUNAS') {
            result = result.filter((m: any) => m.status_bayar === 'lunas' || m.status_bayar === 'LUNAS');
        } else if (paymentFilter === 'PARTIAL') {
            result = result.filter((m: any) =>
                (m.status_bayar === 'belum_lunas' || m.status_bayar === 'BELUM_LUNAS' || m.status_bayar === 'cicilan' || m.status_bayar === 'CICILAN') &&
                (Number(m.dp || 0) > 0)
            );
        } else if (paymentFilter === 'UNPAID') {
            result = result.filter((m: any) =>
                (m.status_bayar === 'belum_lunas' || m.status_bayar === 'BELUM_LUNAS') &&
                (Number(m.dp || 0) === 0)
            );
        } else if (paymentFilter === 'BATAL') {
            result = result.filter((m: any) => m.status_bayar === 'batal' || m.status_bayar === 'BATAL');
        }
        return result;
    }, [mobilsData, paymentFilter]);


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

                    if (!onlineManager.isOnline()) {
                        deleteMutation.mutate(unit.id);
                        refetch();
                        closeDialog();
                        Alert.alert('Offline Mode', 'Unit mobil telah dijadwalkan untuk dihapus saat online.');
                        return;
                    }

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

    const handleApplyDate = () => {
        const dariValid = isValid(parse(tempDateRange.dari, 'yyyy-MM-dd', new Date()));
        const sampaiValid = isValid(parse(tempDateRange.sampai, 'yyyy-MM-dd', new Date()));

        if (!dariValid || !sampaiValid) {
            Alert.alert('Kesalahan', 'Format tanggal tidak valid (Gunakan YYYY-MM-DD)');
            return;
        }

        setDateRange(tempDateRange);
        setIsDateModalVisible(false);
        if (Platform.OS !== 'web') {
            dateSheetRef.current?.dismiss();
        }
    };

    const renderDateContent = () => (
        <View className="p-0">
            <Typography className="text-gray-400 text-[10px] uppercase font-bold mb-4 ml-1">Rentang Tanggal</Typography>
            <View className="space-y-4">
                <View>
                    <Typography variant="caption" className="text-gray-500 mb-1 ml-1">Dari Tanggal</Typography>
                    <TextInput
                        className="bg-gray-50 h-12 px-4 rounded-xl border border-gray-100 text-sm font-bold text-primary"
                        value={tempDateRange.dari}
                        onChangeText={(v) => setTempDateRange({ ...tempDateRange, dari: v })}
                        placeholder="YYYY-MM-DD"
                    />
                </View>
                <View>
                    <Typography variant="caption" className="text-gray-500 mb-1 ml-1">Sampai Tanggal</Typography>
                    <TextInput
                        className="bg-gray-50 h-12 px-4 rounded-xl border border-gray-100 text-sm font-bold text-primary"
                        value={tempDateRange.sampai}
                        onChangeText={(v) => setTempDateRange({ ...tempDateRange, sampai: v })}
                        placeholder="YYYY-MM-DD"
                    />
                </View>
            </View>

            <View className="flex-row mt-8 space-x-3 pb-8">
                <View className="flex-1">
                    <Button
                        variant="outline"
                        title="Batal"
                        onPress={() => {
                            setIsDateModalVisible(false);
                            if (Platform.OS !== 'web') dateSheetRef.current?.dismiss();
                        }}
                    />
                </View>
                <View className="flex-1">
                    <Button
                        title="Terapkan"
                        onPress={handleApplyDate}
                    />
                </View>
            </View>
        </View>
    );

    const unitStats = useMemo(() => {
        return {
            total: mobilsData.length,
            tersedia: mobilsData.filter((m: any) => m.status === 'tersedia').length,
            terjual: mobilsData.filter((m: any) => m.status === 'terjual').length
        };
    }, [mobilsData]);

    return (
        <BottomSheetModalProvider>
            <View className="flex-1 bg-surface">
                <StatusBar barStyle="light-content" />

                {/* Header Section (Home Style) */}
                <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-row items-center">
                            <Pressable
                                onPress={handleGoBack}
                                className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                            >
                                <ChevronLeft size={24} color="white" />
                            </Pressable>
                            <View>
                                <View className="flex-row items-center">
                                    <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Unit Mobil</Typography>
                                    <View className="bg-white/20 px-2 py-0.5 rounded-lg ml-3 flex-row items-center border border-white/10 shadow-sm">
                                        <View className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 shadow-sm" />
                                        <Typography className="text-white text-[10px] font-bold">{formatCurrency(unitBalance)}</Typography>
                                    </View>
                                </View>
                                <Typography className="text-white/50 text-xs mt-0.5">Manajemen Inventaris & Penjualan</Typography>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => router.push({ pathname: '/laporan/pembelian-mobil' })}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <TrendingUp size={20} color="white" />
                        </Pressable>
                    </View>

                    {/* Row 1: Operational Status (Inventory) */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="flex-row -mx-6 px-6 mb-4"
                    >
                        {[
                            { label: 'Total Unit', key: 'total', value: unitStats.total, color: 'white' },
                            { label: 'Tersedia', key: 'tersedia', value: unitStats.tersedia, color: '#10B981' },
                            { label: 'Terjual', key: 'terjual', value: unitStats.terjual, color: '#3B82F6' },
                        ].map((stat, idx) => (
                            <View
                                key={stat.key}
                                style={{ width: 100 }}
                                className={`bg-white/10 p-4 rounded-[24px] border border-white/5 mr-2`}
                            >
                                <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1" numberOfLines={1}>{stat.label}</Typography>
                                <View className="flex-row items-baseline">
                                    <Typography weight="bold" style={{ color: stat.color }} className="text-xl">{stat.value || 0}</Typography>
                                    <Typography className="text-white/30 text-[8px] ml-1 font-bold">UNIT</Typography>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Row 2: Financial/Payment Summary (Total, Lunas, etc) */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="flex-row -mx-6 px-6"
                    >
                        {[
                            { label: 'Total', key: 'total_trx', value: stats.total, unit: 'TRX', color: 'white' },
                            { label: 'Lunas', key: 'lunas', value: stats.lunas, unit: 'TRX', color: '#10B981' },
                            { label: 'Belum Lunas', key: 'partial', value: stats.partial, unit: 'TRX', color: '#3B82F6' },
                            { label: 'Belum Bayar', key: 'unpaid', value: stats.unpaid, unit: 'TRX', color: '#F59E0B' },
                            { label: 'Batal', key: 'batal', value: stats.batal, unit: 'TRX', color: '#EF4444' },
                        ].map((stat, idx) => (
                            <View
                                key={stat.key}
                                style={{ width: 100 }}
                                className={`bg-white/10 p-4 rounded-[24px] border border-white/5 mr-2`}
                            >
                                <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1" numberOfLines={1}>{stat.label}</Typography>
                                <View className="flex-row items-baseline">
                                    <Typography weight="bold" style={{ color: stat.color }} className="text-xl">{stat.value || 0}</Typography>
                                    {stat.unit ? (
                                        <Typography className="text-white/30 text-[8px] ml-1 font-bold">{stat.unit}</Typography>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Filters & Search - Floating Overlay */}
                <View className="px-6 -mt-8 z-10">
                    <View className="bg-white p-3 rounded-[32px] shadow-2xl space-y-3 border border-gray-100">
                        <View className="flex-row items-center px-4 bg-gray-50 h-14 rounded-[20px] border border-gray-100">
                            <Search size={20} color="#6B7280" />
                            <TextInput
                                className="flex-1 ml-3 text-textMain text-sm font-medium h-full"
                                placeholder="Cari unit..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        {/* Payment Filter Chips (Row 2 logic matched) */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                            <Pressable
                                onPress={() => setPaymentFilter('ALL')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'ALL' ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'ALL' ? 'text-white' : 'text-gray-500'}>
                                    Semua ({stats.total})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('LUNAS')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'LUNAS' ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-50 border-emerald-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'LUNAS' ? 'text-white' : 'text-emerald-700'}>
                                    Lunas ({stats.lunas})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('PARTIAL')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'PARTIAL' ? 'bg-blue-500 border-blue-500' : 'bg-blue-50 border-blue-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'PARTIAL' ? 'text-white' : 'text-blue-700'}>
                                    Belum Lunas ({stats.partial})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('UNPAID')}
                                className={`px-4 py-1.5 rounded-full border mr-2 ${paymentFilter === 'UNPAID' ? 'bg-amber-500 border-amber-500' : 'bg-amber-50 border-amber-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'UNPAID' ? 'text-white' : 'text-amber-700'}>
                                    Belum Bayar ({stats.unpaid})
                                </Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentFilter('BATAL')}
                                className={`px-4 py-1.5 rounded-full border ${paymentFilter === 'BATAL' ? 'bg-rose-500 border-rose-500' : 'bg-rose-50 border-rose-200'}`}
                            >
                                <Typography variant="caption" weight="bold" className={paymentFilter === 'BATAL' ? 'text-white' : 'text-rose-700'}>
                                    Batal ({stats.batal})
                                </Typography>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>

                {/* Tabs */}
                <View className="flex-row px-6 mt-6 mb-2 space-x-2">
                    {['tersedia', 'booking', 'terjual'].map((tab) => (
                        <Pressable
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            className={`px-5 py-2.5 rounded-2xl border ${activeTab === tab ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white border-gray-100'}`}
                        >
                            <Typography className={`capitalize text-xs font-bold ${activeTab === tab ? 'text-white' : 'text-gray-500'}`}>
                                {tab}
                            </Typography>
                        </Pressable>
                    ))}
                </View>

                <ScrollView
                    className="flex-1 px-6 pt-4"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isLoading && mobils.length > 0} onRefresh={refetch} colors={['#023C69']} />
                    }
                >
                    {/* Date Filter Selection */}
                    <Pressable
                        onPress={() => {
                            setTempDateRange(dateRange);
                            setIsDateModalVisible(true);
                            if (Platform.OS === 'web') {
                                // Handled by state
                            } else {
                                dateSheetRef.current?.present();
                            }
                        }}
                        className="flex-row items-center justify-between mb-8 bg-white p-4 rounded-[24px] shadow-sm border border-gray-100"
                    >
                        <View className="flex-row items-center">
                            <Calendar size={18} color="#023C69" />
                            <Typography className="text-gray-800 text-xs font-bold ml-3">{dateRange.dari} s/d {dateRange.sampai}</Typography>
                        </View>
                        <View className="bg-primary/5 px-2 py-1 rounded-lg">
                            <Typography className="text-primary text-[10px] font-bold">Ubah Periode</Typography>
                        </View>
                    </Pressable>

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
                            <Pressable
                                key={item.id}
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
                                        <View className="absolute top-4 left-4 right-4 flex-row justify-between flex-wrap gap-2">
                                            <View className="flex-row gap-2">
                                                <View className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                    <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                        {item.status}
                                                    </Typography>
                                                </View>
                                                {item.status_bayar_beli !== 'LUNAS' && (
                                                    <View className="bg-rose-600/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                        <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                            HUTANG
                                                        </Typography>
                                                    </View>
                                                )}
                                                {item.status === 'booking' && (
                                                    <View className="bg-amber-500/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                                        <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                                            PIUTANG
                                                        </Typography>
                                                    </View>
                                                )}
                                            </View>
                                            <View className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm self-start">
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
                                                    {formatCurrency(Number(item.harga_beli || 0) + Number(item.total_biaya || 0) + Number(item.total_part_service || 0))}
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
                                                    <Pressable
                                                        className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center border border-emerald-100"
                                                        onPress={() => handlePresentSalesModal(item)}
                                                    >
                                                        <CircleDollarSign size={18} color="#10B981" />
                                                    </Pressable>
                                                )}
                                                <Pressable
                                                    className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center border border-blue-100"
                                                    onPress={() => handlePresentCostModal(item)}
                                                >
                                                    <TrendingUp size={18} color="#3B82F6" />
                                                </Pressable>
                                                <Pressable
                                                    className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100"
                                                    onPress={() => handleDeleteMobil(item)}
                                                >
                                                    <Trash2 size={18} color="#EF4444" />
                                                </Pressable>
                                            </View>
                                        </View>
                                    </View>
                                </Card>
                            </Pressable>
                        ))
                    )}
                    <View className="h-32" />
                </ScrollView>

                {/* FAB matching Home */}
                <Pressable
                    onPress={handlePresentModalPress}
                    className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/30 border-4 border-white/20"
                >
                    <Plus size={32} color="white" strokeWidth={3} />
                </Pressable>

                {/* Hybrid UI Logic modals (Web & Native) unchanged for logic consistency */}
                {Platform.OS === 'web' ? (
                    <Modal visible={!!webModal} transparent animationType="slide" onRequestClose={() => setWebModal(null)}>
                        <View className="flex-1 justify-end bg-black/40">
                            <Pressable className="absolute inset-0" onPress={() => setWebModal(null)} />
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
                        <BottomSheetModal
                            ref={dateSheetRef}
                            index={0}
                            snapPoints={dateSnapPoints}
                            enablePanDownToClose
                            backdropComponent={(props) => <View {...props} className="absolute inset-0 bg-black/50" />}
                            onDismiss={() => setIsDateModalVisible(false)}
                        >
                            <BottomSheetView className="flex-1 px-8 py-2">
                                <Typography variant="h2" weight="bold" className="mb-6">Pilih Periode</Typography>
                                {renderDateContent()}
                            </BottomSheetView>
                        </BottomSheetModal>
                    </>
                )}

                {/* Date Modal for Web */}
                {Platform.OS === 'web' && isDateModalVisible && (
                    <Modal visible={true} transparent animationType="fade">
                        <View className="flex-1 bg-black/50 justify-center items-center p-6">
                            <View className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
                                <View className="flex-row justify-between items-center mb-6">
                                    <Typography variant="h2" weight="bold">Pilih Periode</Typography>
                                    <Pressable onPress={() => setIsDateModalVisible(false)}>
                                        <X size={24} color="#6B7280" />
                                    </Pressable>
                                </View>
                                {renderDateContent()}
                            </View>
                        </View>
                    </Modal>
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
