import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Platform, Modal, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Plus,
    Search,
    Truck,
    Clock,
    CheckCircle2,
    Users,
    Wallet,
    ArrowUpRight,
    MapPin,
    ArrowRight,
    RefreshCw,
    Edit,
    X,
    Trash2,
    Share2
} from 'lucide-react-native';
import { useRouter, router } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { formatCurrency, formatDate } from '../../utils/format';
import { Muatan, jasaAngkutService } from '../../services/jasaAngkut';
import { MuatanForm } from '../../components/jasa-angkut/MuatanForm';
import { useMuatanList, useMuatanSummary, useActiveArmada, usePayMuatanSplit } from '../../hooks/useJasaAngkut';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { RelatedBengkelTransactions } from '../../components/RelatedBengkelTransactions';
import { PaymentModal } from '../../components/PaymentModal';
import { formatNumber, parseNumber } from '../../utils/format';
import { FILE_URL } from '../../utils/api';

export default function JasaAngkutScreen() {

    // API Hooks
    const { data: muatanData, isLoading, refetch } = useMuatanList({ limit: 100 });
    const { data: summaryData } = useMuatanSummary();
    const { data: armadaData, isLoading: isLoadingArmada } = useActiveArmada();

    const [refreshing, setRefreshing] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState<Muatan | null>(null);
    const [view, setView] = useState<'form' | 'detail'>('form');
    const [groupBy, setGroupBy] = useState<'armada' | 'supir'>('armada');
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const recentTrips = useMemo(() => {
        let trips = muatanData?.data || [];
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            trips = trips.filter((t: any) =>
                t.asal?.toLowerCase().includes(query) ||
                t.tujuan?.toLowerCase().includes(query) ||
                t.supir_nama?.toLowerCase().includes(query) ||
                t.supir?.nama?.toLowerCase().includes(query) ||
                t.armada?.nama?.toLowerCase().includes(query) ||
                t.nopol?.toLowerCase().includes(query)
            );
        }
        return trips;
    }, [muatanData, searchQuery]);

    // Group trips by armada type OR driver
    const groupedTrips = useMemo(() => {
        const map = new Map<string, {
            key: string;
            id?: number;
            title: string;
            subtitle?: string;
            trips: any[];
            totalRitase: number;
            totalPendapatanTPM: number;
        }>();

        // Initialize with all Armadas if grouping by armada
        if (groupBy === 'armada' && armadaData) {
            for (const armada of armadaData) {
                const key = `armada-${armada.id}`;
                map.set(key, {
                    key,
                    id: armada.id,
                    title: armada.nama,
                    subtitle: armada.nopol || armada.jenis,
                    trips: [],
                    totalRitase: 0,
                    totalPendapatanTPM: 0,
                });
            }
        }

        for (const trip of recentTrips) {
            let key = '';
            let title = '';
            let subtitle = '';

            if (groupBy === 'armada') {
                if (trip.armada) {
                    key = `armada-${trip.armada.id}`;
                    title = trip.armada.nama;
                    subtitle = trip.armada.nopol || trip.armada.jenis;
                } else {
                    key = 'manual-armada';
                    title = 'Armada Luar';
                    subtitle = trip.nopol || 'Tanpa Nopol';
                }
            } else {
                // Group by Supir
                if (trip.supir_id || trip.supir) {
                    const supir = trip.supir;
                    key = `supir-${trip.supir_id}`;
                    title = supir?.nama || trip.supir_nama || 'Supir Terdaftar';
                    subtitle = supir?.kode || 'Staff';
                } else {
                    key = 'manual-supir';
                    title = trip.supir_nama || trip.supir_nama_manual || 'Supir Lepas';
                    subtitle = 'Manual';
                }
            }

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    id: groupBy === 'armada' ? trip.armada?.id : trip.supir_id,
                    title,
                    subtitle,
                    trips: [],
                    totalRitase: 0,
                    totalPendapatanTPM: 0,
                });
            }

            const group = map.get(key)!;
            group.trips.push(trip);
            group.totalRitase += Number(trip.ritase || 1);
            group.totalPendapatanTPM += Number(trip.pendapatan_kotor || 0) - Number(trip.laba_supir || 0);
        }

        const result = Array.from(map.values());

        // If searching, only return groups with trips (unless group title matches search)
        if (searchQuery) {
            return result.filter(g => g.trips.length > 0 || g.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return result.sort((a, b) => {
            // Priority: groups with trips, then sorted by name
            if (a.trips.length !== b.trips.length) return b.trips.length - a.trips.length;
            return a.title.localeCompare(b.title);
        });
    }, [recentTrips, groupBy, armadaData, searchQuery]);

    const toggleGroupCollapse = useCallback((key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

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

    const [actionLoading, setActionLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(-1);
    const [editData, setEditData] = useState<Muatan | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);


    const backendStats = summaryData || {};
    const stats = {
        total: backendStats.total_transaksi || 0,
        lunas: (backendStats.total_transaksi || 0) - (backendStats.hutang_supir_count || 0),
        pending: backendStats.hutang_supir_count || 0,
        revenue: backendStats.total_pendapatan || 0,
        profit: backendStats.laba_tpm || 0
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/home');
        }
    };

    const handleShareLink = async (trip: any) => {
        const shareUrl = `${FILE_URL}/api/v1/public/receipt/view/jasa_angkut/${trip.id}`;
        const shareMessage = `Halo, ini adalah rincian ritase/angkutan Anda di Tiga Putra Motor: ${shareUrl}`;

        try {
            if (Platform.OS === 'web' && !navigator.share) {
                // Fallback for web browser that doesn't support Web Share API
                await navigator.clipboard.writeText(shareMessage);
                setDialogConfig({
                    visible: true,
                    title: 'Berhasil',
                    message: 'Link struk telah disalin ke clipboard.',
                    variant: 'success',
                    type: 'alert'
                });
                return;
            }

            await Share.share({
                message: shareMessage,
                url: shareUrl,
                title: 'Bagikan Struk Digital'
            });
        } catch (error: any) {
            console.error('Error sharing link:', error);
            if (error?.message?.includes('not supported') || Platform.OS === 'web') {
                try {
                    await navigator.clipboard.writeText(shareMessage);
                    setDialogConfig({
                        visible: true,
                        title: 'Berhasil',
                        message: 'Link struk telah disalin ke clipboard.',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (clipError) {
                    console.error('Clipboard fallback also failed:', clipError);
                }
            }
        }
    };

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleFormSuccess = () => {
        handleCloseSheet();
        refetch();
    };

    const handlePresentModal = (type: 'form' | 'detail' | 'armada_detail', item?: any) => {
        if (type === 'armada_detail') {
            router.push(`/jasa-angkut/armada/detail/${item.id}`);
            return;
        }

        setView(type);

        if (type === 'form') setEditData(null);
        if (type === 'detail') setSelectedTrip(item);

        if (Platform.OS === 'web') {
            if (type === 'form') setIsFormOpen(true);
            else if (type === 'detail') setIsDetailOpen(true);
        } else {
            setSheetIndex(0);
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = useCallback(() => {
        if (Platform.OS === 'web') {
            setIsFormOpen(false);
            setIsDetailOpen(false);
        } else {
            bottomSheetRef.current?.close();
            setSheetIndex(-1);
        }
        setSelectedTrip(null);
        setEditData(null);
    }, []);

    const handleEdit = (item: Muatan) => {
        setEditData(item);
        if (Platform.OS === 'web') {
            setIsDetailOpen(false);
            setTimeout(() => setIsFormOpen(true), 100);
        } else {
            // For mobile bottom sheet, we just switch view state
            setView('form');
            // Ensure sheet is open
            bottomSheetRef.current?.expand();
        }
    };


    const handleDelete = (item: Muatan) => {
        setDialogConfig({
            visible: true,
            title: "Hapus Muatan",
            message: "Apakah Anda yakin ingin menghapus data muatan ini? Data yang dihapus tidak dapat dikembalikan.",
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    setActionLoading(true);

                    if (!onlineManager.isOnline()) {
                        jasaAngkutService.deleteMuatan(item.id);
                        handleCloseSheet();
                        refetch();
                        closeDialog();
                        Alert.alert('Offline Mode', 'Data muatan telah dijadwalkan untuk dihapus saat online.');
                        return;
                    }

                    await jasaAngkutService.deleteMuatan(item.id);
                    handleCloseSheet();
                    refetch();
                    closeDialog();
                } catch (error) {
                    console.error("Gagal menghapus:", error);
                    setTimeout(() => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: getErrorMessage(error, "Gagal menghapus data muatan"),
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

    const closeDialog = () => {
        setDialogConfig(prev => ({ ...prev, visible: false }));
    };

    function renderDetailContent(trip: Muatan) {
        const ScrollContainer = Platform.OS === 'web' ? ScrollView : BottomSheetScrollView;

        return (
            <ScrollContainer style={{ flex: 1 }}>
                <View className="p-8 pb-32">
                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{trip.tujuan}</Typography>
                            <Typography variant="body2" className="text-textGray mt-1">
                                #{trip.nomor_transaksi}
                            </Typography>
                        </View>
                        <Badge
                            label={trip.status_bayar.toUpperCase()}
                            variant={trip.status_bayar === 'LUNAS' ? 'success' : 'warning'}
                        />
                    </View>

                    <Card variant="outlined" className="p-6 border-gray-100 mb-6 bg-gray-50/50 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-primary uppercase tracking-widest">Informasi Rute</Typography>
                        <View className="flex-row items-center mb-4">
                            <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-4">
                                <MapPin size={20} color="#10B981" />
                            </View>
                            <View>
                                <Typography variant="caption" className="text-textGray">Titik Asal</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.asal}</Typography>
                            </View>
                        </View>
                        <View className="w-[1px] h-6 bg-gray-200 ml-5 my-1" />
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-secondary/10 rounded-xl items-center justify-center mr-4">
                                <MapPin size={20} color="#3B82F6" />
                            </View>
                            <View>
                                <Typography variant="caption" className="text-textGray">Tujuan Akhir</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.tujuan}</Typography>
                            </View>
                        </View>
                        <View className="mt-4 pt-4 border-t border-gray-100 flex-row justify-between">
                            <View>
                                <Typography variant="caption" className="text-textGray">Nama Supir</Typography>
                                <Typography weight="bold" className="text-textMain">{trip.supir_nama || trip.supir?.nama || trip.supir_nama_manual || '-'}</Typography>
                            </View>
                            <View className="items-end">
                                <Typography variant="caption" className="text-textGray">Tanggal Input</Typography>
                                <Typography weight="bold" className="text-textMain">{formatDate(trip.tanggal)}</Typography>
                            </View>
                        </View>
                    </Card>

                    {trip && <RelatedBengkelTransactions muatan_id={trip.id} />}

                    <Card variant="outlined" className="p-6 border-gray-100 mb-8 rounded-[32px]">
                        <Typography variant="caption" weight="bold" className="mb-4 text-slate-500 uppercase tracking-widest">Analisa Laba Rugi</Typography>
                        <View className="flex-row justify-between mb-3">
                            <Typography variant="body2" className="text-textGray">Pendapatan TPM (Gross)</Typography>
                            <Typography weight="bold" className="text-textMain">{formatCurrency(Number(trip.pendapatan_kotor) - Number(trip.laba_supir))}</Typography>
                        </View>

                        <View className="flex-row justify-between mb-3 bg-primary/5 p-3 rounded-xl mt-4">
                            <Typography variant="body2" weight="bold" className="text-primary text-[11px]">PENDAPATAN TPM (NET)</Typography>
                            <Typography weight="bold" className="text-primary">{formatCurrency(trip.laba_tpm)}</Typography>
                        </View>

                        {/* Driver share shown but secondary, as requested 'boleh di form' assuming detail is close to form context */}
                        <View className="flex-row justify-between px-3 py-1">
                            <Typography variant="caption" className="text-textGray/60">Hak Driver (Tidak Dicatat Kas)</Typography>
                            <Typography variant="caption" weight="bold" className="text-textGray/40">{formatCurrency(trip.laba_supir)}</Typography>
                        </View>
                    </Card>

                    <View className="space-y-4">
                        <Button
                            variant="outline"
                            title="Edit Muatan"
                            onPress={() => handleEdit(trip)}
                            className="rounded-2xl h-14"
                            icon={<Edit size={20} color="#023C69" />}
                        />
                        {trip.piutang_id && trip.status_bayar !== 'LUNAS' && (
                            <Button
                                title="Pelunasan / Bayar Cicilan"
                                onPress={() => setPaymentModalVisible(true)}
                                className="rounded-2xl h-14 bg-emerald-600"
                                icon={<RefreshCw size={20} color="white" />}
                            />
                        )}

                        <Button
                            variant="primary"
                            title="Bagikan Link Struk"
                            onPress={() => handleShareLink(trip)}
                            icon={<Share2 size={20} color="white" />}
                            className="rounded-2xl h-14 bg-[#00ADEF] shadow-lg shadow-[#00ADEF]/30"
                        />
                        <Button
                            variant="ghost"
                            title="Tutup Panel"
                            onPress={handleCloseSheet}
                            className="rounded-2xl h-12"
                        />
                    </View>
                </View>
            </ScrollContainer>
        );
    }


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
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
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Jasa Angkut</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Manajemen Ritase & Logistik</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => router.push('/jasa-angkut/armada')}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5 mr-2"
                        >
                            <Truck size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/jasa-angkut/supir')}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5 mr-2"
                        >
                            <Users size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onRefresh()}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <RefreshCw size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Main Insight Card (Glassmorphism) */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Profit TPM</Typography>
                        </View>
                        <Typography className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Stats Bulan Ini</Typography>
                    </View>
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter">
                                {formatCurrency(stats.profit)}
                            </Typography>
                            <Typography className="text-white/40 text-xs mt-1">Estimasi Laba Masuk</Typography>
                        </View>
                        <View className="bg-white/10 p-4 rounded-2xl border border-white/10">
                            <ArrowUpRight size={24} color="white" />
                        </View>
                    </View>

                    {/* Bento Stats Inside Header */}
                    <View className="h-[1px] bg-white/10 my-6" />
                    <View className="flex-row justify-between">
                        <View className="flex-1">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Trip</Typography>
                            <Typography weight="bold" className="text-white text-lg">{stats.total}</Typography>
                        </View>
                        <View className="flex-1 items-center border-x border-white/5">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Revenue</Typography>
                            <Typography weight="bold" className="text-white text-lg">{formatCurrency(stats.revenue)}</Typography>
                        </View>
                        <View className="flex-1 items-end">
                            <Typography className="text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest">Pending</Typography>
                            <Typography weight="bold" className="text-amber-400 text-lg">{stats.pending}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Floating Search & Filter Overlay */}
            {(!isFormOpen && !isDetailOpen && sheetIndex === -1) && (
                <View className="px-6 -mt-8 z-10">
                    <View className="bg-white p-3 rounded-[32px] shadow-2xl space-y-3 border border-gray-100">
                        {/* Search Input */}
                        <View className="flex-row items-center px-4 bg-gray-50 h-14 rounded-[20px] border border-gray-100">
                            <Search size={20} color="#6B7280" />
                            <TextInput
                                className="flex-1 ml-3 text-textMain text-sm font-medium h-full"
                                placeholder="Cari rute, supir, armada"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Clock size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter & Group Controls */}
                        <View className="flex-row items-center justify-between px-1">
                            <View className="flex-row bg-gray-100 p-1 rounded-2xl">
                                <TouchableOpacity
                                    onPress={() => setGroupBy('armada')}
                                    className={`px-4 py-2 rounded-xl flex-row items-center ${groupBy === 'armada' ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Truck size={14} color={groupBy === 'armada' ? '#023C69' : '#6B7280'} />
                                    <Typography variant="caption" weight={groupBy === 'armada' ? 'bold' : 'medium'} className={`ml-2 ${groupBy === 'armada' ? 'text-primary' : 'text-textGray'}`}>Armada</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setGroupBy('supir')}
                                    className={`px-4 py-2 rounded-xl flex-row items-center ${groupBy === 'supir' ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Users size={14} color={groupBy === 'supir' ? '#023C69' : '#6B7280'} />
                                    <Typography variant="caption" weight={groupBy === 'supir' ? 'bold' : 'medium'} className={`ml-2 ${groupBy === 'supir' ? 'text-primary' : 'text-textGray'}`}>Supir</Typography>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity className="flex-row items-center bg-gray-50 border border-gray-100 px-4 py-2 rounded-xl">
                                <Plus size={16} color="#023C69" />
                                <Typography variant="caption" weight="bold" className="ml-2 text-primary">Filter</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            <ScrollView
                className="flex-1 px-6 pt-10"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {/* Section Title */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="tracking-tight">Riwayat Ritase</Typography>
                        <Typography variant="caption" className="text-textGray mt-0.5">Aktivitas pemuatan terakhir</Typography>
                    </View>
                    <Badge variant="neutral" label="TERBARU" />
                </View>

                {/* Trip List Grouped by Armada */}
                {isLoading || isLoadingArmada ? (
                    <View className="space-y-6">
                        <SkeletonCard className="rounded-[32px] h-32" />
                        <SkeletonCard className="rounded-[32px] h-32" />
                        <SkeletonCard className="rounded-[32px] h-32" />
                    </View>
                ) : groupedTrips.length === 0 ? (
                    <View className="mt-10">
                        <EmptyState
                            title="Belum ada data"
                            description="Mulai catat transaksi muatan pertama Anda hari ini."
                            icon={Truck}
                        />
                    </View>
                ) : (
                    groupedTrips.map((group) => {
                        const isCollapsed = !collapsedGroups.has(group.key); // Changed logic to be collapsed by default
                        return (
                            <View key={group.key} className="mb-6">
                                {/* Group Header - Enhanced Card style */}
                                <TouchableOpacity
                                    onPress={() => toggleGroupCollapse(group.key)}
                                    activeOpacity={0.7}
                                    className={`bg-white p-5 rounded-[32px] border ${!isCollapsed ? 'border-primary shadow-lg shadow-primary/10' : 'border-gray-100 shadow-sm'} flex-row items-center justify-between`}
                                >
                                    <View className="flex-row items-center flex-1">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${groupBy === 'armada' ? (group.trips.length > 0 ? 'bg-primary/10 border-primary/10' : 'bg-gray-50 border-gray-100') : 'bg-orange-100 border-orange-200'}`}>
                                            {groupBy === 'armada' ? <Truck size={22} color={!isCollapsed ? '#023C69' : '#94A3B8'} /> : <Users size={22} color="#C2410C" />}
                                        </View>
                                        <View className="flex-1">
                                            <Typography weight="bold" className={`text-base tracking-tight ${!isCollapsed ? 'text-primary' : 'text-textMain'}`}>
                                                {group.title}
                                            </Typography>
                                            <Typography variant="caption" className="text-textGray">
                                                {group.subtitle ? `${group.subtitle} • ` : ''}{group.trips.length} Transaksi
                                            </Typography>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center">
                                        {group.trips.length > 0 && (
                                            <View className="bg-primary/5 px-3 py-1.5 rounded-full mr-3 border border-primary/5">
                                                <Typography variant="caption" weight="bold" className="text-primary text-[10px]">
                                                    {formatCurrency(group.totalPendapatanTPM)}
                                                </Typography>
                                            </View>
                                        )}
                                        {groupBy === 'armada' && group.id && (
                                            <TouchableOpacity
                                                onPress={() => handlePresentModal('armada_detail', { id: group.id })}
                                                className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-2 border border-gray-100"
                                            >
                                                <ArrowUpRight size={18} color="#023C69" />
                                            </TouchableOpacity>
                                        )}
                                        <ChevronLeft
                                            size={20}
                                            color={!isCollapsed ? "#023C69" : "#9CA3AF"}
                                            style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '90deg' }] }}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {/* Group Content (Trips) */}
                                {!isCollapsed && (
                                    <View className="space-y-4 pt-4 px-2">
                                        {group.trips.length === 0 ? (
                                            <View className="py-4 items-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 ml-4">
                                                <Typography variant="caption" className="text-gray-400 italic">Belum ada aktivitas transaksi</Typography>
                                            </View>
                                        ) : (
                                            group.trips.map((trip: any) => (
                                                <TouchableOpacity
                                                    key={trip.id}
                                                    onPress={() => handlePresentModal('detail', trip)}
                                                    activeOpacity={0.9}
                                                    className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex-row items-center ml-4"
                                                >
                                                    {/* Visual ID Slot - Smaller for nested items */}
                                                    <View className="w-12 h-12 bg-gray-50 rounded-[16px] items-center justify-center mr-4 border border-gray-100">
                                                        <MapPin size={20} color="#6B7280" />
                                                    </View>

                                                    <View className="flex-1">
                                                        {/* Main Info + Status */}
                                                        <View className="flex-row items-center justify-between mb-1">
                                                            <View className="flex-1 mr-2 flex-row items-center">
                                                                <Typography variant="body2" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                                                    {trip.asal} → {trip.tujuan}
                                                                </Typography>
                                                                <View className="mx-2 w-1 h-1 bg-gray-300 rounded-full" />
                                                                <Typography variant="caption" weight="bold" className="text-primary italic">
                                                                    {trip.ritase} Rit
                                                                </Typography>
                                                            </View>
                                                            <View className={trip.status_bayar === 'LUNAS' ? "bg-emerald-50 px-2 py-0.5 rounded-lg" : "bg-amber-50 px-2 py-0.5 rounded-lg"}>
                                                                <Typography weight="bold" className={trip.status_bayar === 'LUNAS' ? "text-emerald-600 text-[9px]" : "text-amber-600 text-[9px]"}>
                                                                    {trip.status_bayar.toUpperCase()}
                                                                </Typography>
                                                            </View>
                                                        </View>

                                                        {/* Trip Details */}
                                                        <Typography variant="caption" className="text-textGray mb-2 text-xs">
                                                            {trip.supir_nama || trip.supir_nama_manual} • {trip.jenis_muatan || 'Muatan Umum'}
                                                        </Typography>

                                                        {/* Footer Row */}
                                                        <View className="flex-row items-center justify-between pt-2 border-t border-gray-50/50">
                                                            <View className="flex-row items-center">
                                                                <Clock size={10} color="#9CA3AF" />
                                                                <Typography className="text-textGray/60 text-[9px] ml-1 font-bold uppercase tracking-widest">
                                                                    {formatDate(trip.tanggal)}
                                                                </Typography>
                                                            </View>
                                                            <Typography weight="bold" className="text-primary text-xs">
                                                                {formatCurrency(Number(trip.pendapatan_kotor) - Number(trip.laba_supir))}
                                                            </Typography>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
                <View className="h-32" />
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity
                onPress={() => handlePresentModal('form')}
                activeOpacity={0.8}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary border-4 border-white/20"
            >
                <Plus size={32} color="white" strokeWidth={3} />
            </TouchableOpacity>

            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <>
                    <Modal visible={isFormOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <TouchableOpacity className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <MuatanForm onSuccess={handleFormSuccess} initialData={editData} />
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={isDetailOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <TouchableOpacity className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                {selectedTrip && renderDetailContent(selectedTrip)}
                            </View>
                        </View>
                    </Modal>

                </>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={sheetIndex}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onChange={setSheetIndex}
                >
                    <View style={{ flex: 1 }}>
                        {view === 'form' ? (
                            <MuatanForm onSuccess={handleFormSuccess} initialData={editData} />
                        ) : selectedTrip ? (
                            renderDetailContent(selectedTrip)
                        ) : null}
                    </View>
                </BottomSheet>
            )}


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

            {selectedTrip && selectedTrip.piutang_id && (
                <PaymentModal
                    visible={paymentModalVisible}
                    onClose={() => setPaymentModalVisible(false)}
                    onSuccess={() => {
                        setDialogConfig({
                            visible: true,
                            title: 'Sukses',
                            message: 'Pembayaran berhasil dicatat',
                            variant: 'success',
                            type: 'alert'
                        });
                        refetch();
                        handleCloseSheet();
                    }}
                    id={selectedTrip.piutang_id}
                    initialAmount={Number(selectedTrip.pendapatan_kotor) - Number(selectedTrip.laba_supir) - Number(selectedTrip.jumlah_bayar || 0)}
                    title="Pelunasan Jasa Angkut"
                    allowedMethods={['TUNAI', 'TRANSFER']}
                />
            )}

        </View>
    );
}
