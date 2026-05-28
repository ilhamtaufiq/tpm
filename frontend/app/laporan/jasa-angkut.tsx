import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, ScrollView, Pressable, StatusBar,
    RefreshControl as RNRefreshControl, ActivityIndicator,
    TextInput, Platform, Alert, Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft, ChevronRight, Calendar, Truck,
    TrendingUp, Search, User, ArrowUpRight, BarChart3,
    ArrowRight, Clock, Wallet, MapPin, X, Fuel,
    Receipt, Utensils, ParkingSquare, MoreHorizontal,
    Percent, Users, ChevronDown, Plus, Printer,
    Download, Eye, Share2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { jasaAngkutService } from '../../services/jasaAngkut';
import { formatCurrency, formatDate } from '../../utils/format';
import { printReportHTML } from '../../utils/printReport';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useActiveArmada } from '../../hooks/useJasaAngkut';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

type FilterType = 'daily' | 'monthly' | 'yearly';

export default function JasaAngkutReportScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [filterType, setFilterType] = useState<FilterType>('monthly');
    const [date, setDate] = useState(new Date());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [summary, setSummary] = useState<any>(null);
    const [trips, setTrips] = useState<any[]>([]);

    const [groupBy, setGroupBy] = useState<'armada' | 'supir'>('armada');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const { data: armadaData, isLoading: isLoadingArmada } = useActiveArmada();

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

        for (const trip of trips) {
            let key = '';
            let title = '';
            let subtitle = '';

            if (groupBy === 'armada') {
                if (trip.armada) {
                    key = `armada-${trip.armada.id}`;
                    title = trip.armada.nama;
                    subtitle = trip.armada.nopol || trip.armada.jenis;
                } else if (trip.armada_id) {
                    key = `armada-${trip.armada_id}`;
                    title = trip.armada_nama || 'Armada Terdaftar';
                    subtitle = trip.nopol || '';
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
                    title = (trip.supir_nama || trip.supir_nama_manual) || 'Supir Lepas';
                    subtitle = 'Manual';
                }
            }

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    id: groupBy === 'armada' ? (trip.armada?.id || trip.armada_id) : trip.supir_id,
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
        if (search) {
            return result.filter(g => g.trips.length > 0 || g.title.toLowerCase().includes(search.toLowerCase()));
        }

        return result.sort((a, b) => {
            // Priority: groups with trips, then sorted by name
            if (a.trips.length !== b.trips.length) return b.trips.length - a.trips.length;
            return a.title.localeCompare(b.title);
        });
    }, [trips, groupBy, armadaData, search]);

    const toggleGroupCollapse = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Detail Modal State
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%', '92%'], []);
    const [selectedTrip, setSelectedTrip] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let dari, sampai;
            if (filterType === 'daily') {
                dari = format(date, 'yyyy-MM-dd');
                sampai = dari;
            } else if (filterType === 'monthly') {
                dari = format(startOfMonth(date), 'yyyy-MM-dd');
                sampai = format(endOfMonth(date), 'yyyy-MM-dd');
            } else {
                dari = format(startOfYear(date), 'yyyy-MM-dd');
                sampai = format(endOfYear(date), 'yyyy-MM-dd');
            }

            const [summaryData, listData] = await Promise.all([
                jasaAngkutService.getMuatanSummary({
                    tanggal_dari: dari,
                    tanggal_sampai: sampai
                }),
                jasaAngkutService.getMuatanList({
                    search,
                    tanggal_dari: dari,
                    tanggal_sampai: sampai,
                    limit: 100
                })
            ]);

            setSummary(summaryData);
            setTrips(listData?.data || []);
        } catch (error) {
            console.error('Error fetching jasa angkut report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [search, date, filterType]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handlePrev = () => {
        if (filterType === 'daily') setDate(curr => subDays(curr, 1));
        else if (filterType === 'monthly') setDate(curr => subMonths(curr, 1));
        else setDate(curr => subYears(curr, 1));
    };

    const handleNext = () => {
        if (filterType === 'daily') setDate(curr => addDays(curr, 1));
        else if (filterType === 'monthly') setDate(curr => addMonths(curr, 1));
        else setDate(curr => addYears(curr, 1));
    };

    const getFormattedDate = () => {
        if (filterType === 'daily') return format(date, 'dd MMMM yyyy', { locale: localeID });
        if (filterType === 'monthly') return format(date, 'MMMM yyyy', { locale: localeID });
        return format(date, 'yyyy', { locale: localeID });
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/laporan');
        }
    };

    const handlePressTrip = async (item: any) => {
        setSelectedTrip(item);
        bottomSheetModalRef.current?.present();
        setDetailLoading(true);
        try {
            const detail = await jasaAngkutService.getMuatan(item.id);
            setSelectedTrip(detail);
        } catch (error) {
            console.error('Failed to fetch trip detail:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCloseModal = () => {
        bottomSheetModalRef.current?.dismiss();
    };

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Adaptive Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <View className="flex-row items-center mb-0.5">
                                <View className="w-1.5 h-1.5 rounded-full bg-secondary mr-2" />
                                <Typography className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Laporan Ritase</Typography>
                            </View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Jasa Angkut</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center">
                        <View className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10 mr-2">
                            <Typography className="text-white uppercase text-[8px] font-bold tracking-widest">REAL-TIME</Typography>
                        </View>
                        <Pressable
                            onPress={() => setShowExportMenu(true)}
                            disabled={isExporting}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <Download size={22} color="white" />
                        </Pressable>
                    </View>
                </View>

                {/* Main Bento Stats Row */}
                <View className="flex-row justify-between mb-4">
                    <View className="flex-[1.5] bg-white/10 p-5 rounded-[28px] border border-white/5 mr-3">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Total Laba TPM</Typography>
                        <View className="flex-row items-end">
                            <Typography className="text-white/60 text-xs font-bold mb-1 mr-1">Rp</Typography>
                            <Typography weight="bold" className="text-white text-2xl tracking-tighter">
                                {formatCurrency(summary?.laba_tpm || 0).replace('Rp', '').trim()}
                            </Typography>
                        </View>
                        <View className="flex-row items-center mt-2">
                            <View className="bg-emerald-500/20 flex-row items-center px-2 py-0.5 rounded-lg mr-2">
                                <ArrowUpRight size={10} color="#10B981" />
                                <Typography className="text-emerald-400 text-[10px] font-bold ml-1">Positive</Typography>
                            </View>
                        </View>
                    </View>
                    <View className="flex-1 bg-white/10 p-5 rounded-[28px] border border-white/5">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1">Total Ritase</Typography>
                        <Typography weight="bold" className="text-white text-3xl tracking-tighter">{summary?.total_transaksi || 0}</Typography>
                        <Typography className="text-white/30 text-[10px] mt-1">Trip Selesai</Typography>
                    </View>
                </View>

                {/* Secondary Stats Cards */}
                <View className="flex-row justify-between">
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5 mr-3">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-blue-500/20 rounded-md items-center justify-center mr-2">
                                <TrendingUp size={12} color="#3B82F6" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Pendapatan TPM</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-sm">
                            {formatCurrency(summary?.total_pendapatan || 0)}
                        </Typography>
                    </View>
                    <View className="flex-1 bg-white/5 p-4 rounded-[24px] border border-white/5">
                        <View className="flex-row items-center mb-1">
                            <View className="w-5 h-5 bg-red-500/20 rounded-md items-center justify-center mr-2">
                                <Wallet size={12} color="#EF4444" />
                            </View>
                            <Typography className="text-white/40 text-[9px] uppercase font-bold">Piutang Supir</Typography>
                        </View>
                        <Typography weight="bold" className="text-white text-sm">
                            {formatCurrency(summary?.total_hutang_supir || 0)}
                        </Typography>
                    </View>
                </View>
            </View>

            {/* Date Filter & Search Section (Floating Pattern) */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-4 rounded-[32px] shadow-xl border border-gray-50">
                    <View className="flex-row bg-gray-50 p-1 rounded-2xl mb-4">
                        {(['daily', 'monthly', 'yearly'] as FilterType[]).map((type) => (
                            <Pressable
                                key={type}
                                onPress={() => {
                                    setFilterType(type);
                                    setDate(new Date());
                                }}
                                className={`flex-1 py-2.5 items-center rounded-xl ${filterType === type ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={filterType === type ? 'text-primary' : 'text-gray-400'}
                                >
                                    {type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                                </Typography>
                            </Pressable>
                        ))}
                    </View>

                    <View className="flex-row justify-between items-center px-2 mb-4">
                        <Pressable
                            onPress={handlePrev}
                            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                        >
                            <ChevronLeft size={20} color="#1C1C1C" />
                        </Pressable>

                        <View className="flex-row items-center">
                            <Calendar size={18} color="#023C69" className="mr-2" />
                            <Typography variant="body1" weight="bold" className="text-textMain">
                                {getFormattedDate()}
                            </Typography>
                        </View>

                        <Pressable
                            onPress={handleNext}
                            className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                        >
                            <ChevronRight size={20} color="#1C1C1C" />
                        </Pressable>
                    </View>

                    {/* Search Field */}
                    <View className="flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100 mb-3">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            placeholder="Cari rute, supir, muatan..."
                            className="flex-1 ml-3 text-sm font-medium"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {/* Group Controls (Added to match list) */}
                    <View className="flex-row items-center justify-between px-1">
                        <View className="flex-row bg-gray-100 p-1 rounded-2xl flex-1">
                            <Pressable
                                onPress={() => setGroupBy('armada')}
                                className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${groupBy === 'armada' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Truck size={14} color={groupBy === 'armada' ? '#023C69' : '#6B7280'} />
                                <Typography variant="caption" weight={groupBy === 'armada' ? 'bold' : 'medium'} className={`ml-2 ${groupBy === 'armada' ? 'text-primary' : 'text-textGray'}`}>Armada</Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setGroupBy('supir')}
                                className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${groupBy === 'supir' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Users size={14} color={groupBy === 'supir' ? '#023C69' : '#6B7280'} />
                                <Typography variant="caption" weight={groupBy === 'supir' ? 'bold' : 'medium'} className={`ml-2 ${groupBy === 'supir' ? 'text-primary' : 'text-textGray'}`}>Supir</Typography>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />
                }
            >
                {/* Section Header */}
                <View className="flex-row items-center justify-between mb-6 px-1">
                    <View className="flex-row items-center">
                        <View className="w-1.5 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Riwayat Ritase</Typography>
                    </View>
                    <View className="bg-gray-100 px-3 py-1 rounded-full">
                        <Typography variant="caption" className="text-textGray font-bold">{trips.length} Data</Typography>
                    </View>
                </View>

                {isLoading || isLoadingArmada ? (
                    <View className="space-y-6">
                        <SkeletonCard className="rounded-[32px] h-32" />
                        <SkeletonCard className="rounded-[32px] h-32" />
                        <SkeletonCard className="rounded-[32px] h-32" />
                    </View>
                ) : groupedTrips.length === 0 ? (
                    <View className="mt-10">
                        <EmptyState
                            title="Data Kosong"
                            description="Tidak ada transaksi ritase ditemukan pada periode ini."
                            icon={Truck}
                        />
                    </View>
                ) : (
                    groupedTrips.map((group) => {
                        const isCollapsed = !collapsedGroups.has(group.key);
                        return (
                            <View key={group.key} className="mb-6">
                                {/* Group Header */}
                                <Pressable
                                    onPress={() => toggleGroupCollapse(group.key)}
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
                                        <ChevronLeft
                                            size={20}
                                            color={!isCollapsed ? "#023C69" : "#9CA3AF"}
                                            style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '90deg' }] }}
                                        />
                                    </View>
                                </Pressable>

                                {/* Group Content (Trips) */}
                                {!isCollapsed && (
                                    <View className="space-y-4 pt-4 px-2">
                                        {group.trips.length === 0 ? (
                                            <View className="py-4 items-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 ml-4">
                                                <Typography variant="caption" className="text-gray-400 italic">Belum ada aktivitas transaksi</Typography>
                                            </View>
                                        ) : (
                                            group.trips.map((item: any) => (
                                                <Pressable
                                                    key={item.id}
                                                    onPress={() => handlePressTrip(item)}
                                                    className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm ml-4 mb-4"
                                                >
                                                    <View className="flex-row items-center mb-3">
                                                        <View className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center mr-3">
                                                            <Truck size={20} color="#10B981" />
                                                        </View>
                                                        <View className="flex-1">
                                                            <View className="flex-row items-center justify-between">
                                                                <Typography variant="body2" weight="bold" className="text-textMain flex-1" numberOfLines={1}>
                                                                    {item.tujuan}
                                                                </Typography>
                                                                <View className={`px-2 py-0.5 rounded-lg ${item.status_bayar === 'Lunas' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                                                    <Typography className={`text-[8px] font-bold uppercase ${item.status_bayar === 'Lunas' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                        {item.status_bayar}
                                                                    </Typography>
                                                                </View>
                                                            </View>
                                                            <Typography variant="caption" className="text-textGray/60 text-[10px]" numberOfLines={1}>
                                                                {formatDate(item.tanggal)} • {item.nomor_transaksi}
                                                            </Typography>
                                                        </View>
                                                    </View>

                                                    <View className="flex-row items-center mb-3 px-1">
                                                        <View className="flex-row items-center flex-1">
                                                            <User size={12} color="#9CA3AF" />
                                                            <Typography variant="caption" weight="medium" className="text-textGray ml-1 text-[11px]" numberOfLines={1}>{item.supir_nama}</Typography>
                                                        </View>
                                                        <View className="flex-row items-center flex-1">
                                                            <MapPin size={12} color="#9CA3AF" />
                                                            <Typography variant="caption" weight="medium" className="text-textGray ml-1 text-[11px]" numberOfLines={1}>{item.asal}</Typography>
                                                        </View>
                                                    </View>

                                                    <View className="flex-row justify-between items-end pt-2 border-t border-gray-50/50">
                                                        <View>
                                                            <Typography className="text-textGray/40 text-[8px] uppercase font-bold">Laba TPM</Typography>
                                                            <Typography variant="caption" weight="bold" className="text-emerald-600">
                                                                {formatCurrency(item.laba_tpm || 0)}
                                                            </Typography>
                                                        </View>
                                                        <View className="items-end">
                                                            <Typography className="text-textGray/40 text-[8px] uppercase font-bold">In TPM</Typography>
                                                            <Typography variant="body2" weight="bold" className="text-primary tracking-tighter">
                                                                {formatCurrency((item.pendapatan_kotor || 0) - (item.laba_supir || 0))}
                                                            </Typography>
                                                        </View>
                                                    </View>
                                                </Pressable>
                                            ))
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )
                }

                <View className="h-24" />
            </ScrollView>

            {/* Detail Modal */}
            <BottomSheetModal
    ref={bottomSheetModalRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose={true}
    topInset={insets.top}
    backdropComponent={({ style }) => (
        <View style={[style, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
    )}
    backgroundStyle={{ borderRadius: 32 }}
>
                <BottomSheetView className="flex-1 px-6 pb-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Typography variant="h2" weight="bold">Detail Ritase</Typography>
                            <Typography className="text-gray-400 text-xs mt-1">Informasi lengkap pengangkutan</Typography>
                        </View>
                        <Pressable onPress={handleCloseModal} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                            <X size={16} color="#4B5563" />
                        </Pressable>
                    </View>

                    {detailLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="mt-4 text-gray-400">Memuat detail...</Typography>
                        </View>
                    ) : selectedTrip ? (
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            {/* Trip Info Card */}
                            <View className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
                                <View className="flex-row justify-between mb-4">
                                    <View className="flex-1">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Rute</Typography>
                                        <View className="flex-row items-center">
                                            <Typography weight="bold" className="text-lg">{selectedTrip.asal}</Typography>
                                            <ArrowRight size={16} color="#9CA3AF" className="mx-2" />
                                            <Typography weight="bold" className="text-lg">{selectedTrip.tujuan}</Typography>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Status</Typography>
                                        <Badge
                                            variant={selectedTrip.status_bayar === 'Lunas' ? 'success' : 'error'}
                                            label={selectedTrip.status_bayar}
                                        />
                                    </View>
                                </View>

                                <View className="flex-row justify-between mb-2">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Tanggal</Typography>
                                        <Typography weight="bold">{format(new Date(selectedTrip.tanggal), 'dd MMM yyyy', { locale: localeID })}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">No. Transaksi</Typography>
                                        <Typography weight="medium" className="text-gray-700">{selectedTrip.nomor_transaksi}</Typography>
                                    </View>
                                </View>

                                <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                                    <View>
                                        <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Supir</Typography>
                                        <Typography weight="bold">{selectedTrip.supir_nama}</Typography>
                                    </View>
                                    {selectedTrip.jenis_muatan && (
                                        <View className="items-end">
                                            <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-1">Jenis Muatan</Typography>
                                            <Typography weight="medium" className="text-gray-700">{selectedTrip.jenis_muatan}</Typography>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Biaya Operasional Section */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-red-100 rounded-md items-center justify-center mr-2">
                                        <Receipt size={14} color="#EF4444" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Rincian Biaya</Typography>
                                </View>
                                <View className="bg-white p-4 rounded-2xl border border-gray-100">
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                        <View className="flex-row items-center">
                                            <View className="w-6 h-6 bg-amber-50 rounded-md items-center justify-center mr-2">
                                                <Fuel size={12} color="#F59E0B" />
                                            </View>
                                            <Typography className="text-gray-600 text-sm">BBM</Typography>
                                        </View>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTrip.biaya_bbm || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                        <View className="flex-row items-center">
                                            <View className="w-6 h-6 bg-blue-50 rounded-md items-center justify-center mr-2">
                                                <Receipt size={12} color="#3B82F6" />
                                            </View>
                                            <Typography className="text-gray-600 text-sm">Tol</Typography>
                                        </View>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTrip.biaya_tol || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                        <View className="flex-row items-center">
                                            <View className="w-6 h-6 bg-orange-50 rounded-md items-center justify-center mr-2">
                                                <Utensils size={12} color="#F97316" />
                                            </View>
                                            <Typography className="text-gray-600 text-sm">Makan</Typography>
                                        </View>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTrip.biaya_makan || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                        <View className="flex-row items-center">
                                            <View className="w-6 h-6 bg-purple-50 rounded-md items-center justify-center mr-2">
                                                <ParkingSquare size={12} color="#A855F7" />
                                            </View>
                                            <Typography className="text-gray-600 text-sm">Parkir</Typography>
                                        </View>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTrip.biaya_parkir || 0)}</Typography>
                                    </View>
                                    {selectedTrip.biaya_lainnya > 0 && (
                                        <View className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                            <View className="flex-row items-center">
                                                <View className="w-6 h-6 bg-gray-100 rounded-md items-center justify-center mr-2">
                                                    <MoreHorizontal size={12} color="#6B7280" />
                                                </View>
                                                <Typography className="text-gray-600 text-sm">Lainnya</Typography>
                                            </View>
                                            <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency(selectedTrip.biaya_lainnya)}</Typography>
                                        </View>
                                    )}
                                    <View className="flex-row justify-between items-center pt-3 mt-1">
                                        <Typography weight="bold" className="text-gray-700 text-sm">Total Biaya</Typography>
                                        <Typography weight="bold" className="text-red-500 text-base">{formatCurrency(selectedTrip.total_biaya || 0)}</Typography>
                                    </View>
                                </View>
                            </View>

                            {/* Profit Split */}
                            <View className="mb-6">
                                <View className="flex-row items-center mb-3">
                                    <View className="w-6 h-6 bg-purple-100 rounded-md items-center justify-center mr-2">
                                        <Percent size={14} color="#A855F7" />
                                    </View>
                                    <Typography variant="body1" weight="bold">Pembagian Laba</Typography>
                                </View>
                                <View className="bg-white p-4 rounded-2xl border border-gray-100">
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-gray-500 text-xs">Persentase TPM</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{selectedTrip.persentase_tpm || 50}%</Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Typography className="text-primary text-xs">Laba TPM</Typography>
                                        <Typography weight="bold" className="text-primary text-sm">{formatCurrency(selectedTrip.laba_tpm || 0)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography className="text-amber-500 text-xs">Laba Supir</Typography>
                                        <Typography weight="bold" className="text-amber-600 text-sm">{formatCurrency(selectedTrip.laba_supir || 0)}</Typography>
                                    </View>
                                </View>
                            </View>

                            {/* Financial Summary */}
                            <View className="bg-primary/5 p-5 rounded-2xl border border-primary/10 mb-8">
                                <View className="space-y-2 mb-4">
                                    <View className="flex-row justify-between">
                                        <Typography className="text-gray-500 text-xs">Pemasukan TPM</Typography>
                                        <Typography weight="bold" className="text-gray-700 text-sm">{formatCurrency((selectedTrip.pendapatan_kotor || 0) - (selectedTrip.laba_supir || 0))}</Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography className="text-red-500 text-xs">Total Biaya</Typography>
                                        <Typography weight="bold" className="text-red-500 text-sm">-{formatCurrency(selectedTrip.total_biaya || 0)}</Typography>
                                    </View>
                                </View>
                                <View className="flex-row justify-between items-center pt-3 border-t border-primary/10">
                                    <Typography weight="bold" className="text-lg text-primary">Laba TPM</Typography>
                                    <Typography variant="h2" weight="bold" className="text-primary text-2xl">
                                        {formatCurrency(selectedTrip.laba_tpm || 0)}
                                    </Typography>
                                </View>
                            </View>

                            {selectedTrip.catatan && (
                                <View className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-8">
                                    <Typography className="text-gray-400 text-[10px] font-bold uppercase mb-2">Catatan</Typography>
                                    <Typography className="text-gray-600">{selectedTrip.catatan}</Typography>
                                </View>
                            )}
                            <View className="h-10" />
                        </BottomSheetScrollView>
                    ) : null}
                </BottomSheetView>
            </BottomSheetModal>

            {/* Export Action Menu */}
            <Modal
                visible={showExportMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExportMenu(false)}
            >
                <Pressable
                    className="flex-1 bg-black/50 justify-end"
                    onPress={() => setShowExportMenu(false)}
                >
                    <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-8">
                            <View>
                                <Typography variant="h3" weight="bold">Ekspor Laporan Ritase</Typography>
                                <Typography variant="caption" className="text-gray-500">Pilih metode ekspor dokumen PDF</Typography>
                            </View>
                            <Pressable onPress={() => setShowExportMenu(false)} className="bg-background p-2 rounded-full">
                                <X size={20} color="#64748B" />
                            </Pressable>
                        </View>

                        <View className="flex-row gap-4">
                            <Pressable
                                onPress={async () => {
                                    setShowExportMenu(false);
                                    if (!summary) return;
                                    try {
                                        const html = `
                                            <div class="section-header">RINGKASAN JASA ANGKUT</div>
                                            <div class="row-item">
                                                <span>Total Laba TPM</span>
                                                <span class="font-bold text-success">${formatCurrency(summary.laba_tpm || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Total Ritase</span>
                                                <span>${summary.total_transaksi || 0} Trip Selesai</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Total Pendapatan TPM</span>
                                                <span class="font-bold">${formatCurrency(summary.total_pendapatan || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Piutang Supir</span>
                                                <span class="text-error">${formatCurrency(summary.total_hutang_supir || 0)}</span>
                                            </div>

                                            <div class="section-header" style="margin-top:30px;">RINCIAN TRIP (Group by ${groupBy.toUpperCase()})</div>
                                            ${groupedTrips.map(group => `
                                                <div style="background-color: #f8fafc; padding: 10px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                                    <div style="font-weight: bold; font-size: 11px;">${group.title}</div>
                                                    <div style="font-size: 9px; color: #64748b;">${group.subtitle || ''} • ${group.trips.length} Transaksi</div>
                                                    <div style="font-size: 10px; margin-top: 5px;">Total Laba: <b>${formatCurrency(group.totalPendapatanTPM)}</b></div>
                                                </div>
                                                <table style="width:100%; border-collapse: collapse; margin-top:5px;">
                                                    <thead>
                                                        <tr style="text-align: left; font-size: 9px; color: #64748b;">
                                                            <th style="padding: 5px; border-bottom: 1px solid #e2e8f0;">Tgl/Nota</th>
                                                            <th style="padding: 5px; border-bottom: 1px solid #e2e8f0;">Rute / Muatan</th>
                                                            <th style="padding: 5px; border-bottom: 1px solid #e2e8f0; text-align: right;">Laba TPM</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${group.trips.map(trip => `
                                                            <tr style="font-size: 9px; border-bottom: 1px solid #f1f5f9;">
                                                                <td style="padding: 5px;">
                                                                    ${formatDate(trip.tanggal)}<br/>
                                                                    <span style="font-size: 7px; color: #94a3b8;">${trip.nomor_transaksi}</span>
                                                                </td>
                                                                <td style="padding: 5px;">
                                                                    <b>${trip.asal} &rarr; ${trip.tujuan}</b><br/>
                                                                    <span style="font-size: 8px; color: #64748b;">${trip.supir_nama}</span>
                                                                </td>
                                                                <td style="padding: 5px; text-align: right; font-weight: bold;">${formatCurrency(trip.laba_tpm || 0)}</td>
                                                            </tr>
                                                        `).join('')}
                                                    </tbody>
                                                </table>
                                            `).join('')}
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Jasa Angkut',
                                            dateRange: getFormattedDate()
                                        });
                                    } catch (e) {
                                        Alert.alert('Error', 'Gagal mencetak laporan');
                                    }
                                }}
                                className="flex-1 bg-blue-50 p-6 rounded-[32px] border border-blue-100 items-center"
                            >
                                <View className="w-14 h-14 bg-blue-500 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-blue-200">
                                    <Eye size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-blue-900">Tampilkan</Typography>
                                <Typography variant="caption" className="text-blue-600/70 text-center mt-1">Lihat dokumen PDF</Typography>
                            </Pressable>

                            <Pressable
                                onPress={async () => {
                                    setShowExportMenu(false);
                                    if (!summary) return;
                                    try {
                                        const html = `
                                            <div class="section-header">RINGKASAN JASA ANGKUT</div>
                                            <div class="row-item">
                                                <span>Total Laba TPM</span>
                                                <span class="font-bold text-success">${formatCurrency(summary.laba_tpm || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Total Ritase</span>
                                                <span>${summary.total_transaksi || 0} Trip Selesai</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Total Pendapatan TPM</span>
                                                <span class="font-bold">${formatCurrency(summary.total_pendapatan || 0)}</span>
                                            </div>
                                            <div class="row-item">
                                                <span>Piutang Supir</span>
                                                <span class="text-error">${formatCurrency(summary.total_hutang_supir || 0)}</span>
                                            </div>

                                            <div class="section-header" style="margin-top:30px;">RINCIAN TRIP (Group by ${groupBy.toUpperCase()})</div>
                                            ${groupedTrips.map(group => `
                                                <div style="background-color: #f8fafc; padding: 10px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                                    <div style="font-weight: bold; font-size: 11px;">${group.title}</div>
                                                    <div style="font-size: 9px; color: #64748b;">${group.subtitle || ''} • ${group.trips.length} Transaksi</div>
                                                    <div style="font-size: 10px; margin-top: 5px;">Total Laba: <b>${formatCurrency(group.totalPendapatanTPM)}</b></div>
                                                </div>
                                                <table style="width:100%; border-collapse: collapse; margin-top:5px;">
                                                    <thead>
                                                        <tr style="text-align: left; font-size: 9px; color: #64748b;">
                                                            <th style="padding: 5px; border-bottom: 1px solid #e2e8f0;">Tgl/Nota</th>
                                                            <th style="padding: 5px; border-bottom: 1px solid #e2e8f0;">Rute / Muatan</th>
                                                            <th style="padding: 5px; border-bottom: 1px solid #e2e8f0; text-align: right;">Laba TPM</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${group.trips.map(trip => `
                                                            <tr style="font-size: 9px; border-bottom: 1px solid #f1f5f9;">
                                                                <td style="padding: 5px;">
                                                                    ${formatDate(trip.tanggal)}<br/>
                                                                    <span style="font-size: 7px; color: #94a3b8;">${trip.nomor_transaksi}</span>
                                                                </td>
                                                                <td style="padding: 5px;">
                                                                    <b>${trip.asal} &rarr; ${trip.tujuan}</b><br/>
                                                                    <span style="font-size: 8px; color: #64748b;">${trip.supir_nama}</span>
                                                                </td>
                                                                <td style="padding: 5px; text-align: right; font-weight: bold;">${formatCurrency(trip.laba_tpm || 0)}</td>
                                                            </tr>
                                                        `).join('')}
                                                    </tbody>
                                                </table>
                                            `).join('')}
                                        `;

                                        await printReportHTML(html, {
                                            title: 'Laporan Jasa Angkut',
                                            dateRange: getFormattedDate()
                                        });
                                    } catch (e) {
                                        Alert.alert('Error', 'Gagal membuat PDF');
                                    }
                                }}
                                className="flex-1 bg-primary/5 p-6 rounded-[32px] border border-primary/10 items-center"
                            >
                                <View className="w-14 h-14 bg-primary rounded-2xl items-center justify-center mb-4 shadow-lg shadow-green-200">
                                    <Share2 size={28} color="white" />
                                </View>
                                <Typography weight="bold" className="text-primary-dark">Download</Typography>
                                <Typography variant="caption" className="text-primary/70 text-center mt-1">Unduh & Bagikan</Typography>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}
