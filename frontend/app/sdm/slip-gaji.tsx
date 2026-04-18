import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Modal, Platform } from 'react-native';
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
    CheckCircle2,
    Clock,
    ArrowRight,
    TrendingUp,
    Trash,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { SlipGaji, SlipGajiPreviewItem, PaymentStatus, sdmService } from '../../services/sdm';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { usePayrollList, usePayrollSummary, useCreatePayroll, useProcessPayrollPayment, useSlipGajiPreview, useSlipGajiPreviewRange, useVoidSlipGajiPayment, useDeletePayroll } from '../../hooks/useSDM';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { Header } from '../../components/ui/Header';

// Helper to get current week number
const getWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Helper to get ISO week start date
const getStartDateOfWeek = (w: number, y: number) => {
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart.toISOString().split('T')[0];
};

export default function SlipGajiScreen() {
    const router = useRouter();
    const now = new Date();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [selectedSlip, setSelectedSlip] = useState<SlipGaji | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Period state - Date Range
    const getInitialRange = () => {
        const d = new Date();
        const day = d.getDay() || 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);
        return {
            start: monday.toISOString().split('T')[0],
            end: saturday.toISOString().split('T')[0]
        };
    };

    const initialRange = getInitialRange();
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    const [datePickingMode, setDatePickingMode] = useState<'start' | 'end' | 'slip'>('slip');

    // The "Tanggal Slip" user chooses
    const [slipDate, setSlipDate] = useState(now.toISOString().split('T')[0]);

    // Local state for edits
    const [attendanceEdits, setAttendanceEdits] = useState<Record<number, number>>({});
    const [kasbonEdits, setKasbonEdits] = useState<Record<number, number>>({});
    const [overtimeEdits, setOvertimeEdits] = useState<Record<number, number>>({});

    // Search query
    const [searchQuery, setSearchQuery] = useState('');

    const [generatingId, setGeneratingId] = useState<number | null>(null);
    const [payMetode, setPayMetode] = useState('transfer');
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan?: string }[]>([]);
    const [showDatePicker, setShowDatePicker] = useState(false);

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
    // 1. History (Processed Slips)
    const { data: listData, isLoading: isLoadingList, refetch: refetchList } = usePayrollList({
        limit: 100,
        // For history, we can still filter by the year/week of the startDate for consistency,
        // or just show all. Let's use the startDate's week for now to avoid breaking the backend summary.
        periode_minggu: getWeekNumber(new Date(startDate)),
        periode_tahun: new Date(startDate).getFullYear(),
    });

    // 2. Summary
    const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = usePayrollSummary(
        new Date(startDate).getFullYear(),
        getWeekNumber(new Date(startDate))
    );

    // 3. Pending (Employees without slips) - NOW RANGE BASED
    const { data: previewData, isLoading: isLoadingPreview, refetch: refetchPreview } = useSlipGajiPreviewRange(startDate, endDate, true);

    const createBulkMutation = useCreatePayroll();
    const processPaymentMutation = useProcessPayrollPayment();
    const voidPaymentMutation = useVoidSlipGajiPayment();
    const deleteMutation = useDeletePayroll();

    const slipHistory = listData?.data || [];
    const pendingEmployees = previewData?.items || [];

    // Filtered Lists
    const filteredPending = useMemo(() => {
        let items = pendingEmployees;
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            items = items.filter((item: SlipGajiPreviewItem) =>
                item.karyawan_nama.toLowerCase().includes(lower) ||
                item.karyawan_kode.toLowerCase().includes(lower)
            );
        }
        return items;
    }, [pendingEmployees, searchQuery]);

    const filteredHistory = useMemo(() => {
        let items = slipHistory;
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            items = items.filter((item: SlipGaji) =>
                item.karyawan_nama?.toLowerCase().includes(lower)
            );
        }
        return items;
    }, [slipHistory, searchQuery]);

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
        await Promise.all([refetchList(), refetchSummary(), refetchPreview()]);
        setRefreshing(false);
    }, [refetchList, refetchSummary, refetchPreview]);

    const handleUpdateAttendance = (karyawanId: number, value: string) => {
        const numValue = parseFloat(value) || 0;
        setAttendanceEdits(prev => ({
            ...prev,
            [karyawanId]: numValue
        }));
    };

    const handleUpdateKasbon = (karyawanId: number, value: string) => {
        const numValue = parseFloat(value.replace(/[^0-9]/g, '')) || 0;
        setKasbonEdits(prev => ({
            ...prev,
            [karyawanId]: numValue
        }));
    };

    const handleUpdateOvertime = (karyawanId: number, value: string) => {
        const numValue = parseFloat(value.replace(/[^0-9]/g, '')) || 0;
        setOvertimeEdits(prev => ({
            ...prev,
            [karyawanId]: numValue
        }));
    };

    const getAttendanceValue = (item: SlipGajiPreviewItem) => {
        return attendanceEdits[item.karyawan_id] !== undefined
            ? attendanceEdits[item.karyawan_id]
            : item.jumlah_hadir;
    };

    const getKasbonValue = (item: SlipGajiPreviewItem) => {
        return kasbonEdits[item.karyawan_id] !== undefined
            ? kasbonEdits[item.karyawan_id]
            : item.potongan_kasbon;
    };

    const getOvertimeValue = (item: SlipGajiPreviewItem) => {
        return overtimeEdits[item.karyawan_id] !== undefined
            ? overtimeEdits[item.karyawan_id]
            : (item.uang_lembur || 0);
    };

    const handleGenerateSingle = async (item: SlipGajiPreviewItem) => {
        setGeneratingId(item.karyawan_id);
        const finalAttendance = getAttendanceValue(item);
        const finalKasbon = getKasbonValue(item);
        const finalOvertime = getOvertimeValue(item);

        try {
            await createBulkMutation.mutateAsync({
                tanggalDari: startDate,
                tanggalSampai: endDate,
                items: [{ ...item, jumlah_hadir: finalAttendance, potongan_kasbon: finalKasbon, uang_lembur: finalOvertime }],
            });
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: `Slip gaji ${item.karyawan_nama} berhasil dibuat`,
                variant: 'success'
            });
            onRefresh();
        } catch (error: any) {
            console.error('Failed to generate:', error);
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal generate slip gaji'),
                variant: 'error'
            });
        } finally {
            setGeneratingId(null);
        }
    };

    const handleGenerateBulk = async () => {
        if (filteredPending.length === 0) return;

        try {
            const itemsToGenerate = filteredPending.map((item: SlipGajiPreviewItem) => ({
                ...item,
                jumlah_hadir: getAttendanceValue(item),
                potongan_kasbon: getKasbonValue(item),
                uang_lembur: getOvertimeValue(item)
            }));

            await createBulkMutation.mutateAsync({
                tanggalDari: startDate,
                tanggalSampai: endDate,
                items: itemsToGenerate,
            });

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: `${itemsToGenerate.length} slip gaji berhasil dibuat`,
                variant: 'success'
            });
            onRefresh();
        } catch (error: any) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal generate bulk'),
                variant: 'error'
            });
        }
    };

    const openDetail = (slip: SlipGaji) => {
        setSelectedSlip(slip);
        setPayMetode('transfer');
        setIsSplitPayment(false);
        setPayments([]);
        if (Platform.OS !== 'web') bottomSheetRef.current?.expand();
    };

    const handleProcessPayment = async () => {
        if (!selectedSlip) return;

        if (isSplitPayment) {
            const totalSplitAmount = payments.reduce((acc, p) => acc + (parseNumber(p.nominal) || 0), 0);
            if (Math.round(totalSplitAmount) !== Math.round(Number(selectedSlip.gaji_bersih))) {
                setDialogConfig({
                    visible: true,
                    title: 'Validasi',
                    message: `Total pembayaran (${formatCurrency(totalSplitAmount)}) tidak sesuai dengan nominal gaji (${formatCurrency(selectedSlip.gaji_bersih)})`,
                    variant: 'warning'
                });
                return;
            }
        }

        // 1. Capture current slip data for the confirm alert and mutation
        const slipToPay = selectedSlip;
        const currentIsSplit = isSplitPayment;
        const currentPayments = [...payments];
        const currentMetode = payMetode.toUpperCase();

        // 2. Close sheet visually FIRST
        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        } else {
            setSelectedSlip(null);
        }

        // 3. Show confirm alert on main screen
        setDialogConfig({
            visible: true,
            title: 'Konfirmasi Pembayaran',
            message: `Proses pembayaran untuk ${slipToPay.karyawan_nama}?`,
            variant: 'info',
            type: 'confirm',
            onConfirm: async () => {
                // Clear the confirm dialog
                setDialogConfig(prev => ({ ...prev, visible: false }));
                
                try {
                    const payload: any = {
                        id: slipToPay.id,
                        data: currentIsSplit ? {
                            payments: currentPayments.map(p => ({
                                metode: p.metode.toUpperCase(),
                                nominal: parseNumber(p.nominal) || 0,
                                catatan: p.catatan
                            }))
                        } : { metode_bayar: currentMetode },
                    };

                    await processPaymentMutation.mutateAsync(payload);
                    
                    // Cleanup and Success feedback
                    setSelectedSlip(null);
                    setDialogConfig({ 
                        visible: true, 
                        title: 'Sukses', 
                        message: 'Pembayaran berhasil', 
                        variant: 'success' 
                    });
                    onRefresh();
                } catch (error: any) {
                    setDialogConfig({ 
                        visible: true, 
                        title: 'Error', 
                        message: getErrorMessage(error, 'Gagal bayar'), 
                        variant: 'error' 
                    });
                }
            }
        });
    };


    const handleVoidPayment = async () => {
        if (!selectedSlip) return;
        const slipToVoid = selectedSlip;

        // 1. Close sheet visually first
        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        } else {
            setSelectedSlip(null);
        }

        setDialogConfig({
            visible: true,
            title: 'Batalkan Pembayaran',
            message: `Yakin ingin membatalkan pembayaran untuk ${slipToVoid.karyawan_nama}? Tindakan ini akan mengembalikan saldo kas/bank.`,
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                try {
                    await voidPaymentMutation.mutateAsync(slipToVoid.id);
                    setSelectedSlip(null);
                    setDialogConfig({ visible: true, title: 'Sukses', message: 'Pembayaran dibatalkan', variant: 'success' });
                    onRefresh();
                } catch (error: any) {
                    setDialogConfig({ 
                        visible: true, 
                        title: 'Error', 
                        message: getErrorMessage(error, 'Gagal membatalkan pembayaran'), 
                        variant: 'error' 
                    });
                }
            }
        });
    };

    const handleDeleteSlip = async () => {
        if (!selectedSlip) return;
        const slipToDelete = selectedSlip;

        // 1. Close sheet visually first
        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        } else {
            setSelectedSlip(null);
        }

        setDialogConfig({
            visible: true,
            title: 'Hapus Slip',
            message: `Yakin ingin menghapus slip payroll ${slipToDelete.karyawan_nama}? Data yang dihapus tidak dapat dikembalikan.`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                try {
                    await deleteMutation.mutateAsync(slipToDelete.id);
                    setSelectedSlip(null);
                    setDialogConfig({ visible: true, title: 'Sukses', message: 'Slip payroll berhasil dihapus', variant: 'success' });
                    onRefresh();
                } catch (error: any) {
                    setDialogConfig({ 
                        visible: true, 
                        title: 'Error', 
                        message: getErrorMessage(error, 'Gagal menghapus slip'), 
                        variant: 'error' 
                    });
                }
            }
        });
    };
    const renderPendingItem = ({ item }: { item: SlipGajiPreviewItem }) => {
        const isGenerating = generatingId === item.karyawan_id;
        const currentAttendance = getAttendanceValue(item);
        const currentKasbon = getKasbonValue(item);
        const currentOvertime = getOvertimeValue(item);

        // Dynamic calculation: (Base / 6) * Current Attendance + Overtime - Kasbon
        const currentGajiPokok = Math.round((item.gaji_pokok_dasar / 6) * currentAttendance);
        const currentGajiBersih = currentGajiPokok + currentOvertime - currentKasbon;

        return (
            <Card className="mb-4 p-5 border border-gray-100 shadow-sm overflow-hidden">
                {/* Header Section: Profile & Attendance */}
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center flex-1 mr-4">
                        <View className="w-10 h-10 bg-amber-50 rounded-2xl items-center justify-center mr-3 border border-amber-100">
                            <User size={20} color="#F59E0B" />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain text-base" numberOfLines={1}>{item.karyawan_nama}</Typography>
                            <Typography variant="caption" className="text-gray-400 font-bold">{item.karyawan_kode}</Typography>
                        </View>
                    </View>

                    <View className="items-end">
                        <Typography className="text-[8px] text-gray-400 font-black uppercase mb-1 tracking-widest text-right">Kehadiran</Typography>
                        <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-100 px-3 py-1.5 min-w-[60px] justify-center">
                            <TextInput
                                className="text-primary font-black p-0 text-base"
                                keyboardType="numeric"
                                value={String(currentAttendance)}
                                onChangeText={(v) => handleUpdateAttendance(item.karyawan_id, v)}
                                selectTextOnFocus
                            />
                            <Typography className="text-gray-400 text-[10px] font-bold ml-1 uppercase">Hari</Typography>
                        </View>
                    </View>
                </View>

                {/* Salary Components Breakdown */}
                <View className="flex-row flex-wrap gap-2 mb-4">
                    <View className="bg-gray-50 px-3 py-2 rounded-2xl border border-gray-100 flex-row items-center">
                        <Typography className="text-[9px] text-gray-400 font-bold uppercase mr-1.5">Base Pay</Typography>
                        <Typography weight="bold" className="text-[11px] text-textMain">{formatCurrency(item.gaji_pokok_dasar)}</Typography>
                    </View>
                    <View className="bg-primary/5 px-3 py-2 rounded-2xl border border-primary/10 flex-row items-center">
                        <Typography className="text-[9px] text-primary/60 font-bold uppercase mr-1.5">Gaji Pokok</Typography>
                        <Typography weight="bold" className="text-[11px] text-primary">{formatCurrency(currentGajiPokok)}</Typography>
                    </View>
                    {item.total_kasbon > 0 && (
                        <View className="bg-rose-50 px-3 py-2 rounded-2xl border border-rose-100 flex-row items-center">
                            <Typography className="text-[9px] text-rose-400 font-bold uppercase mr-1.5">Utang Kasbon</Typography>
                            <Typography weight="bold" className="text-[11px] text-rose-600">{formatCurrency(item.total_kasbon)}</Typography>
                        </View>
                    )}
                </View>

                {/* Adjustment Inputs Row */}
                <View className="flex-row items-center space-x-3 mb-5">
                    <View className="flex-1">
                        <Typography className="text-[9px] text-emerald-500 font-black uppercase mb-1.5 tracking-wider ml-1">Uang Lembur (Rp)</Typography>
                        <View className="flex-row items-center bg-emerald-50/30 rounded-2xl border border-emerald-100/50 px-4 py-3">
                            <TextInput
                                className="flex-1 text-emerald-600 font-black p-0 text-base"
                                keyboardType="numeric"
                                value={formatNumber(String(currentOvertime))}
                                onChangeText={(v) => handleUpdateOvertime(item.karyawan_id, parseNumber(v).toString())}
                                selectTextOnFocus
                                placeholder="0"
                            />
                        </View>
                    </View>
                    <View className="flex-1">
                        <Typography className="text-[9px] text-rose-500 font-black uppercase mb-1.5 tracking-wider ml-1">Potong Kasbon (Rp)</Typography>
                        <View className="flex-row items-center bg-rose-50/30 rounded-2xl border border-rose-100/50 px-4 py-3">
                            <TextInput
                                className="flex-1 text-rose-600 font-black p-0 text-base"
                                keyboardType="numeric"
                                value={formatNumber(String(currentKasbon))}
                                onChangeText={(v) => handleUpdateKasbon(item.karyawan_id, parseNumber(v).toString())}
                                selectTextOnFocus
                                placeholder="0"
                            />
                        </View>
                    </View>
                </View>

                {/* Footer Section: Total & Process */}
                <View className="pt-4 border-t border-gray-100 flex-row items-center justify-between">
                    <View>
                        <Typography className="text-[8px] text-textGray/40 font-black uppercase tracking-[2px] mb-1">Gaji Bersih Diterima</Typography>
                        <Typography weight="bold" className="text-2xl text-emerald-600 tracking-tighter">{formatCurrency(currentGajiBersih)}</Typography>
                    </View>

                    <Pressable
                        onPress={() => handleGenerateSingle(item)}
                        disabled={isGenerating || !!generatingId}
                        className={`h-14 px-6 rounded-2xl flex-row items-center justify-center ${isGenerating ? 'bg-gray-100' : 'bg-primary shadow-lg shadow-primary/30'}`}
                    >
                        {isGenerating ? (
                            <ActivityIndicator size="small" color="#023C69" />
                        ) : (
                            <>
                                <Typography className="text-white text-xs font-black uppercase tracking-widest mr-2">Proses</Typography>
                                <ArrowRight size={16} color="white" />
                            </>
                        )}
                    </Pressable>
                </View>
            </Card>
        );
    };

    const renderHistoryItem = ({ item }: { item: SlipGaji }) => {
        const isLunas = item.status?.toUpperCase() === 'LUNAS';
        return (
            <Pressable onPress={() => openDetail(item)} >
                <Card className="mb-4 p-5 border border-gray-100 shadow-sm">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isLunas ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                <FileText size={24} color={isLunas ? '#10B981' : '#F59E0B'} />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-textMain">{item.karyawan_nama}</Typography>
                                <View className="flex-row items-center mt-1">
                                    <View className="bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100 mr-2">
                                        <Typography className="text-primary text-[10px] font-bold">{item.jumlah_hadir} HARI</Typography>
                                    </View>
                                    <Typography weight="bold" className="text-gray-400 text-xs">
                                        • {formatCurrency(item.gaji_bersih)}
                                    </Typography>
                                </View>
                            </View>
                        </View>
                        <Badge
                            label={isLunas ? 'LUNAS' : 'PENDING'}
                            variant={isLunas ? 'success' : 'warning'}
                        />
                    </View>
                </Card>
            </Pressable>
        );
    };

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header 
                title="Payroll"
                subtitle="Sistem Gaji Mingguan"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
            />

            <ScrollView 
                className="flex-1"
                contentContainerStyle={{ paddingTop: 24, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {/* Range Selection Card - Unified Periode */}
                <View className="mx-6 mb-6">
                    <Card className="p-6 rounded-[32px] shadow-xl border border-gray-100 mb-4 bg-white">
                        <Typography className="text-textGray/40 text-[10px] font-black uppercase tracking-[2px] mb-4 text-center">Periode Laporan & Slip</Typography>
                        
                        <View className="flex-row items-center justify-between pb-4 border-b border-gray-50">
                            <Pressable
                                onPress={() => { setDatePickingMode('start'); setShowDatePicker(true); }}
                                className="flex-1 items-center"
                                hitSlop={10}
                            >
                                <Typography className="text-textGray/40 text-[8px] font-black uppercase tracking-widest mb-1">Dari Tanggal</Typography>
                                <Typography className="text-textMain font-bold text-base">{startDate}</Typography>
                            </Pressable>
                            
                            <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                                <ArrowRight size={16} color="#023C69" />
                            </View>

                            <Pressable
                                onPress={() => { setDatePickingMode('end'); setShowDatePicker(true); }}
                                className="flex-1 items-center"
                                hitSlop={10}
                            >
                                <Typography className="text-textGray/40 text-[8px] font-black uppercase tracking-widest mb-1">Sampai Tanggal</Typography>
                                <Typography className="text-textMain font-bold text-base">{endDate}</Typography>
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => { setDatePickingMode('slip'); setShowDatePicker(true); }}
                            className="mt-4 bg-primary/5 rounded-2xl p-4 flex-row items-center justify-between border border-primary/10"
                            hitSlop={10}
                        >
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
                                    <Calendar size={20} color="#023C69" />
                                </View>
                                <View>
                                    <Typography className="text-textGray/40 text-[8px] font-black uppercase tracking-widest">Tanggal Cetak Slip</Typography>
                                    <Typography className="text-textMain font-bold text-sm">{slipDate}</Typography>
                                </View>
                            </View>
                            <View className="bg-primary/20 px-3 py-1.5 rounded-full">
                                <Typography className="text-primary text-[8px] font-black uppercase">Ubah</Typography>
                            </View>
                        </Pressable>
                    </Card>
                </View>

                {/* Search & Tabs Area */}
                <View className="flex-1">
                    <View className="mx-6 bg-white rounded-[40px] shadow-2xl border border-gray-50 overflow-hidden min-h-[500px]">

                    {/* Glassmorphic Search */}
                    <View className="px-6 pt-6 pb-2">
                        <View className="bg-gray-50 px-5 py-4 rounded-[24px] border border-gray-100 flex-row items-center shadow-inner">
                            <Search size={20} color="#D1D5DB" strokeWidth={2.5} />
                            <TextInput
                                className="flex-1 ml-4 text-textMain font-medium"
                                placeholder="Cari karyawan..."
                                placeholderTextColor="#D1D5DB"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Modern Tab Switcher */}
                    <View className="flex-row p-4 space-x-2">
                        <Pressable
                            onPress={() => setActiveTab('pending')}
                            className={`flex-1 py-4 items-center rounded-3xl flex-row justify-center ${activeTab === 'pending' ? 'bg-primary border border-white/10 shadow-lg shadow-primary/30' : 'bg-gray-50'}`}
                        >
                            <Clock size={18} color={activeTab === 'pending' ? 'white' : '#9CA3AF'} className="mr-2" />
                            <Typography weight="bold" className={activeTab === 'pending' ? 'text-white' : 'text-gray-400'}>
                                Belum ({filteredPending.length})
                            </Typography>
                        </Pressable>

                        <Pressable
                            onPress={() => setActiveTab('history')}
                            className={`flex-1 py-4 items-center rounded-3xl flex-row justify-center ${activeTab === 'history' ? 'bg-primary border border-white/10 shadow-lg shadow-primary/30' : 'bg-gray-50'}`}
                        >
                            <CheckCircle2 size={18} color={activeTab === 'history' ? 'white' : '#9CA3AF'} className="mr-2" />
                            <Typography weight="bold" className={activeTab === 'history' ? 'text-white' : 'text-gray-400'}>
                                Riwayat ({filteredHistory.length})
                            </Typography>
                        </Pressable>
                    </View>

                    {/* Dynamic List */}
                    <View className="flex-1 bg-white">
                        {activeTab === 'pending' ? (
                            <FlatList
                                data={filteredPending}
                                renderItem={renderPendingItem}
                                keyExtractor={(item) => item.karyawan_id.toString()}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                                ListEmptyComponent={
                                    <View className="items-center py-20 px-10">
                                        {isLoadingPreview ? (
                                            <ActivityIndicator size="large" color="#023C69" />
                                        ) : (
                                            <>
                                                <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                                                    <CheckCircle2 size={40} color="#D1D5DB" />
                                                </View>
                                                <Typography className="text-gray-400 text-center font-medium">
                                                    Semua karyawan minggu ini sudah diproses.
                                                </Typography>
                                            </>
                                        )}
                                    </View>
                                }
                            />
                        ) : (
                            <FlatList
                                data={filteredHistory}
                                renderItem={renderHistoryItem}
                                keyExtractor={(item) => item.id.toString()}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 10 }}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                                ListEmptyComponent={
                                    <View className="items-center py-20 px-10">
                                        {isLoadingList ? (
                                            <ActivityIndicator size="large" color="#023C69" />
                                        ) : (
                                            <>
                                                <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                                                    <FileText size={40} color="#D1D5DB" />
                                                </View>
                                                <Typography className="text-gray-400 text-center font-medium">
                                                    Belum ada riwayat slip gaji untuk periode ini.
                                                </Typography>
                                            </>
                                        )}
                                    </View>
                                }
                            />
                        )}
                    </View>

                    {/* Bulk Generate FAB */}
                    {activeTab === 'pending' && filteredPending.length > 0 && (
                        <View className="absolute bottom-6 left-6 right-6">
                            <Pressable
                                onPress={handleGenerateBulk}
                                disabled={createBulkMutation.isPending}
                                className="bg-primary h-16 rounded-[24px] items-center justify-center flex-row shadow-2xl border border-white/20"
                            >
                                {createBulkMutation.isPending ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <Typography weight="bold" className="text-white text-lg mr-2">Generate Semua ({filteredPending.length})</Typography>
                                        <TrendingUp size={20} color="white" />
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}
                    </View>
                </View>
            </ScrollView>

            {/* Summary Panel for History */}
            {activeTab === 'history' && summary && (
                <View className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-[48px] shadow-2xl border-t border-gray-100 flex-row items-center justify-between">
                    <View>
                        <Typography className="text-textGray/40 text-[10px] font-black uppercase tracking-wider mb-1">Total Pengeluaran</Typography>
                        <Typography className="text-textMain text-xl font-black">{formatCurrency(summary.total_dibayar + summary.total_belum_dibayar)}</Typography>
                    </View>
                    <View className="items-end">
                        <Typography className="text-amber-500 font-bold text-xs">Belum: {formatCurrency(summary.total_belum_dibayar)}</Typography>
                        <Typography className="text-emerald-600 font-bold text-xs">Sudah: {formatCurrency(summary.total_dibayar)}</Typography>
                    </View>
                </View>
            )}

            {/* Detail Sheet */}
            {Platform.OS === 'web' ? (
                <Modal visible={!!selectedSlip} transparent animationType="slide" onRequestClose={() => setSelectedSlip(null)}>
                    <View className="flex-1 justify-end bg-black/40">
                        <Pressable className="absolute inset-0" onPress={() => setSelectedSlip(null)} />
                        <View className="bg-white rounded-t-[56px] w-full max-w-[640px] h-[85%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView className="px-10 flex-1">
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
                    backgroundStyle={{ borderRadius: 56, backgroundColor: 'white' }}
                    onClose={() => setSelectedSlip(null)}
                >
                    <BottomSheetScrollView className="px-10">
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

            {/* Date Picker Modal */}
            <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                <View className="flex-1 justify-center bg-black/50 px-6">
                    <Card className="rounded-[40px] overflow-hidden p-0 border border-gray-100 shadow-2xl">
                        <View className="bg-primary p-6 flex-row justify-between items-center">
                            <Typography weight="bold" className="text-white text-lg">
                                {datePickingMode === 'start' ? 'Pilih Tanggal Mulai' :
                                    datePickingMode === 'end' ? 'Pilih Tanggal Selesai' :
                                        'Pilih Tanggal Slip'}
                            </Typography>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <X size={24} color="white" />
                            </Pressable>
                        </View>
                        <View className="p-4">
                            <RNCalendar // Renamed Calendar to RNCalendar
                                onDayPress={(day: any) => {
                                    if (datePickingMode === 'start') setStartDate(day.dateString);
                                    else if (datePickingMode === 'end') setEndDate(day.dateString);
                                    else setSlipDate(day.dateString);
                                    setShowDatePicker(false);
                                }}
                                markedDates={{
                                    [datePickingMode === 'start' ? startDate :
                                        datePickingMode === 'end' ? endDate : slipDate]:
                                        { selected: true, selectedColor: '#023C69' }
                                }}
                                theme={{
                                    todayTextColor: '#023C69',
                                    selectedDayBackgroundColor: '#023C69',
                                    arrowColor: '#023C69',
                                    monthTextColor: '#023C69',
                                    textDayFontWeight: '500',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: 'bold',
                                }}
                            />
                        </View>
                    </Card>
                </View>
            </Modal>
        </View>
    );

    function renderDetailContent() {
        if (!selectedSlip) return null;
        const isLunas = selectedSlip.status?.toUpperCase() === 'LUNAS';

        return (
            <View className="pb-16">
                <View className="flex-row justify-between items-center mb-10">
                    <Typography variant="h2" weight="bold" className="text-3xl tracking-tight">Payroll Detail</Typography>
                    <Pressable onPress={() => Platform.OS === 'web' ? setSelectedSlip(null) : bottomSheetRef.current?.close()} className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                        <X size={24} color="#6B7280" />
                    </Pressable>
                </View>

                <View className="items-center mb-12">
                    <View className="p-1 bg-primary/5 rounded-[40px] border border-primary/10 mb-6">
                        <View className="w-24 h-24 bg-primary/10 rounded-[36px] items-center justify-center">
                            <User size={48} color="#023C69" />
                        </View>
                    </View>
                    <Typography variant="h2" weight="bold" className="text-2xl text-textMain text-center">{selectedSlip.karyawan_nama}</Typography>
                    <Typography className="text-textGray mt-1 font-medium text-lg">W{selectedSlip.periode_minggu} • {selectedSlip.periode_tahun}</Typography>

                    <View className="mt-6">
                        <Badge
                            label={isLunas ? 'TRANSFER BERHASIL' : 'MENUNGGU KONFIRMASI'}
                            variant={isLunas ? 'success' : 'warning'}
                            className="px-6 py-2"
                        />
                    </View>
                </View>

                {/* Info Bento Grid */}
                <View className="bg-gray-50 p-8 rounded-[48px] border border-gray-100 shadow-sm mb-10">
                    <View className="flex-row justify-between items-center mb-6 pb-6 border-b border-gray-200/50">
                        <Typography className="text-textGray/60 text-sm font-bold uppercase tracking-widest">Gaji Pokok</Typography>
                        <Typography weight="bold" className="text-textMain text-lg">{formatCurrency(selectedSlip.gaji_pokok)}</Typography>
                    </View>
                    <View className="flex-row justify-between items-center mb-6 pb-6 border-b border-gray-200/50">
                        <Typography className="text-textGray/60 text-sm font-bold uppercase tracking-widest">Kehadiran</Typography>
                        <Typography weight="bold" className="text-textMain text-lg">{selectedSlip.jumlah_hadir} Hari</Typography>
                    </View>
                    <View className="flex-row justify-between items-center mb-6 pb-6 border-b border-gray-200/50">
                        <Typography className="text-textGray/60 text-sm font-bold uppercase tracking-widest">Uang Lembur</Typography>
                        <Typography weight="bold" className="text-emerald-600 text-lg">+{formatCurrency(selectedSlip.uang_lembur || 0)}</Typography>
                    </View>
                    <View className="flex-row justify-between items-center mb-8">
                        <Typography className="text-textGray/60 text-sm font-bold uppercase tracking-widest">Potongan Kasbon</Typography>
                        <Typography weight="bold" className="text-rose-500 text-lg">-{formatCurrency(selectedSlip.potongan_kasbon)}</Typography>
                    </View>

                    <View className="bg-white p-6 rounded-[32px] border border-primary/10 flex-row items-center justify-between shadow-xl">
                        <Typography weight="bold" className="text-primary uppercase text-xs tracking-[2px]">Total Gaji Bersih</Typography>
                        <Typography weight="bold" className="text-primary text-2xl tracking-tighter">
                            {formatCurrency(selectedSlip.gaji_bersih)}
                        </Typography>
                    </View>
                </View>

                {!isLunas && (
                    <View>
                        <View className="flex-row justify-between items-center mb-4">
                            <Typography className="text-textGray/60 font-black text-[10px] uppercase tracking-[3px] ml-2">Metode Pembayaran</Typography>
                            <Pressable
                                onPress={() => {
                                    if (!isSplitPayment) {
                                        setPayments([{ id: Date.now(), metode: payMetode.toUpperCase(), nominal: selectedSlip.gaji_bersih.toString() }]);
                                    }
                                    setIsSplitPayment(!isSplitPayment);
                                }}
                                className={`px-4 py-2 rounded-full border ${isSplitPayment ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}
                            >
                                <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {isSplitPayment ? 'BATALKAN SPLIT' : 'SPLIT PAYMENT?'}
                                </Typography>
                            </Pressable>
                        </View>

                        {isSplitPayment ? (
                            <View className="mb-6">
                                {payments.map((p, idx) => (
                                    <View key={p.id} className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 mb-4">
                                        <View className="flex-row justify-between items-center mb-4">
                                            <Typography weight="bold" className="text-primary text-xs tracking-widest uppercase">POS PEMBAYARAN #{idx + 1}</Typography>
                                            {payments.length > 1 && (
                                                <Pressable onPress={() => setPayments(payments.filter(pay => pay.id !== p.id))} className="w-8 h-8 items-center justify-center bg-rose-100 rounded-full">
                                                    <X size={14} color="#E11D48" />
                                                </Pressable>
                                            )}
                                        </View>

                                        <View className="flex-row flex-wrap gap-2 mb-4">
                                            {['TUNAI', 'TRANSFER'].map((m) => (
                                                <Pressable
                                                    key={m}
                                                    onPress={() => setPayments(payments.map(pay => pay.id === p.id ? { ...pay, metode: m } : pay))}
                                                    className={`px-4 py-2 rounded-xl border ${p.metode === m ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                                >
                                                    <Typography className={p.metode === m ? 'text-primary' : 'text-textGray'} weight="bold" variant="caption">{m}</Typography>
                                                </Pressable>
                                            ))}
                                        </View>

                                        <View className="bg-white px-4 py-3 rounded-2xl border border-gray-200 flex-row items-center">
                                            <Typography className="text-gray-400 font-bold mr-2">Rp</Typography>
                                            <TextInput
                                                className="flex-1 text-textMain font-bold text-lg"
                                                keyboardType="numeric"
                                                placeholder="0"
                                                value={formatNumber(p.nominal)}
                                                onChangeText={(v) => setPayments(payments.map(pay => pay.id === p.id ? { ...pay, nominal: formatNumber(v) } : pay))}
                                            />
                                        </View>
                                    </View>
                                ))}

                                <Pressable
                                    onPress={() => setPayments([...payments, { id: Date.now(), metode: 'TUNAI', nominal: '0' }])}
                                    className="flex-row items-center justify-center py-4 rounded-3xl border border-dashed border-gray-300"
                                >
                                    <Typography weight="bold" className="text-gray-400 text-xs uppercase">+ TAMBAH METODE</Typography>
                                </Pressable>

                                <View className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex-row justify-between items-center">
                                    <Typography className="text-primary text-[10px] font-black uppercase tracking-widest">Total Dialokasikan</Typography>
                                    <Typography weight="bold" className="text-primary">{formatCurrency(payments.reduce((acc, p) => acc + (parseNumber(p.nominal) || 0), 0))}</Typography>
                                </View>
                            </View>
                        ) : (
                            <View className="flex-row space-x-4 mb-6">
                                {['tunai', 'transfer'].map((m) => (
                                    <Pressable
                                        key={m}
                                        onPress={() => setPayMetode(m)}
                                        className={`flex-1 py-5 items-center rounded-3xl border ${payMetode === m ? 'border-primary bg-primary shadow-2xl shadow-primary/30' : 'border-gray-200 bg-white'}`}
                                    >
                                        <Typography className={payMetode === m ? 'text-white' : 'text-textGray'} weight="bold">{m.toUpperCase()}</Typography>
                                    </Pressable>
                                ))}
                            </View>
                        )}

                        <Pressable
                            onPress={handleDeleteSlip}
                            disabled={deleteMutation.isPending}
                            className="bg-rose-50 h-14 rounded-2xl items-center justify-center flex-row border border-rose-100 mt-4"
                        >
                            {deleteMutation.isPending ? <ActivityIndicator color="#E11D48" /> : (
                                <>
                                    <Typography weight="bold" className="text-rose-600 mr-2 text-xs uppercase">Hapus Slip Payroll</Typography>
                                    <Trash size={14} color="#E11D48" />
                                </>
                            )}
                        </Pressable>

                        <Pressable
                            onPress={handleProcessPayment}
                            disabled={processPaymentMutation.isPending}
                            className="bg-primary h-20 rounded-[32px] items-center justify-center shadow-2xl shadow-primary/40 mt-6 border border-white/20"
                        >
                            {processPaymentMutation.isPending ? <ActivityIndicator color="white" /> : (
                                <Typography weight="bold" className="text-white text-xl">Selesaikan Pembayaran</Typography>
                            )}
                        </Pressable>
                    </View>
                )}

                {isLunas && selectedSlip.tanggal_bayar && (
                    <View>
                        <View className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 flex-row items-center mb-6">
                            <View className="w-14 h-14 bg-emerald-100 rounded-2xl items-center justify-center mr-5">
                                <Calendar size={28} color="#059669" />
                            </View>
                            <View>
                                <Typography className="text-emerald-900 font-bold text-lg">Dana Terkirim</Typography>
                                <Typography className="text-emerald-600/60 font-medium text-sm">Pada {formatDate(selectedSlip.tanggal_bayar)}</Typography>
                            </View>
                        </View>

                        <Pressable
                            onPress={handleVoidPayment}
                            disabled={voidPaymentMutation.isPending}
                            className="bg-rose-50 h-16 rounded-[24px] items-center justify-center flex-row border border-rose-100 mt-2"
                        >
                            {voidPaymentMutation.isPending ? <ActivityIndicator color="#E11D48" /> : (
                                <>
                                    <Typography weight="bold" className="text-rose-600 mr-2 text-sm">BATALKAN PEMBAYARAN</Typography>
                                    <X size={16} color="#E11D48" />
                                </>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>
        );
    }
}
