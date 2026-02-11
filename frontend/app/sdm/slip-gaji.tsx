import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    FileText,
    User,
    Calendar,
    RefreshCw,
    X,
    Edit3,
    Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SlipGaji, SlipGajiPreviewItem, PaymentStatus, sdmService } from '../../services/sdm';
import { formatCurrency, formatDate } from '../../utils/format';
import { usePayrollList, usePayrollSummary, useCreatePayroll, useProcessPayrollPayment } from '../../hooks/useSDM';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

// Helper to get current week number
const getWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'BELUM_LUNAS', label: 'Belum Dibayar' },
    { key: 'LUNAS', label: 'Sudah Dibayar' },
];

export default function SlipGajiScreen() {
    const router = useRouter(); const [selectedFilter, setSelectedFilter] = useState<PaymentStatus | 'all'>('all');
    const [selectedSlip, setSelectedSlip] = useState<SlipGaji | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Period state - weekly
    const now = new Date();
    const [selectedWeek, setSelectedWeek] = useState(getWeekNumber(now));
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    // Preview modal state
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewItems, setPreviewItems] = useState<SlipGajiPreviewItem[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewDates, setPreviewDates] = useState({ mulai: '', akhir: '' });
    const [customTanggalMulai, setCustomTanggalMulai] = useState('');
    const [previewSearchQuery, setPreviewSearchQuery] = useState('');
    const [generatingId, setGeneratingId] = useState<number | null>(null);
    const [payMetode, setPayMetode] = useState('transfer');
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

    // API Hooks
    const { data: listData, isLoading: isLoadingList, refetch: refetchList } = usePayrollList({
        limit: 100,
        periode_minggu: selectedWeek,
        periode_tahun: selectedYear,
        status: selectedFilter === 'all' ? undefined : selectedFilter,
    });
    const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = usePayrollSummary(selectedYear, selectedWeek);

    const createBulkMutation = useCreatePayroll();
    const processPaymentMutation = useProcessPayrollPayment();

    const slipList = listData?.data || [];

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['65%', '85%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/sdm');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchList(), refetchSummary()]);
        setRefreshing(false);
    }, [refetchList, refetchSummary]);

    const handleOpenPreview = async () => {
        setPreviewLoading(true);
        setShowPreviewModal(true);
        setPreviewSearchQuery('');
        try {
            const preview = await sdmService.getSlipGajiPreview(selectedYear, selectedWeek);
            setPreviewItems(preview.items);
            setPreviewDates({ mulai: preview.tanggal_mulai, akhir: preview.tanggal_akhir });
            setCustomTanggalMulai(preview.tanggal_mulai);
        } catch (error: any) {
            console.error('Failed to load preview:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal memuat preview'), variant: 'error' });
            setShowPreviewModal(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleUpdateAttendance = (karyawanId: number, value: string) => {
        const numValue = parseInt(value) || 0;
        setPreviewItems(items =>
            items.map(item =>
                item.karyawan_id === karyawanId
                    ? {
                        ...item,
                        jumlah_hadir: numValue,
                        gaji_bersih: item.gaji_pokok - item.potongan_kasbon,
                    }
                    : item
            )
        );
    };

    const handleGenerateBulk = async () => {
        if (previewItems.length === 0) {
            setDialogConfig({ visible: true, title: 'Info', message: 'Tidak ada karyawan yang perlu di-generate slip gajinya', variant: 'info' });
            return;
        }

        try {
            const result = await createBulkMutation.mutateAsync({
                tahun: selectedYear,
                minggu: selectedWeek,
                items: previewItems,
                tanggalMulai: customTanggalMulai,
            });
            setDialogConfig({ visible: true, title: 'Sukses', message: `${result.created || 0} slip gaji berhasil dibuat`, variant: 'success' });
            setShowPreviewModal(false);
            refetchList();
            refetchSummary();
        } catch (error: any) {
            console.error('Failed to generate:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal generate slip gaji'), variant: 'error' });
        }
    };

    const handleGenerateSingle = async (item: SlipGajiPreviewItem) => {
        setGeneratingId(item.karyawan_id);
        try {
            const result = await createBulkMutation.mutateAsync({
                tahun: selectedYear,
                minggu: selectedWeek,
                items: [item],
                tanggalMulai: customTanggalMulai,
            });
            setDialogConfig({ visible: true, title: 'Sukses', message: `Slip gaji ${item.karyawan_nama} berhasil dibuat`, variant: 'success' });

            // Remove from preview list
            setPreviewItems(prev => prev.filter(p => p.karyawan_id !== item.karyawan_id));

            refetchList();
            refetchSummary();
        } catch (error: any) {
            console.error('Failed to generate:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal generate slip gaji'), variant: 'error' });
        } finally {
            setGeneratingId(null);
        }
    };

    const filteredPreviewItems = useMemo(() => {
        if (!previewSearchQuery) return previewItems;
        const query = previewSearchQuery.toLowerCase();
        return previewItems.filter(item =>
            item.karyawan_nama.toLowerCase().includes(query) ||
            item.karyawan_kode.toLowerCase().includes(query)
        );
    }, [previewItems, previewSearchQuery]);

    const openDetail = (slip: SlipGaji) => {
        setSelectedSlip(slip);
        setPayMetode('transfer');
        bottomSheetRef.current?.expand();
    };

    const handleProcessPayment = async () => {
        if (!selectedSlip) {
            console.log('handleProcessPayment: No slip selected');
            return;
        }

        console.log('handleProcessPayment: Starting for slip', selectedSlip.id);

        const title = 'Konfirmasi Pembayaran';
        const message = `Apakah Anda yakin ingin memproses pembayaran untuk slip gaji ${selectedSlip.karyawan_nama}?`;

        setDialogConfig({
            visible: true,
            title: title,
            message: message,
            variant: 'info',
            type: 'confirm',
            onConfirm: executePayment
        });
    };

    const executePayment = async () => {
        if (!selectedSlip) return;
        try {
            console.log('executePayment: Processing payment for slip:', selectedSlip.id);
            await processPaymentMutation.mutateAsync({
                id: selectedSlip.id,
                data: {
                    metode_bayar: payMetode,
                },
            });
            console.log('executePayment: Success');
            setDialogConfig({ visible: true, title: 'Sukses', message: 'Pembayaran gaji berhasil diproses', variant: 'success' });
            if (Platform.OS === 'web') {
                setSelectedSlip(null);
            } else {
                bottomSheetRef.current?.close();
                // setSelectedSlip(null) will be called via onClose of BottomSheet
            }
            refetchList();
            refetchSummary();
        } catch (error: any) {
            console.error('executePayment: Failed', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal memproses pembayaran'), variant: 'error' });
        }
    };


    const changeWeek = (direction: number) => {
        let newWeek = selectedWeek + direction;
        let newYear = selectedYear;

        if (newWeek < 1) {
            newWeek = 52;
            newYear--;
        } else if (newWeek > 52) {
            newWeek = 1;
            newYear++;
        }

        setSelectedWeek(newWeek);
        setSelectedYear(newYear);
    };

    const renderSlipItem = ({ item }: { item: SlipGaji }) => {
        const isLunas = item.status?.toUpperCase() === 'LUNAS';
        return (
            <TouchableOpacity onPress={() => openDetail(item)}>
                <Card className="mb-3 p-4 border border-gray-100">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isLunas ? 'bg-green-100' : 'bg-purple-100'}`}>
                                <FileText size={20} color={isLunas ? '#16A34A' : '#8B5CF6'} />
                            </View>
                            <View className="flex-1">
                                <Typography weight="semibold">{item.karyawan_nama}</Typography>
                                <View className="flex-row items-center mt-1">
                                    <Typography variant="caption" className="text-gray-500">
                                        Hadir: {item.jumlah_hadir} hari
                                    </Typography>
                                    <Typography variant="caption" className="text-gray-400 mx-2">•</Typography>
                                    <Typography variant="caption" className="text-primary font-semibold">
                                        {formatCurrency(item.gaji_bersih)}
                                    </Typography>
                                </View>
                            </View>
                        </View>
                        <Badge
                            label={isLunas ? 'Dibayar' : 'Pending'}
                            variant={isLunas ? 'success' : 'warning'}
                        />
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    const renderPreviewItem = ({ item }: { item: SlipGajiPreviewItem }) => {
        const isGenerating = generatingId === item.karyawan_id;

        return (
            <Card className="mb-3 p-4 border border-gray-100">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Typography weight="semibold">{item.karyawan_nama}</Typography>
                        <Typography variant="caption" className="text-gray-500">{item.karyawan_kode}</Typography>
                        <View className="flex-row items-center mt-2">
                            <Typography variant="caption" className="text-gray-600 mr-2">{`Gaji: ${formatCurrency(item.gaji_pokok)}`}</Typography>
                            {item.potongan_kasbon > 0 ? (
                                <Typography variant="caption" className="text-red-500">
                                    {`- Kasbon ${formatCurrency(item.potongan_kasbon)}`}
                                </Typography>
                            ) : null}
                        </View>

                        <TouchableOpacity
                            onPress={() => handleGenerateSingle(item)}
                            disabled={isGenerating || !!generatingId}
                            className={`mt-3 self-start px-3 py-1.5 rounded-lg border ${isGenerating ? 'bg-gray-50 border-gray-200' : 'bg-primary/10 border-primary/20'}`}
                        >
                            {isGenerating ? (
                                <ActivityIndicator size="small" color="#16A34A" />
                            ) : (
                                <Typography className="text-primary text-xs font-semibold">Generate Slip</Typography>
                            )}
                        </TouchableOpacity>
                    </View>
                    <View className="items-end">
                        <Typography variant="caption" className="text-gray-500 mb-1">Kehadiran</Typography>
                        <View className="flex-row items-center bg-gray-100 rounded-lg px-2">
                            <TextInput
                                className="w-12 text-center py-2 text-lg font-semibold"
                                keyboardType="numeric"
                                value={String(item.jumlah_hadir)}
                                onChangeText={(value) => handleUpdateAttendance(item.karyawan_id, value)}
                            />
                            <Typography className="text-gray-500 ml-1">hari</Typography>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

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
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Slip Gaji</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Manajemen Payroll Mingguan</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleOpenPreview}
                        disabled={createBulkMutation.isPending}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {createBulkMutation.isPending ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Salary Summary (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-3">
                                <FileText size={20} color="white" />
                            </View>
                            <Typography className="text-white/60 text-xs font-bold uppercase tracking-widest">Total Gaji Minggu Ini</Typography>
                        </View>
                        <View className="bg-white/10 px-3 py-1 rounded-full border border-white/5">
                            <Typography className="text-white/80 text-[10px] font-bold">W{selectedWeek}</Typography>
                        </View>
                    </View>

                    <Typography variant="h1" weight="bold" className="text-white text-3xl mb-4 tracking-tight">
                        {isLoadingSummary ? '...' : formatCurrency(summary?.total_gaji_bersih || 0)}
                    </Typography>

                    <View className="flex-row space-x-3">
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Sudah Bayar</Typography>
                            <Typography className="text-white font-bold text-xs" numberOfLines={1}>{formatCurrency(summary?.total_dibayar || 0)}</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Sisa Belum</Typography>
                            <Typography className="text-amber-400 font-bold text-xs" numberOfLines={1}>{formatCurrency(summary?.total_belum_dibayar || 0)}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Week Slider & Filter Navigator Overlay */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-col">
                    <View className="flex-row items-center justify-between px-2 mb-2 bg-gray-50 h-14 rounded-2xl border border-gray-100">
                        <TouchableOpacity onPress={() => changeWeek(-1)} className="w-10 h-10 items-center justify-center">
                            <ChevronLeft size={20} color="#1C1C1C" />
                        </TouchableOpacity>

                        <View className="items-center">
                            <Typography variant="caption" weight="bold" className="text-textMain">Minggu ke-{selectedWeek}</Typography>
                            <Typography className="text-[9px] text-textGray/60 font-medium">{selectedYear}</Typography>
                        </View>

                        <TouchableOpacity onPress={() => changeWeek(1)} className="w-10 h-10 items-center justify-center">
                            <ChevronLeft size={20} color="#1C1C1C" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="p-1">
                        {STATUS_FILTERS.map((filter) => (
                            <TouchableOpacity
                                key={filter.key}
                                onPress={() => setSelectedFilter(filter.key as PaymentStatus | 'all')}
                                className={`px-5 py-2.5 rounded-2xl mr-2 ${selectedFilter === filter.key ? 'bg-primary border border-white/10 shadow-md shadow-primary/20' : 'bg-transparent border border-transparent'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={selectedFilter === filter.key ? 'text-white' : 'text-textGray/60'}
                                >
                                    {filter.label}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Slip List */}
            <FlatList
                data={slipList}
                renderItem={(props) => {
                    const { item } = props;
                    const isLunas = item.status?.toUpperCase() === 'LUNAS';
                    return (
                        <TouchableOpacity
                            onPress={() => openDetail(item)}
                            activeOpacity={0.9}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            <View className={`w-14 h-14 ${isLunas ? 'bg-emerald-50' : 'bg-amber-50'} rounded-2xl items-center justify-center mr-4 border ${isLunas ? 'border-emerald-100/50' : 'border-amber-100/50'}`}>
                                <FileText size={28} color={isLunas ? '#10B981' : '#F59E0B'} />
                            </View>
                            <View className="flex-1 mr-3">
                                <View className="flex-row items-center mb-1">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight mr-2" numberOfLines={1}>
                                        {item.karyawan_nama}
                                    </Typography>
                                    <View className={isLunas ? "bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100" : "bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100"}>
                                        <Typography className={isLunas ? "text-emerald-600 text-[8px] font-bold" : "text-amber-600 text-[8px] font-bold"}>
                                            {isLunas ? 'PAID' : 'PENDING'}
                                        </Typography>
                                    </View>
                                </View>
                                <Typography variant="caption" className="text-textGray mb-1">
                                    Hadir {item.jumlah_hadir} hari
                                </Typography>
                                <Typography variant="body2" weight="bold" className="text-primary text-xs">
                                    {formatCurrency(item.gaji_bersih)}
                                </Typography>
                            </View>
                            <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100">
                                <ChevronLeft size={18} color="#D1D5DB" style={{ transform: [{ rotate: '180deg' }] }} />
                            </View>
                        </TouchableOpacity>
                    );
                }}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
                ListEmptyComponent={
                    isLoadingList ? (
                        <View className="space-y-4">
                            {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-24 rounded-[32px]" />)}
                        </View>
                    ) : (
                        <View className="items-center py-20">
                            <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                                <FileText size={40} color="#D1D5DB" />
                            </View>
                            <Typography className="text-gray-400 font-medium text-center px-10">Belum ada slip gaji minggu ini</Typography>
                        </View>
                    )
                }
            />

            {/* Preview Generative Modal */}
            <Modal visible={showPreviewModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowPreviewModal(false)}>
                <View className="flex-1 bg-surface">
                    <View className="bg-primary pt-14 pb-8 px-6 rounded-b-[40px] shadow-lg">
                        <View className="flex-row items-center justify-between mb-6">
                            <View>
                                <Typography variant="h2" weight="bold" className="text-white text-xl">Generate Preview</Typography>
                                <Typography className="text-white/50 text-xs">Week {selectedWeek}, {selectedYear}</Typography>
                            </View>
                            <TouchableOpacity onPress={() => setShowPreviewModal(false)} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center">
                                <X size={20} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View className="bg-white/10 px-4 py-3 rounded-2xl border border-white/10 flex-row items-center">
                            <Search size={18} color="#FFFFFF" strokeWidth={2} />
                            <TextInput
                                className="flex-1 ml-3 text-white font-medium text-sm"
                                placeholder="Cari karyawan..."
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={previewSearchQuery}
                                onChangeText={setPreviewSearchQuery}
                            />
                        </View>
                    </View>

                    {previewLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#00AA13" />
                            <Typography className="text-textGray mt-4 font-medium">Menghitung gaji...</Typography>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredPreviewItems}
                            renderItem={(props) => {
                                const { item } = props;
                                const isGenerating = generatingId === item.karyawan_id;
                                return (
                                    <View className="bg-white mx-6 p-5 rounded-[32px] mb-4 border border-gray-100 shadow-sm flex-row items-center">
                                        <View className="flex-1">
                                            <Typography weight="bold" className="text-textMain">{item.karyawan_nama}</Typography>
                                            <Typography variant="caption" className="text-textGray mb-2">{item.karyawan_kode}</Typography>
                                            <View className="flex-row items-center">
                                                <Typography className="text-[10px] text-textGray font-bold bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                                                    {formatCurrency(item.gaji_pokok)}
                                                </Typography>
                                                {item.potongan_kasbon > 0 && (
                                                    <Typography className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 ml-2">
                                                        - K{formatCurrency(item.potongan_kasbon)}
                                                    </Typography>
                                                )}
                                            </View>
                                        </View>

                                        <View className="items-end">
                                            <View className="flex-row items-center bg-gray-50 rounded-2xl border border-gray-100 px-3 py-2 mb-2">
                                                <TextInput
                                                    className="w-10 text-center text-textMain font-bold p-0"
                                                    keyboardType="numeric"
                                                    value={String(item.jumlah_hadir)}
                                                    onChangeText={(v) => handleUpdateAttendance(item.karyawan_id, v)}
                                                />
                                                <Typography className="text-[10px] text-textGray font-bold uppercase ml-1">Days</Typography>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => handleGenerateSingle(item)}
                                                disabled={isGenerating || !!generatingId}
                                                className={`px-4 py-2 rounded-xl ${isGenerating ? 'bg-gray-100' : 'bg-primary shadow-lg shadow-primary/20 border border-white/10'}`}
                                            >
                                                {isGenerating ? <ActivityIndicator size="small" color="#00AA13" /> : (
                                                    <Typography className="text-white text-[10px] font-bold uppercase">Gen</Typography>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            }}
                            keyExtractor={(item) => item.karyawan_id.toString()}
                            contentContainerStyle={{ paddingVertical: 24, paddingBottom: 100 }}
                            ListEmptyComponent={
                                <View className="items-center py-20 px-10">
                                    <FileText size={48} color="#D1D5DB" />
                                    <Typography className="text-textGray text-center mt-4 font-medium">Semua karyawan sudah memiliki slip gaji atau tidak ada data ditemukan</Typography>
                                </View>
                            }
                        />
                    )}

                    {!previewLoading && previewItems.length > 0 && (
                        <View className="absolute bottom-10 left-6 right-6">
                            <TouchableOpacity
                                onPress={handleGenerateBulk}
                                disabled={createBulkMutation.isPending || !!generatingId}
                                className="bg-primary h-16 rounded-[24px] items-center justify-center shadow-xl shadow-primary/30 flex-row border border-white/10"
                            >
                                {createBulkMutation.isPending ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <RefreshCw size={20} color="white" className="mr-3" />
                                        <Typography className="text-white font-bold text-lg">Generate Bulk ({previewItems.length})</Typography>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>

            {/* Bottom Sheet Detail */}
            {Platform.OS === 'web' ? (
                <Modal visible={!!selectedSlip} transparent animationType="slide" onRequestClose={() => setSelectedSlip(null)}>
                    <View className="flex-1 justify-end bg-black/40">
                        <TouchableOpacity className="absolute inset-0" onPress={() => setSelectedSlip(null)} />
                        <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[85%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView className="px-8 flex-1">
                                {selectedSlip && renderDetailContent()}
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
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    onClose={() => setSelectedSlip(null)}
                >
                    <BottomSheetScrollView className="px-8">
                        {selectedSlip && renderDetailContent()}
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

    function renderDetailContent() {
        if (!selectedSlip) return null;
        const isLunas = selectedSlip.status?.toUpperCase() === 'LUNAS';

        return (
            <View className="pb-10">
                <View className="flex-row justify-between items-center mb-8">
                    <View className="flex-row items-center">
                        <View className="w-1 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h2" weight="bold" className="text-2xl tracking-tight">Detail Payroll</Typography>
                    </View>
                    <TouchableOpacity onPress={() => Platform.OS === 'web' ? setSelectedSlip(null) : bottomSheetRef.current?.close()} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View className="items-center mb-8">
                    <View className="p-1 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
                        <View className="w-20 h-20 bg-primary/10 rounded-full items-center justify-center">
                            <User size={40} color="#00AA13" />
                        </View>
                    </View>
                    <Typography variant="h3" weight="bold" className="mt-4 text-xl tracking-tight text-textMain">{selectedSlip.karyawan_nama}</Typography>
                    <Typography className="text-textGray mt-0.5 font-medium">Minggu {selectedSlip.periode_minggu} • {selectedSlip.periode_tahun}</Typography>

                    <View className="flex-row mt-4">
                        <View className={isLunas ? "bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100" : "bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100"}>
                            <Typography className={isLunas ? "text-emerald-600 font-bold text-[10px] uppercase tracking-widest" : "text-amber-600 font-bold text-[10px] uppercase tracking-widest"}>
                                {isLunas ? 'SUDAH TERBAYAR' : 'MENUNGGU PEMBAYARAN'}
                            </Typography>
                        </View>
                    </View>
                </View>

                {/* Salary Bento Grid */}
                <View className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8">
                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-200/50">
                        <Typography className="text-textGray text-xs font-medium">Gaji Pokok</Typography>
                        <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(selectedSlip.gaji_pokok)}</Typography>
                    </View>
                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-200/50">
                        <Typography className="text-textGray text-xs font-medium">Total Hadir</Typography>
                        <Typography weight="bold" className="text-textMain text-sm">{selectedSlip.jumlah_hadir} Hari</Typography>
                    </View>
                    <View className="flex-row justify-between items-center mb-6">
                        <Typography className="text-textGray text-xs font-medium">Potongan Kasbon</Typography>
                        <Typography weight="bold" className="text-rose-500 text-sm">-{formatCurrency(selectedSlip.potongan_kasbon)}</Typography>
                    </View>

                    <View className="bg-white p-4 rounded-2xl border border-gray-200/50 flex-row items-center justify-between shadow-sm">
                        <Typography variant="body1" weight="bold" className="text-textGray uppercase text-[10px] tracking-widest">Gaji Bersih</Typography>
                        <Typography variant="h2" weight="bold" className="text-primary text-xl tracking-tighter">
                            {formatCurrency(selectedSlip.gaji_bersih)}
                        </Typography>
                    </View>
                </View>

                {!isLunas && (
                    <View className="mb-8">
                        <Typography className="mb-4 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Metode Bayar</Typography>
                        <View className="flex-row space-x-3">
                            {['tunai', 'transfer'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setPayMetode(m)}
                                    className={`flex-1 py-4 items-center rounded-2xl border ${payMetode === m ? 'border-primary bg-primary shadow-lg shadow-primary/20' : 'border-gray-200 bg-white'}`}
                                >
                                    <Typography
                                        className={payMetode === m ? 'text-white' : 'text-textGray'}
                                        weight="bold"
                                    >
                                        {m.toUpperCase()}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {!isLunas && (
                    <TouchableOpacity
                        onPress={handleProcessPayment}
                        disabled={processPaymentMutation.isPending}
                        className="bg-primary h-16 rounded-[24px] items-center justify-center shadow-xl shadow-primary/30 border border-white/10"
                    >
                        {processPaymentMutation.isPending ? <ActivityIndicator color="white" /> : (
                            <Typography weight="bold" className="text-white text-lg">Selesaikan Pembayaran</Typography>
                        )}
                    </TouchableOpacity>
                )}

                {isLunas && !!selectedSlip.tanggal_bayar && (
                    <View className="bg-emerald-50 p-5 rounded-[24px] border border-emerald-100 flex-row items-center">
                        <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mr-4">
                            <Calendar size={20} color="#059669" />
                        </View>
                        <View>
                            <Typography className="text-emerald-800 font-bold text-sm">Pembayaran Selesai</Typography>
                            <Typography className="text-emerald-600/60 text-xs font-medium mt-0.5">
                                Dana dikirim pada {formatDate(selectedSlip.tanggal_bayar)}
                            </Typography>
                        </View>
                    </View>
                )}
            </View>
        );
    }
}
