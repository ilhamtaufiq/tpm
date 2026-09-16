import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl, ActivityIndicator, Platform, Modal } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { appAlert } from '../../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
    Receipt,
    Plus,
    X,
    ChevronLeft,
    ChevronRight,
    Wallet,
    Wrench,
    Package,
    Info,
    Calendar,
    TrendingDown,
    Search,
    Split,
    Trash2,
    Truck,
    Car,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { format as formatDateFns, subDays, addDays, subMonths, addMonths, subYears, addYears } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { usePengeluaranList, useCreatePengeluaran, usePengeluaranSummary } from '../../../hooks/useBengkel';
import { Header } from '../../../components/ui/Header';
import { useQueryClient } from '@tanstack/react-query';
import { offlineAwareWrite } from '../../../services/offlineQueue';
import { formatNumber, parseNumber, formatCurrency, formatDate } from '../../../utils/format';
import { AKUN, akunUntukUnit, metodeDariAkun } from '../../../utils/expenseAkun';
import { ArmadaSelector } from '../../../components/ui/ArmadaSelector';
import { MobilSelector } from '../../../components/ui/MobilSelector';
import { SparePartSelector } from '../../../components/ui/SparePartSelector';
import { getCustomTabBarBottomPadding } from '../../../components/ui/CustomTabBar';

const CATEGORIES = [
    { label: 'Prive', value: 'PRIVE', icon: Wallet, color: '#F59E0B' },
    { label: 'Biaya Operasional', value: 'BIAYA_OPERASIONAL', icon: Wrench, color: '#023C69' },
    { label: 'Biaya Lainnya', value: 'BIAYA_LAINNYA', icon: Info, color: '#6B7280' },
];

const BISNIS_KATEGORI = [
    { label: 'Umum', value: 'umum', icon: Info, color: '#6B7280' },
    { label: 'Bengkel', value: 'bengkel', icon: Wrench, color: '#F59E0B' },
    { label: 'Jasa Angkut', value: 'jasa_angkut', icon: Truck, color: '#10B981' },
    { label: 'Jual Beli Mobil', value: 'jual_beli_mobil', icon: Car, color: '#3B82F6' },
];


const PERIODS = [
    { id: 'all', label: 'Semua' },
    { id: 'daily', label: 'Hari' },
    { id: 'monthly', label: 'Bulan' },
    { id: 'yearly', label: 'Tahun' },
] as const;

export default function ExpensesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [period, setPeriod] = useState<'all' | 'daily' | 'monthly' | 'yearly'>('all');
    const [refDate, setRefDate] = useState(new Date());
    const [showForm, setShowForm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Form State
    const [kategori, setKategori] = useState('BIAYA_OPERASIONAL');
    const [bisnisKategori, setBisnisKategori] = useState('umum');
    const [selectedMuatan, setSelectedMuatan] = useState<any>(null);
    const [selectedMobil, setSelectedMobil] = useState<any>(null);
    const [selectedArmada, setSelectedArmada] = useState<any>(null);
    const [selectedSparePart, setSelectedSparePart] = useState<any>(null);

    const [jumlah, setJumlah] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [payMetode, setPayMetode] = useState('');
    const [kasJenis, setKasJenis] = useState<string | null>('KAS_UTAMA');
    const [splitPayments, setSplitPayments] = useState([
        { metode: 'TUNAI', jumlah: '', kas_jenis: 'KAS_UTAMA' },
        { metode: 'TRANSFER', jumlah: '', kas_jenis: 'BANK_UTAMA' },
    ]);
    const [allowNegative, setAllowNegative] = useState(false);

    // API Hooks
    const { data: expensesData, isLoading, refetch } = usePengeluaranList();
    const { data: summaryData } = usePengeluaranSummary();
    const queryClient = useQueryClient();
    const createExpenseMutation = useCreatePengeluaran();

    const expenses = expensesData?.data || [];

    // Rentang periode relatif ke refDate, yang bisa digeser lewat tombol panah.
    const filteredExpenses = useMemo(() => {
        if (period === 'all') return expenses;
        return expenses.filter((item: any) => {
            const d = new Date(item.tanggal);
            if (isNaN(d.getTime())) return false;
            if (period === 'daily') return d.toDateString() === refDate.toDateString();
            if (period === 'monthly') return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
            return d.getFullYear() === refDate.getFullYear();
        });
    }, [expenses, period, refDate]);

    const shiftDate = (dir: 1 | -1) => {
        setRefDate((curr) => {
            if (period === 'monthly') return dir === 1 ? addMonths(curr, 1) : subMonths(curr, 1);
            if (period === 'yearly') return dir === 1 ? addYears(curr, 1) : subYears(curr, 1);
            return dir === 1 ? addDays(curr, 1) : subDays(curr, 1);
        });
    };

    const periodLabel = useMemo(() => {
        if (period === 'daily') return formatDateFns(refDate, 'dd MMM yyyy', { locale: localeID });
        if (period === 'monthly') return formatDateFns(refDate, 'MMMM yyyy', { locale: localeID });
        return formatDateFns(refDate, 'yyyy');
    }, [period, refDate]);

    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['95%'], []);

    const openForm = () => {
        setShowForm(true);
        if (Platform.OS !== 'web') sheetRef.current?.expand();
    };

    const closeForm = useCallback(() => {
        setShowForm(false);
        if (Platform.OS !== 'web') sheetRef.current?.close();
    }, []);

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/finance');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetch()]);
        setRefreshing(false);
    }, [refetch]);

    const handleSave = async () => {
        if (!jumlah || !deskripsi) {
            appAlert('Validasi', 'Mohon isi jumlah dan keterangan');
            return;
        }

        const totalAmount = parseNumber(jumlah);
        const isSplit = payMetode === 'SPLIT';

        // SPLIT tidak butuh akun di level transaksi: akun diatur per baris.
        if (!isSplit && !kasJenis) {
            appAlert('Validasi', 'Mohon pilih sumber dana (akun)');
            return;
        }
        if (isSplit && splitPayments.some((p) => !p.kas_jenis)) {
            appAlert('Validasi', 'Mohon pilih akun untuk setiap baris split');
            return;
        }

        const payload: any = {
            tanggal: new Date().toISOString().split('T')[0],
            kategori,
            bisnis_kategori: bisnisKategori,
            muatan_id: selectedMuatan?.id || null,
            armada_id: selectedArmada?.id || null,
            mobil_id: selectedMobil?.id || null,
            spare_part_id: selectedSparePart?.id || null,
            jumlah: totalAmount,
            deskripsi,
            // SPLIT: akun diatur per baris, jadi tidak diisi di level ini.
            metode_bayar: isSplit ? 'SPLIT' : metodeDariAkun(kasJenis),
            kas_jenis: isSplit ? null : kasJenis,
            allow_negative: allowNegative,
        };

        if (isSplit) {
            const totalSplit = splitPayments.reduce((acc, curr) => acc + parseNumber(curr.jumlah), 0);
            if (totalSplit !== totalAmount) {
                appAlert(
                    'Validasi Split Payment',
                    `Total pembayaran split (${formatCurrency(totalSplit)}) harus sama dengan total pengeluaran (${formatCurrency(totalAmount)}).\n\nSelisih: ${formatCurrency(totalAmount - totalSplit)}`
                );
                return;
            }
            payload.payments = splitPayments.map(p => ({
                metode: metodeDariAkun(p.kas_jenis),
                jumlah: parseNumber(p.jumlah),
                kas_jenis: p.kas_jenis,
            }));
        }

        try {
            const result = await offlineAwareWrite(queryClient, {
                type: 'bengkel.createPengeluaran',
                payload,
                label: 'Pengeluaran',
                description: String(payload.deskripsi || ''),
                onlineFn: () => createExpenseMutation.mutateAsync(payload),
            });
            closeForm();
            setJumlah('');
            setDeskripsi('');
            setKategori('BIAYA_OPERASIONAL');
            setBisnisKategori('umum');
            setKasJenis('KAS_UTAMA');
            if (result.mode === 'offline') {
                setSelectedMuatan(null);
                setSelectedMobil(null);
                setSelectedArmada(null);
                setSelectedSparePart(null);
                setPayMetode('');
                setSplitPayments([
                    { metode: 'TUNAI', jumlah: '', kas_jenis: 'KAS_UTAMA' },
                    { metode: 'TRANSFER', jumlah: '', kas_jenis: 'BANK_UTAMA' },
                ]);
                setAllowNegative(false);
                appAlert(
                    'Offline Mode',
                    'Pengeluaran tersimpan di antrean offline (perangkat). Akan dikirim saat online.'
                );
                return;
            }
            // continue online reset below (selected refs already need reset)
            setSelectedMuatan(null);
            setSelectedMobil(null);
            setSelectedArmada(null);
            setSelectedSparePart(null);
            setPayMetode('');
            setSplitPayments([
                { metode: 'TUNAI', jumlah: '', kas_jenis: 'KAS_UTAMA' },
                { metode: 'TRANSFER', jumlah: '', kas_jenis: 'BANK_UTAMA' },
            ]);
            setAllowNegative(false);
            appAlert('Sukses', 'Pengeluaran berhasil dicatat');
        } catch (error: any) {
            console.error('Failed to save expense:', error);
            appAlert(
                'Gagal',
                error?.response?.data?.detail || 'Terjadi kesalahan saat menyimpan data'
            );
        }
    };

    const renderFormContent = () => (
        <>
            <Typography variant="h3" weight="bold" className="mb-6 tracking-tight text-primary">Input Pengeluaran Baru</Typography>
                            <View className="space-y-6">
                                {/* Kategori Selection */}
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-textGray mb-3 px-1 uppercase tracking-widest">Kategori</Typography>
                                    <View className="flex-row space-x-2">
                                        {CATEGORIES.map((cat) => (
                                            <Pressable
                                                key={cat.value}
                                                onPress={() => setKategori(cat.value)}
                                                className={`flex-1 p-3 rounded-2xl border items-center ${kategori === cat.value
                                                    ? 'bg-primary/5 border-primary shadow-sm'
                                                    : 'bg-surface border-gray-100'
                                                    }`}
                                            >
                                                <cat.icon size={18} color={kategori === cat.value ? '#023C69' : '#9CA3AF'} />
                                                <Typography
                                                    weight={kategori === cat.value ? 'bold' : 'medium'}
                                                    className={`text-[9px] mt-2 tracking-tighter ${kategori === cat.value ? 'text-primary' : 'text-textGray'}`}
                                                    numberOfLines={1}
                                                >
                                                    {cat.label.split(' ')[1] || cat.label}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                {/* Kaitan Bisnis */}
                                <View>
                                    <View className="flex-row justify-between items-center mb-3">
                                        <Typography variant="caption" weight="bold" className="text-textGray px-1 uppercase tracking-widest">Kaitan Bisnis</Typography>
                                        <Badge label={bisnisKategori === 'umum' ? 'General' : bisnisKategori.replace('_', ' ')} variant="neutral" className="px-1.5 py-0" />
                                    </View>
                                    <View className="flex-row space-x-2 mb-4">
                                        {BISNIS_KATEGORI.map((cat) => (
                                            <Pressable
                                                key={cat.value}
                                                onPress={() => {
                                                    setBisnisKategori(cat.value);
                                                    if (cat.value === 'umum') {
                                                        setSelectedMuatan(null);
                                                        setSelectedMobil(null);
                                                        setSelectedArmada(null);
                                                        setSelectedSparePart(null);
                                                    }
                                                    // Akun direset agar operator memilih ulang sesuai unit baru.
                                                    setKasJenis(null);
                                                    setPayMetode('');
                                                }}
                                                className={`flex-1 p-3 rounded-2xl border items-center ${bisnisKategori === cat.value
                                                    ? 'bg-primary border-primary shadow-sm'
                                                    : 'bg-surface border-gray-100'
                                                    }`}
                                            >
                                                <cat.icon size={18} color={bisnisKategori === cat.value ? '#FFFFFF' : '#9CA3AF'} />
                                                <Typography
                                                    weight={bisnisKategori === cat.value ? 'bold' : 'medium'}
                                                    className={`text-[9px] mt-2 tracking-tighter ${bisnisKategori === cat.value ? 'text-white' : 'text-textGray'}`}
                                                    numberOfLines={1}
                                                >
                                                    {cat.label}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>

                                    {bisnisKategori === 'jasa_angkut' && (
                                        <View className="bg-background p-4 rounded-3xl border border-transparent space-y-2">
                                            <ArmadaSelector
                                                label="ARMADA (TRUK)"
                                                placeholder="Pilih Armada..."
                                                value={selectedArmada}
                                                onSelect={setSelectedArmada}
                                            />
                                        </View>
                                    )}
                                    
                                    {bisnisKategori === 'bengkel' && (
                                        <View className="bg-background p-4 rounded-3xl border border-transparent">
                                            <SparePartSelector
                                                label="SPAREPART (JIKA ADA)"
                                                placeholder="Pilih Sparepart..."
                                                value={selectedSparePart}
                                                onSelect={setSelectedSparePart}
                                            />
                                        </View>
                                    )}

                                    {bisnisKategori === 'jual_beli_mobil' && (
                                        <View className="bg-background p-4 rounded-3xl border border-transparent">
                                            <MobilSelector
                                                label="UNIT MOBIL"
                                                placeholder="Pilih Unit Mobil..."
                                                value={selectedMobil}
                                                onSelect={setSelectedMobil}
                                            />
                                        </View>
                                    )}
                                    {/* Account Selection - Always Show */}
                                    <View className="mb-6">
                                        <Typography variant="caption" weight="bold" className="text-textGray mb-3 px-1 uppercase tracking-widest">Sumber Dana (Akun)</Typography>
                                        <View className="flex-row flex-wrap">
                                            {AKUN.map((opt) => {
                                                // Sorot akun yang cocok dengan kategori bisnis terpilih.
                                                const isRelevant = bisnisKategori === 'umum'
                                                    ? opt.value === 'KAS_UTAMA' || opt.value === 'BANK_UTAMA'
                                                    : akunUntukUnit(bisnisKategori) === opt.value;

                                                return (
                                                    <Pressable
                                                        key={opt.value}
                                                        onPress={() => {
                                                            setKasJenis(opt.value);
                                                            setPayMetode(metodeDariAkun(opt.value));
                                                        }}
                                                        className={`mr-2 mb-2 px-4 py-3 rounded-2xl border items-center ${kasJenis === opt.value
                                                            ? 'bg-primary border-primary shadow-sm'
                                                            : isRelevant ? 'bg-primary/5 border-primary/20' : 'bg-surface border-gray-100'
                                                            }`}
                                                    >
                                                        <Typography
                                                            weight={kasJenis === opt.value ? 'bold' : 'medium'}
                                                            className={`text-[10px] tracking-tight ${kasJenis === opt.value ? 'text-white' : isRelevant ? 'text-primary' : 'text-textGray'}`}
                                                        >
                                                            {opt.label}
                                                        </Typography>
                                                        <Typography
                                                            className={`text-[8px] mt-0.5 ${kasJenis === opt.value ? 'text-white/70' : 'text-textGray'}`}
                                                        >
                                                            {metodeDariAkun(opt.value)}
                                                        </Typography>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </View>
                                </View>

                                <Input
                                    label="Keterangan Pengeluaran"
                                    placeholder="Contoh: Listrik, Sparepart, dll"
                                    value={deskripsi}
                                    onChangeText={setDeskripsi}
                                    containerClassName="mb-0"
                                />

                                <Input
                                    label="Jumlah Nominal (Rp)"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={jumlah}
                                    onChangeText={(val) => setJumlah(formatNumber(val))}
                                    startIcon={<Typography weight="bold" className="text-primary/40 mr-1">Rp</Typography>}
                                    className="font-bold text-xl text-primary"
                                    containerClassName="mb-0"
                                />

                                {/* SPLIT: satu-satunya pengecualian, akun diatur per baris di bawah */}
                                <Pressable
                                    onPress={() => setPayMetode(payMetode === 'SPLIT' ? metodeDariAkun(kasJenis) : 'SPLIT')}
                                    className={`flex-row items-center justify-center py-4 rounded-3xl border ${payMetode === 'SPLIT'
                                        ? 'bg-primary border-primary shadow-2xl shadow-primary/20'
                                        : 'bg-surface border-gray-100'
                                        }`}
                                >
                                    <Split size={14} color={payMetode === 'SPLIT' ? 'white' : '#9CA3AF'} className="mr-2" />
                                    <Typography weight="bold" className={payMetode === 'SPLIT' ? 'text-white text-[10px]' : 'text-textGray text-[10px]'}>
                                        {payMetode === 'SPLIT' ? 'SPLIT AKTIF — ketuk untuk batal' : 'BAYAR SPLIT (opsional)'}
                                    </Typography>
                                </Pressable>

                                {payMetode === 'SPLIT' && (
                                    <View className="bg-background p-4 rounded-3xl border border-transparent space-y-3">
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest">Detail Pembayaran</Typography>
                                            <Pressable
                                                onPress={() => setSplitPayments([...splitPayments, { metode: 'TUNAI', jumlah: '', kas_jenis: 'KAS_UTAMA' }])}
                                                className="bg-surface border border-transparent p-2 rounded-xl"
                                            >
                                                <Plus size={14} color="#023C69" />
                                            </Pressable>
                                        </View>

                                        {splitPayments.map((split, index) => (
                                            <View key={index} className="flex-row space-x-2 items-center">
                                                {/* Akun per baris; metode diturunkan darinya */}
                                                <View className="flex-row flex-wrap w-40">
                                                    {AKUN.map((opt) => (
                                                        <Pressable
                                                            key={opt.value}
                                                            onPress={() => {
                                                                const newSplits = [...splitPayments];
                                                                newSplits[index].kas_jenis = opt.value;
                                                                newSplits[index].metode = metodeDariAkun(opt.value);
                                                                setSplitPayments(newSplits);
                                                            }}
                                                            className={`mr-1 mb-1 px-2 py-1.5 rounded-lg border ${split.kas_jenis === opt.value
                                                                ? 'bg-primary border-primary'
                                                                : 'bg-surface border-gray-200'
                                                                }`}
                                                        >
                                                            <Typography
                                                                weight="bold"
                                                                className={`text-[8px] ${split.kas_jenis === opt.value ? 'text-white' : 'text-textGray'}`}
                                                            >
                                                                {opt.short}
                                                            </Typography>
                                                        </Pressable>
                                                    ))}
                                                </View>

                                                <Input
                                                    placeholder="0"
                                                    value={split.jumlah}
                                                    onChangeText={(text) => {
                                                        const newSplits = [...splitPayments];
                                                        newSplits[index].jumlah = formatNumber(text);
                                                        setSplitPayments(newSplits);
                                                    }}
                                                    keyboardType="numeric"
                                                    containerClassName="flex-1 mb-0"
                                                    className="h-12 text-sm font-bold"
                                                />

                                                {splitPayments.length > 2 && (
                                                    <Pressable
                                                        onPress={() => {
                                                            const newSplits = splitPayments.filter((_, i) => i !== index);
                                                            setSplitPayments(newSplits);
                                                        }}
                                                        className="w-10 h-10 items-center justify-center bg-red-50 rounded-xl border border-red-100"
                                                    >
                                                        <Trash2 size={14} color="#EF4444" />
                                                    </Pressable>
                                                )}
                                            </View>
                                        ))}

                                        <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-transparent border-dashed">
                                            <Typography className="text-xs text-textGray">Total Terinput:</Typography>
                                            <Typography weight="bold" className={`text-sm ${splitPayments.reduce((acc, curr) => acc + parseNumber(curr.jumlah), 0) === parseNumber(jumlah)
                                                ? 'text-green-600'
                                                : 'text-orange-500'
                                                }`}>
                                                {formatCurrency(splitPayments.reduce((acc, curr) => acc + parseNumber(curr.jumlah), 0))}
                                            </Typography>
                                        </View>
                                    </View>
                                )}

                                {/* Force Transaction Toggle */}
                                <Pressable 
                                    onPress={() => setAllowNegative(!allowNegative)}
                                    className="flex-row items-center mt-2 mb-2 p-4 bg-background rounded-[28px] border border-transparent"
                                >
                                    <View className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${allowNegative ? 'bg-primary border-primary' : 'bg-surface border-transparent'}`}>
                                        {allowNegative && <Plus size={14} color="white" strokeWidth={4} />}
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="body2" weight="bold" className="text-textMain">Paksa Transaksi</Typography>
                                        <Typography variant="caption" className="text-textGray">Abaikan jika saldo tercatat tidak mencukupi</Typography>
                                    </View>
                                </Pressable>

                                <Button
                                    title="Catat Pengeluaran"
                                    onPress={handleSave}
                                    loading={createExpenseMutation.isPending}
                                    className="h-16 rounded-[28px] shadow-2xl shadow-primary/40"
                                />
                            </View>
        </>
    );

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />

            {/* Global Header Integration */}
            <Header
                title="Biaya Operasional"
                showBackButton
                onBackButtonPress={handleBack}
            />

            {/* Main Summary Stat Overlay Card */}
            <View className="px-6 mt-4 z-10">
                <View className="bg-surface p-6 rounded-[32px] shadow-sm border border-transparent flex-row items-center">
                    <View className="w-14 h-14 bg-rose-50 rounded-[18px] items-center justify-center mr-4 border border-rose-100">
                        <TrendingDown size={28} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                        <Typography className="text-textGray text-[9px] font-black uppercase tracking-widest mb-1">Total Pengeluaran Bulan Ini</Typography>
                        <Typography variant="h2" weight="bold" className="text-rose-500 font-bold text-xl tracking-tighter">
                            {formatCurrency(summaryData?.total_jumlah || 0)}
                        </Typography>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 mt-4 z-20"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >

                {/* Period Filter */}
                <View className="flex-row gap-2 px-6 mt-4">
                    {PERIODS.map((p) => (
                        <Pressable
                            key={p.id}
                            onPress={() => {
                                setPeriod(p.id);
                                setRefDate(new Date());
                            }}
                            className={`px-4 py-2 rounded-xl border ${period === p.id ? 'bg-primary border-primary shadow-sm' : 'bg-surface border-transparent active:bg-background'}`}
                        >
                            <Typography weight="bold" className={`text-xs ${period === p.id ? 'text-white' : 'text-textGray'}`}>
                                {p.label}
                            </Typography>
                        </Pressable>
                    ))}
                </View>

                {/* Date Navigator — hanya muncul saat periode bukan "Semua" */}
                {period !== 'all' && (
                    <View className="px-6 mt-2">
                        <View className="bg-surface border border-transparent rounded-2xl p-2 flex-row justify-between items-center shadow-sm">
                            <Pressable
                                onPress={() => shiftDate(-1)}
                                className="w-9 h-9 bg-background rounded-xl items-center justify-center border border-transparent active:scale-95"
                            >
                                <ChevronLeft size={18} color="#1C1C1C" />
                            </Pressable>

                            <Pressable
                                onPress={() => setRefDate(new Date())}
                                className="items-center flex-1 mx-2 py-1 flex-row justify-center active:opacity-70"
                            >
                                <Calendar size={15} color="#023C69" />
                                <Typography variant="body2" weight="bold" className="text-textMain ml-2 text-xs">
                                    {periodLabel}
                                </Typography>
                                <ChevronRight size={14} color="#9CA3AF" className="ml-1" />
                            </Pressable>

                            <Pressable
                                onPress={() => shiftDate(1)}
                                className="w-9 h-9 bg-background rounded-xl items-center justify-center border border-transparent active:scale-95"
                            >
                                <ChevronRight size={18} color="#1C1C1C" />
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Heading */}
                <View className="flex-row items-center justify-between mb-3 mt-5 px-6">
                    <Typography variant="h3" weight="bold" className="tracking-tight text-textMain">Riwayat Aktivitas</Typography>
                    {filteredExpenses.length > 0 && (
                        <Typography variant="caption" className="text-primary font-bold">{filteredExpenses.length} Transaksi</Typography>
                    )}
                </View>

                {/* List Section Area */}
                <View className="px-6">
                    {isLoading ? (
                        <View className="py-20 flex-row justify-center items-center">
                            <ActivityIndicator size="large" color="#023C69" />
                        </View>
                    ) : filteredExpenses.length === 0 ? (
                        <View className="py-20 items-center bg-surface rounded-[32px] border border-transparent shadow-sm p-6">
                            <View className="w-16 h-16 bg-background rounded-[28px] items-center justify-center mb-6">
                                <Receipt size={32} color="#D1D5DB" />
                            </View>
                            <Typography className="text-textGray font-bold text-center">Belum ada aktivitas</Typography>
                            <Typography className="text-gray-300 text-xs text-center mt-1">Data pengeluaran akan muncul di sini</Typography>
                        </View>
                    ) : (
                        filteredExpenses.map((item: any) => {
                            const catInfo = CATEGORIES.find(c => c.value === item.kategori) || CATEGORIES[2];
                            return (
                                <Card key={item.id} className="mb-4 p-5 border border-transparent shadow-sm bg-surface rounded-[32px]">
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center flex-1 mr-4">
                                            <View className="w-12 h-12 rounded-2xl items-center justify-center mr-3 bg-background">
                                                <catInfo.icon size={20} color={catInfo.color} />
                                            </View>
                                            <View className="flex-1">
                                                <Typography weight="bold" className="text-textMain text-sm mb-0.5" numberOfLines={1}>{item.deskripsi || item.nama}</Typography>
                                                <View className="flex-row items-center">
                                                    <Typography className="text-textGray text-[9px] font-black uppercase tracking-widest">{catInfo.label}</Typography>
                                                    <Typography className="text-textGray/20 text-[9px] mx-1.5">•</Typography>
                                                    <Typography className="text-textGray text-[9px] font-bold">{formatDate(item.tanggal)}</Typography>
                                                </View>
                                                {item.bisnis_kategori !== 'umum' && (
                                                    <View className="flex-row items-center mt-1">
                                                        <View className="w-1.5 h-1.5 rounded-full bg-primary/30 mr-1.5" />
                                                        <Typography className="text-primary/60 text-[8px] font-black uppercase tracking-[1px]">
                                                            Linked to {item.bisnis_kategori.replace('_', ' ')}
                                                        </Typography>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Typography weight="bold" className="text-rose-500 text-sm tracking-tight mb-1">-{formatNumber(item.jumlah)}</Typography>
                                            <Badge
                                                label={item.metode_bayar || 'TUNAI'}
                                                variant={item.metode_bayar?.toUpperCase() === 'TUNAI' ? 'warning' : 'info'}
                                                className="px-2 py-0"
                                            />
                                        </View>
                                    </View>
                                </Card>
                            );
                        })
                    )}
                </View>
                {/* Ruang bawah agar kartu terakhir tidak tertutup FAB */}
                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 96) }} />
            </ScrollView>

            {/* FAB — melayang di atas CustomTabBar (zIndex 50, tinggi 80+inset) */}
            {!showForm && (
                <Pressable
                    onPress={openForm}
                    style={{
                        bottom: insets.bottom + 96,
                        right: 24,
                        elevation: 20,
                        zIndex: 60,
                    }}
                    className="absolute bg-primary w-16 h-16 rounded-full items-center justify-center shadow-xl border-4 border-white/20 active:scale-95"
                >
                    <Plus size={30} color="white" strokeWidth={2.5} />
                </Pressable>
            )}
            {/* Entry UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
                    <View className="flex-1 justify-end bg-black/40">
                        <Pressable className="absolute inset-0" onPress={closeForm} />
                        <View className="bg-surface rounded-t-[48px] w-full max-w-[640px] h-[95%] self-center overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView style={{ flex: 1 }} className="px-8" showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {renderFormContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={sheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    enableContentPanningGesture
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ borderRadius: 48,  }}
                    topInset={insets.top}
                    onClose={() => setShowForm(false)}
                >
                    <BottomSheetScrollView
                        className="px-8"
                        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 48 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                    >
                        {renderFormContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}
        </View>
    );
}
