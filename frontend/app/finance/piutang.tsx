import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StatusBar, FlatList, ActivityIndicator, RefreshControl, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../../store/useUIStore';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import AlertTriangle from 'lucide-react-native/dist/esm/icons/triangle-alert.js';
import CheckCircle2 from 'lucide-react-native/dist/esm/icons/circle-check.js';
import Clock from 'lucide-react-native/dist/esm/icons/clock.js';
import CircleDollarSign from 'lucide-react-native/dist/esm/icons/circle-dollar-sign.js';
import Search from 'lucide-react-native/dist/esm/icons/search.js';
import ChevronRight from 'lucide-react-native/dist/esm/icons/chevron-right.js';
import CreditCard from 'lucide-react-native/dist/esm/icons/credit-card.js';
import Plus from 'lucide-react-native/dist/esm/icons/plus.js';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2.js';
import { useRouter, router, useLocalSearchParams } from 'expo-router';
import BottomSheetBase, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import BottomSheet from '../../components/ui/BottomSheetWithBack';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { namaGrupService, GrupNama } from '../../services/namaGrup';
import { offlineAwareWrite } from '../../services/offlineQueue';
import { keuanganService, Piutang, PiutangSummary, PiutangStatus, PembayaranPiutang } from '../../services/keuangan';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { usePiutangList, usePiutangSummary, useProcessPayment, useProcessPaymentSplit, useCreatePiutang } from '../../hooks/useKeuangan';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PaymentModal } from '../../components/PaymentModal';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlaceholderColor, useSheetChrome } from '../../utils/themeStyles';

type PiutangFilter = PiutangStatus | 'all' | 'sebagian' | 'belum_bayar';

// Belum Lunas = sudah ada uang masuk tapi sisa masih ada (status SEBAGIAN).
// Belum Bayar = belum ada uang masuk sama sekali (total_dibayar 0).
const STATUS_FILTERS: { label: string; value: PiutangFilter }[] = [
    { label: 'Semua', value: 'all' },
    { label: 'Belum Bayar', value: 'belum_bayar' },
    { label: 'Belum Lunas', value: 'sebagian' },
    { label: 'Lunas', value: 'LUNAS' },
];

// Filter status Per Nama: nama lolos jika punya minimal satu struk dengan status itu.
const cocokFilterNama = (g: GrupNama, f: PiutangFilter) =>
    f === 'all'
    || (f === 'belum_bayar' && (g.belum_bayar ?? 0) > 0)
    || (f === 'sebagian' && (g.sebagian ?? 0) > 0)
    || (f === 'LUNAS' && (g.lunas ?? 0) > 0);

const STATUS_BADGE_MAP: Record<PiutangStatus, 'warning' | 'success' | 'info'> = {
    BELUM_LUNAS: 'warning',
    SEBAGIAN: 'info',
    LUNAS: 'success',
};

const STATUS_LABEL: Record<string, string> = {
    BELUM_LUNAS: 'Belum Bayar',
    SEBAGIAN: 'Belum Lunas',
    LUNAS: 'Lunas',
    BATAL: 'Dibatalkan',
};

const SUMBER_LABEL: Record<string, string> = {
    BENGKEL: 'Bengkel',
    JUAL_BELI_MOBIL: 'Jual Mobil',
    JASA_ANGKUT: 'Jasa Angkut',
    KASBON_KARYAWAN: 'Kasbon',
    LAINNYA: 'Lainnya',
};

const FINANCE_UNITS = ['BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT'] as const;

const formatUnitLabel = (unit?: string) => {
    if (!unit) return undefined;
    return unit
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
};

const getUnitDisplayLabel = (unit?: string) => {
    if (unit === 'BENGKEL') return 'Bengkel';
    if (unit === 'JUAL_BELI_MOBIL') return 'Jual Beli Mobil';
    if (unit === 'JASA_ANGKUT') return 'Jasa Angkut';
    return formatUnitLabel(unit);
};

const getUnitKasJenis = (unit?: string) => {
    if (unit === 'BENGKEL') return 'KAS_UNIT_BENGKEL';
    if (unit === 'JUAL_BELI_MOBIL') return 'KAS_UNIT_MOBIL';
    if (unit === 'JASA_ANGKUT') return 'KAS_UNIT_JASA_ANGKUT';
    return undefined;
};

export default function PiutangUsahaScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
    const insets = useSafeAreaInsets();
    const chrome = useSheetChrome();
    const placeholder = usePlaceholderColor();
    const user = useAuthStore((s) => s.user);
    const params = useLocalSearchParams<{ unit?: string }>();
    const roleUnitMap: Record<string, typeof FINANCE_UNITS[number]> = {
        BENGKEL: 'BENGKEL',
        MOBIL: 'JUAL_BELI_MOBIL',
        JASA_ANGKUT: 'JASA_ANGKUT',
    };
    const requestedUnit = FINANCE_UNITS.includes(params.unit as typeof FINANCE_UNITS[number])
        ? params.unit as typeof FINANCE_UNITS[number]
        : undefined;
    const unitFilter = roleUnitMap[user?.role || ''] || requestedUnit;
    const unitLabel = getUnitDisplayLabel(unitFilter);
    const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER' || !!roleUnitMap[user?.role || ''];
    // Default 'sebagian' (Belum Lunas): piutang yang sudah ada pembayaran tapi
    // belum lunas — kalau default-nya 'belum_bayar', pembayaran seperti DP
    // langsung menghilang dari tab awal.
    const [selectedFilter, setSelectedFilter] = useState<PiutangFilter>('sebagian');
    const [selectedPiutang, setSelectedPiutang] = useState<Piutang | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'payment'>('detail');
    const [refreshing, setRefreshing] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [search, setSearch] = useState('');

    // API Hooks
    const { data: listData, isLoading: isLoadingList, refetch: refetchList } = usePiutangList({
        limit: 50,
        status: selectedFilter === 'LUNAS' ? 'LUNAS' : undefined,
        sebagian_only: selectedFilter === 'sebagian',
        belum_bayar_only: selectedFilter === 'belum_bayar',
        search: search || undefined,
        unit: unitFilter as any,
        exclude_internal: true,
    });
    // exclude_internal: angka tab sama dengan daftar (piutang internal antar unit tidak ikut).
    const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = usePiutangSummary({ unit: unitFilter as any, exclude_internal: true });
    const paymentMutation = useProcessPaymentSplit();
    const queryClient = useQueryClient();
    const [tampilan, setTampilan] = useState<'struk' | 'nama'>('struk');
    // Filter status untuk tampilan Per Nama (terpisah dari filter Per Struk).
    const [namaFilter, setNamaFilter] = useState<PiutangFilter>('all');
    const grupQuery = useQuery({
        queryKey: ['piutang-nama', 'grup', unitFilter ?? null],
        queryFn: () => namaGrupService.piutangGrup(unitFilter),
    });
    // Semua nama yang cocok pencarian (dipakai untuk total). grupList = yang lolos filter status.
    const grupSemua = useMemo(() => {
        const kata = search.trim().toLowerCase();
        return (grupQuery.data ?? []).filter((g) => !kata || g.nama.toLowerCase().includes(kata));
    }, [grupQuery.data, search]);
    const grupList = useMemo(() => grupSemua.filter((g) => cocokFilterNama(g, namaFilter)), [grupSemua, namaFilter]);
    const namaFilterCounts = useMemo(() => ({
        all: grupSemua.length,
        belum_bayar: grupSemua.filter((g) => (g.belum_bayar ?? 0) > 0).length,
        sebagian: grupSemua.filter((g) => (g.sebagian ?? 0) > 0).length,
        LUNAS: grupSemua.filter((g) => (g.lunas ?? 0) > 0).length,
    }) as Record<string, number | undefined>, [grupSemua]);
    const createMutation = useCreatePiutang();

    const createSheetRef = useRef<any>(null);
    const detailSheetRef = useRef<any>(null);
    const paymentSheetRef = useRef<any>(null);

    const createSnapPoints = useMemo(() => ['75%', '90%'], []);
    const detailSnapPoints = useMemo(() => ['70%', '85%'], []);
    const paymentSnapPoints = useMemo(() => ['65%', '85%'], []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchList(), refetchSummary(), grupQuery.refetch()]);
        setRefreshing(false);
    }, [refetchList, refetchSummary, grupQuery.refetch]);

    // Alert State
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
    });

    const showAlert = (title: string, message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setAlertState({
            visible: true,
            title,
            message,
            variant,
        });
    };

    const hideAlert = () => {
        setAlertState((prev) => ({ ...prev, visible: false }));
    };

    // Piutang internal (mis. bengkel menagih unit mobil) disaring backend lewat exclude_internal.
    const piutangList = useMemo(
        () => (listData?.data || []).filter((item: any) => Number(item.nominal_piutang || 0) > 0),
        [listData],
    );

    // Ringkasan dihitung dari daftar yang tampil, supaya sama dengan yang terlihat.
    const localSummary = useMemo(() => {
        let totalSisa = 0;
        let countBelumLunas = 0;
        let countOverdue = 0;
        piutangList.forEach((item) => {
            if (item.status !== 'LUNAS') {
                totalSisa += Number(item.sisa_piutang || 0);
                countBelumLunas++;
                if (item.is_overdue) countOverdue++;
            }
        });
        return { total_sisa: totalSisa, jumlah_belum_lunas: countBelumLunas, jumlah_overdue: countOverdue };
    }, [piutangList]);
    // Ringkasan atas ikut mode: di Per Nama dihitung dari grup yang tampil (sudah difilter pencarian nama).
    // Total sisa sama di kedua mode: dihitung dari grup per nama (semua piutang aktif, tidak ikut tab).
    const overview = useMemo(() => {
        const totalSisa = grupSemua.reduce((jumlah, g) => jumlah + Number(g.total_sisa || 0), 0);
        if (tampilan !== 'nama') return { ...localSummary, total_sisa: totalSisa };
        return {
            total_sisa: totalSisa,
            jumlah_belum_lunas: grupSemua.filter((g) => g.belum_lunas > 0).length,
            jumlah_overdue: 0, // blok Jatuh Tempo disembunyikan di mode Per Nama
        };
    }, [tampilan, grupSemua, localSummary]);

    // Angka badge per filter. Sumbernya summary (satu query, unfiltered by status);
    // list tak bisa dipakai karena dibatasi limit + sudah terfilter server-side.
    // Badge memakai summary server, yang belum mengecualikan piutang internal.
    const filterCounts = useMemo(() => {
        if (!summary) return {} as Record<string, number | undefined>;
        const belumBayar = summary.jumlah_belum_bayar ?? 0;
        const sebagian = summary.jumlah_sebagian ?? 0;
        return {
            belum_bayar: belumBayar,
            sebagian,
            LUNAS: summary.jumlah_lunas,
            lunas: summary.jumlah_lunas,
            // overdue himpunan bagian dari belum_bayar+sebagian — jangan dijumlah.
            all: (summary.jumlah_belum_lunas ?? belumBayar + sebagian) + summary.jumlah_lunas,
        } as Record<string, number | undefined>;
    }, [summary]);

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace(unitFilter ? '/bengkel' : '/finance');
        }
    };

    const [createVisible, setCreateVisible] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [paymentVisible, setPaymentVisible] = useState(false);

    // Create form state
    const [createSource] = useState('LAINNYA');
    const [createName, setCreateName] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createDate, setCreateDate] = useState('');
    const [createNote, setCreateNote] = useState('');
    const [isCreateSplitPayment, setIsCreateSplitPayment] = useState(false);
    const [createPayments, setCreatePayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }
    ]);
    const [createMethod, setCreateMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');

    const handleOpenDetail = (piutang: Piutang) => {
        setSelectedPiutang(piutang);
        setViewMode('detail');
        if (Platform.OS === 'web') {
            setDetailVisible(true);
            setIsSheetOpen(true);
        } else {
            detailSheetRef.current?.expand();
            setIsSheetOpen(true);
        }
    };

    const handleOpenPayment = () => {
        if (!selectedPiutang) return;
        setPaymentVisible(true);
        if (Platform.OS === 'web') {
            setDetailVisible(false);
            setIsSheetOpen(true);
        } else {
            detailSheetRef.current?.close();
            setIsSheetOpen(true);
        }
    };

    const handleOpenCreate = () => {
        console.log('Opening Create Sheet');
        setCreateName('');
        setCreateAmount('');
        setCreateNote('');
        setCreateMethod('TUNAI');
        setCreateDate('');

        if (Platform.OS === 'web') {
            setCreateVisible(true);
            setIsSheetOpen(true);
        } else {
            createSheetRef.current?.snapToIndex(0);
            setIsSheetOpen(true);
        }
    };

    const handleSubmitCreate = async () => {
        if (!createName || !createAmount) {
            showAlert('Error', 'Nama Debitur dan Nominal wajib diisi', 'error');
            return;
        }
        if (!createDate) {
            showAlert('Error', 'Tanggal transaksi wajib diisi', 'error');
            return;
        }

        try {
            const validatedPayments = createPayments
                .filter(p => parseNumber(p.nominal) > 0)
                .map(p => ({
                    metode: p.metode as any,
                    nominal: parseNumber(p.nominal),
                    catatan: p.catatan || undefined,
                    kas_jenis: getUnitKasJenis(unitFilter)
                }));

            const payload: any = {
                tanggal: createDate,
                sumber: createSource as any,
                nama_debitur: createName,
                nominal_piutang: parseNumber(createAmount),
                catatan: createNote,
                unit: unitFilter,
            };

            if (isCreateSplitPayment && validatedPayments.length > 0) {
                payload.payments = validatedPayments;
            } else if (createMethod) {
                payload.payments = [{
                    metode: createMethod,
                    nominal: parseNumber(createAmount),
                    kas_jenis: getUnitKasJenis(unitFilter),
                }];
            }

            const result = await offlineAwareWrite(queryClient, {
                type: 'finance.createPiutang',
                payload,
                label: 'Buat piutang',
                description: String(payload.nama_debitur || ''),
                onlineFn: () => createMutation.mutateAsync(payload),
            });
            if (Platform.OS === 'web') {
                setCreateVisible(false);
                setIsSheetOpen(false);
            } else {
                createSheetRef.current?.close();
                setIsSheetOpen(false);
            }

            setTimeout(() => {
                if (result.mode === 'offline') {
                    showAlert(
                        'Offline Mode',
                        'Piutang tersimpan di antrean offline (perangkat). Akan dikirim saat online.',
                        'info'
                    );
                } else {
                    showAlert('Sukses', 'Piutang berhasil dibuat', 'success');
                }
            }, 400);
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || error?.detail || error?.message || 'Terjadi kesalahan saat membuat piutang';
            showAlert('Gagal', errorMessage, 'error');
            console.error(error);
        }
    };

    // Nama yang sudah punya piutang: dipilih dari sini supaya masuk ke grup yang sama.
    const namaSaran = useMemo(() => {
        const kata = createName.trim().toLowerCase();
        return (grupQuery.data ?? [])
            .map((g) => g.nama)
            .filter((n) => n.toLowerCase().includes(kata) && n.toLowerCase() !== kata)
            .slice(0, 8);
    }, [grupQuery.data, createName]);

    const renderCreateContent = () => (
        <View className="p-8">
            <Typography variant="h2" weight="bold" className="mb-6 tracking-tighter">Buat Piutang Baru</Typography>

            <Input
                label="Nama Debitur"
                placeholder="Nama orang/perusahaan"
                value={createName}
                onChangeText={setCreateName}
            />

            {namaSaran.length > 0 && (
                <View className="flex-row flex-wrap gap-2 mb-6 -mt-2">
                    {namaSaran.map((nama) => (
                        <Pressable key={nama} onPress={() => setCreateName(nama)} className="px-3 py-2 rounded-2xl border border-transparent bg-surface/50">
                            <Typography variant="caption" className="text-textGray">{nama}</Typography>
                        </Pressable>
                    ))}
                </View>
            )}

            <Input
                label="Nominal (Rp)"
                keyboardType="numeric"
                placeholder="0"
                value={createAmount}
                onChangeText={(t) => setCreateAmount(formatNumber(t))}
            />

            <View className="mb-6 bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
                <Typography variant="caption" weight="bold" className="text-blue-700 uppercase tracking-widest mb-1">
                    {unitLabel ? `Pencairan dari Keuangan ${unitLabel}` : 'Pencairan dari Bisnis Utama'}
                </Typography>
                <Typography variant="caption" className="text-blue-600">
                    {unitLabel
                        ? `Piutang manual dicatat sebagai Piutang Lainnya unit ${unitLabel} dan dicairkan melalui keuangan unit tersebut.`
                        : 'Piutang manual dari menu Finance dicatat sebagai Piutang Lainnya dan dicairkan melalui Kas Utama untuk tunai atau Bank Utama untuk transfer.'}
                </Typography>
            </View>

                        <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest">Metode Pencairan</Typography>
                    <Pressable
                        onPress={() => setIsCreateSplitPayment(!isCreateSplitPayment)}
                        className={`px-3 py-1.5 rounded-full border ${isCreateSplitPayment ? 'bg-amber-50 border-amber-200' : 'bg-background border-transparent'}`}
                    >
                        <Typography className={`text-[9px] font-bold ${isCreateSplitPayment ? 'text-amber-600' : 'text-textGray'}`}>
                            {isCreateSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                        </Typography>
                    </Pressable>
                </View>

                {!isCreateSplitPayment ? (
                    <View className="flex-row space-x-2 gap-2">
                        {['TUNAI', 'TRANSFER'].map((m) => (
                            <Pressable
                                key={m}
                                onPress={() => setCreateMethod(m as 'TUNAI' | 'TRANSFER')}
                                className={`flex-1 py-3.5 items-center rounded-2xl border ${createMethod === m ? 'border-primary bg-primary/5' : 'border-transparent bg-surface/50'}`}
                            >
                                <Typography
                                    className={createMethod === m ? 'text-primary font-bold' : 'text-textGray'}
                                    variant="caption"
                                >
                                    {m}
                                </Typography>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View className="space-y-4">
                        {createPayments.map((p, idx) => (
                            <Card key={p.id} variant="outlined" className="p-5 border-transparent rounded-[24px] bg-surface/30">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="bg-primary/10 px-2 py-1 rounded-lg">
                                        <Typography variant="caption" weight="bold" className="text-primary text-[9px] uppercase tracking-widest">Metode #{idx + 1}</Typography>
                                    </View>
                                    {createPayments.length > 1 && (
                                        <Pressable
                                            onPress={() => setCreatePayments(createPayments.filter(item => item.id !== p.id))}
                                            className="w-8 h-8 items-center justify-center bg-rose-50 rounded-xl"
                                        >
                                            <Trash2 size={14} color="#EF4444" />
                                        </Pressable>
                                    )}
                                </View>

                                <View className="flex-row space-x-2 mb-4 gap-2">
                                    {['TUNAI', 'TRANSFER'].map((m) => (
                                        <Pressable
                                            key={m}
                                            onPress={() => setCreatePayments(createPayments.map(item => item.id === p.id ? { ...item, metode: m } : item))}
                                            className={`flex-1 py-3 items-center rounded-xl border ${p.metode === m ? 'bg-primary border-primary' : 'border-transparent bg-surface'}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={p.metode === m ? 'text-white' : 'text-textGray'}>{m}</Typography>
                                        </Pressable>
                                    ))}
                                </View>

                                <Input
                                    placeholder="Nominal"
                                    keyboardType="numeric"
                                    value={p.nominal}
                                    onChangeText={(t) => setCreatePayments(createPayments.map(item => item.id === p.id ? { ...item, nominal: formatNumber(t) } : item))}
                                    containerClassName="mb-0"
                                />
                            </Card>
                        ))}
                        <Pressable
                            onPress={() => setCreatePayments([...createPayments, { id: Date.now() + Math.random() + Math.random(), metode: '', nominal: '', catatan: '' }])}
                            className="flex-row items-center justify-center p-4 border border-dashed border-transparent rounded-[24px] bg-surface"
                        >
                            <Plus size={18} color="#64748B" className="mr-2" />
                            <Typography weight="bold" className="text-textGray text-xs text-center">Tambah Metode Pencairan</Typography>
                        </Pressable>
                    </View>
                )}
            </View>

            <DatePicker
                autoToday
                label="Tanggal Transaksi"
                placeholder="Pilih Tanggal (YYYY-MM-DD)"
                value={createDate}
                onChange={setCreateDate}
                required
            />

            <Input
                label="Catatan (Opsional)"
                placeholder="Keterangan tambahan"
                value={createNote}
                onChangeText={setCreateNote}
                multiline
                numberOfLines={2}
                containerClassName="mb-8"
            />

            <View className="flex-row space-x-3 gap-3">
                <Button
                    title="Batal"
                    variant="outline"
                    onPress={() => {
                        if (Platform.OS === 'web') {
                            setCreateVisible(false);
                            setIsSheetOpen(false);
                        } else {
                            createSheetRef.current?.close();
                            setIsSheetOpen(false);
                        }
                    }}
                    className="flex-1 rounded-[20px] h-14"
                />
                <Button
                    title={createMutation.isPending ? 'Menyimpan...' : 'Simpan Piutang'}
                    onPress={handleSubmitCreate}
                    disabled={createMutation.isPending || !createName || !createAmount}
                    loading={createMutation.isPending}
                    className="flex-[2] rounded-[20px] h-14"
                />
            </View>
        </View>
    );

    const renderDetailContent = () => (
        selectedPiutang && (
            <View className="p-6">
                <View className="flex-row justify-between items-start mb-4">
                    <View>
                        <Typography variant="h2" weight="bold">{selectedPiutang.nama_debitur}</Typography>
                        <Typography variant="caption" className="text-textGray">{selectedPiutang.nomor_piutang}</Typography>
                    </View>
                    <Badge
                        label={selectedPiutang.is_overdue ? 'Jatuh Tempo' : STATUS_LABEL[selectedPiutang.status] || selectedPiutang.status}
                        variant={selectedPiutang.is_overdue ? 'error' : STATUS_BADGE_MAP[selectedPiutang.status]}
                    />
                </View>

                <Card variant="outlined" className="p-4 mb-4 border-transparent">
                    <View className="flex-row justify-between mb-2">
                        <Typography variant="caption" className="text-textGray">Total Piutang</Typography>
                        <Typography variant="body2" weight="bold">{formatCurrency(selectedPiutang.nominal_piutang)}</Typography>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Typography variant="caption" className="text-textGray">Sudah Dibayar</Typography>
                        <Typography variant="body2" weight="medium" className="text-green-600">{formatCurrency(selectedPiutang.total_dibayar)}</Typography>
                    </View>
                    <View className="h-[1px] bg-background my-2" />
                    <View className="flex-row justify-between">
                        <Typography variant="caption" weight="bold" className="text-textGray">Sisa Piutang</Typography>
                        <Typography variant="body1" weight="bold" className="text-red-600">{formatCurrency(selectedPiutang.sisa_piutang)}</Typography>
                    </View>
                </Card>

                {/* Informasi piutang untuk verifikasi sebelum pelunasan */}
                <Card variant="outlined" className="p-4 mb-4 border-transparent">
                    <Typography variant="caption" weight="bold" className="text-textGray mb-3">
                        INFORMASI PIUTANG
                    </Typography>

                    <View className="gap-3">
                        <View className="flex-row justify-between gap-4">
                            <Typography variant="caption" className="text-textGray">Tanggal Piutang</Typography>
                            <Typography variant="body2" weight="medium" className="text-right">
                                {formatDate(selectedPiutang.tanggal)}
                            </Typography>
                        </View>

                        <View className="flex-row justify-between gap-4">
                            <Typography variant="caption" className="text-textGray">Sumber</Typography>
                            <Typography variant="body2" weight="medium" className="text-right">
                                {SUMBER_LABEL[selectedPiutang.sumber] || selectedPiutang.sumber}
                            </Typography>
                        </View>

                        {selectedPiutang.unit && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Unit</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {formatUnitLabel(selectedPiutang.unit)}
                                </Typography>
                            </View>
                        )}

                        {selectedPiutang.nomor_referensi && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Referensi</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {selectedPiutang.nomor_referensi}
                                </Typography>
                            </View>
                        )}

                        {selectedPiutang.catatan && (
                            <View className="mt-2 bg-background rounded-2xl p-3">
                                <Typography variant="caption" className="text-textGray mb-1">Keterangan saat input</Typography>
                                <Typography variant="body2" className="text-textMain">{selectedPiutang.catatan}</Typography>
                            </View>
                        )}

                        {selectedPiutang.tanggal_jatuh_tempo && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Jatuh Tempo</Typography>
                                <Typography
                                    variant="body2"
                                    weight="medium"
                                    className={`text-right ${selectedPiutang.is_overdue ? 'text-red-600' : ''}`}
                                >
                                    {formatDate(selectedPiutang.tanggal_jatuh_tempo)}
                                </Typography>
                            </View>
                        )}

                        {selectedPiutang.tanggal_lunas && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Tanggal Lunas</Typography>
                                <Typography variant="body2" weight="medium" className="text-right text-green-600">
                                    {formatDate(selectedPiutang.tanggal_lunas)}
                                </Typography>
                            </View>
                        )}

                        {selectedPiutang.telepon_debitur && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Telepon</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {selectedPiutang.telepon_debitur}
                                </Typography>
                            </View>
                        )}

                        {selectedPiutang.alamat_debitur && (
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Alamat</Typography>
                                <Typography variant="body2">{selectedPiutang.alamat_debitur}</Typography>
                            </View>
                        )}

                        {selectedPiutang.catatan && (
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Keterangan</Typography>
                                <Typography variant="body2">{selectedPiutang.catatan}</Typography>
                            </View>
                        )}
                    </View>
                </Card>

                {/* Payment History */}
                {selectedPiutang.pembayaran && selectedPiutang.pembayaran.length > 0 && (
                    <View className="mb-4">
                        <Typography variant="caption" weight="bold" className="text-textGray mb-2">RIWAYAT PEMBAYARAN</Typography>
                        {selectedPiutang.pembayaran.map((p: PembayaranPiutang) => (
                            <View key={p.id} className="flex-row justify-between py-2.5 border-b border-transparent items-center">
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-textMain">{formatDate(p.tanggal)}</Typography>
                                    <View className="bg-background px-1.5 py-0.5 rounded-md self-start mt-0.5">
                                        <Typography className="text-[8px] font-bold text-textGray tracking-tighter">{p.metode_bayar}</Typography>
                                    </View>
                                </View>
                                <Typography variant="caption" weight="bold" className="text-green-600">+{formatCurrency(p.nominal)}</Typography>
                            </View>
                        ))}
                    </View>
                )}

                {/* Footer Buttons */}
                <View className="flex-row justify-end mt-4 gap-2">
                    <Button
                        title="Tutup"
                        variant="outline"
                        onPress={() => {
                            if (Platform.OS === 'web') {
                                setDetailVisible(false);
                                setIsSheetOpen(false);
                            } else {
                                detailSheetRef.current?.close();
                            }
                        }}
                    />
                    {selectedPiutang.status !== 'LUNAS' && (
                        <Button
                            title="Catat Pembayaran"
                            onPress={handleOpenPayment}
                            className="flex-1"
                        />
                    )}
                </View>
            </View>
        )
    );


    return (
        <View className="flex-1 bg-background">
            <Header
                title={unitLabel ? `Piutang ${unitLabel}` : 'Piutang Usaha'}
                subtitle={unitLabel ? `Daftar piutang unit ${unitLabel}` : 'Pantau Penagihan & Jatuh Tempo'}
                showBackButton
                onBackButtonPress={handleGoBack}
            />

            {/* Filter & Search Navigator Overlay */}
            {!isSheetOpen && (
                <View className="px-6 mt-4">
                    <View className="bg-surface p-3 rounded-[24px] border border-transparent shadow-sm flex-col">
                        {(
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3 space-x-2 pb-1">
                            {STATUS_FILTERS.map((filter) => {
                                const isActive = (tampilan === 'nama' ? namaFilter : selectedFilter) === filter.value;
                                const count = tampilan === 'nama' ? namaFilterCounts[filter.value] : filterCounts[filter.value];
                                return (
                                    <Pressable
                                        key={filter.value}
                                        onPress={() => (tampilan === 'nama' ? setNamaFilter(filter.value) : setSelectedFilter(filter.value))}
                                        className={`px-4 py-2 rounded-xl mr-2 flex-row items-center ${isActive ? 'bg-primary border border-primary shadow-sm' : 'bg-background border border-transparent'}`}
                                    >
                                        <Typography
                                            variant="caption"
                                            weight="bold"
                                            className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-white font-bold' : 'text-textGray'}`}
                                        >
                                            {filter.label}
                                        </Typography>
                                        {count !== undefined && (
                                            <View className={`ml-1.5 px-1.5 min-w-[18px] rounded-full items-center justify-center ${isActive ? 'bg-white/25' : 'bg-gray-200/70'}`}>
                                                <Typography className={`text-[9px] font-bold ${isActive ? 'text-white' : 'text-textGray'}`}>
                                                    {formatNumber(count)}
                                                </Typography>
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        )}

                        <View className="flex-row items-center px-4 bg-background h-11 rounded-2xl border border-transparent">
                            <Search size={16} color={placeholder} />
                            <TextInput
                                className="flex-1 ml-3 text-xs text-textMain font-semibold h-full"
                                placeholder="Cari nama debitur atau invoice..."
                                value={search}
                                onChangeText={setSearch}
                                placeholderTextColor={placeholder}
                                clearButtonMode="while-editing"
                            />
                        </View>
                    </View>
                </View>
            )}

            {/* Receivables List */}
            <FlatList<Piutang | GrupNama>
                data={tampilan === 'nama' ? grupList : piutangList}
                keyExtractor={(item) => (tampilan === 'nama' ? `grup-${(item as GrupNama).nama}` : (item as Piutang).id.toString())}
                renderItem={({ item: raw }) => {
                    if (tampilan === 'nama') {
                        const grup = raw as GrupNama;
                        return (
                            <Pressable
                                onPress={() => router.push({ pathname: '/finance/piutang-nama', params: { nama: grup.nama } })}
                                className="bg-surface p-5 rounded-[32px] mb-6 border border-transparent shadow-sm"
                            >
                                <View className="flex-row justify-between items-center mb-4">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight flex-1 mr-3" numberOfLines={1}>
                                        {grup.nama}
                                    </Typography>
                                    <Typography className="text-textGray text-[10px] font-bold uppercase tracking-widest">{grup.jumlah_struk} struk</Typography>
                                </View>
                                <View className="bg-background p-4 rounded-2xl flex-row justify-between mb-4 border border-gray-100/50">
                                    <View>
                                        <Typography className="text-textGray text-[9px] font-bold uppercase tracking-widest mb-1">Total</Typography>
                                        <Typography weight="semibold" className="text-textMain text-sm">{formatCurrency(grup.total_nominal)}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-rose-600/60 text-[9px] font-bold uppercase tracking-widest mb-1">Sisa Tagihan</Typography>
                                        <Typography weight="bold" className="text-rose-600 text-sm">{formatCurrency(grup.total_sisa)}</Typography>
                                    </View>
                                </View>
                                <View className="flex-row items-center justify-between pt-2">
                                    <Typography className="text-textGray text-[10px] font-bold uppercase tracking-widest">{grup.belum_lunas} belum lunas</Typography>
                                    <ChevronRight size={16} color="#D1D5DB" />
                                </View>
                            </Pressable>
                        );
                    }
                    const item = raw as Piutang;
                    const progressPercent = item.persentase_terbayar;
                    const isOverdue = item.is_overdue;
                    return (
                        <Pressable
                            onPress={() => handleOpenDetail(item)}
                            className="bg-surface p-5 rounded-[32px] mb-6 border border-transparent shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-1 mr-3">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                        {item.nama_debitur}
                                    </Typography>
                                    <Typography variant="caption" className="text-textGray mt-0.5">
                                        {item.nomor_piutang} • {SUMBER_LABEL[item.sumber as keyof typeof SUMBER_LABEL] || item.sumber}{!unitFilter && item.unit ? ` • ${formatUnitLabel(item.unit)}` : ''} {item.nomor_referensi ? `• ${item.nomor_referensi}` : ''}
                                    </Typography>
                                </View>
                                <View className={isOverdue ? "bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100" : item.status === 'LUNAS' ? "bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100" : "bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100"}>
                                    <Typography weight="bold" className={isOverdue ? "text-rose-600 text-[10px]" : item.status === 'LUNAS' ? "text-emerald-600 text-[10px]" : "text-blue-600 text-[10px]"}>
                                        {isOverdue ? 'JATUH TEMPO' : (STATUS_LABEL[item.status] || item.status).toUpperCase()}
                                    </Typography>
                                </View>
                            </View>

                            {/* Financial Bento Inner Grid */}
                            <View className="bg-background p-4 rounded-2xl flex-row justify-between mb-4 border border-gray-100/50">
                                <View>
                                    <Typography className="text-textGray text-[9px] font-bold uppercase tracking-widest mb-1">Total</Typography>
                                    <Typography weight="semibold" className="text-textMain text-sm">{formatCurrency(item.nominal_piutang)}</Typography>
                                </View>
                                <View className="items-end">
                                    <Typography className="text-rose-600/60 text-[9px] font-bold uppercase tracking-widest mb-1">Sisa Tagihan</Typography>
                                    <Typography weight="bold" className="text-rose-600 text-sm">{formatCurrency(item.sisa_piutang)}</Typography>
                                </View>
                            </View>

                            {/* Enhanced Progress Bar */}
                            <View className="mb-4">
                                <View className="flex-row justify-between items-center mb-1.5">
                                    <Typography className="text-textGray text-[9px] font-bold uppercase tracking-widest">Progress Pelunasan</Typography>
                                    <Typography className="text-primary text-[10px] font-bold">{Math.round(progressPercent || 0)}%</Typography>
                                </View>
                                <View className="h-2 bg-background rounded-full overflow-hidden border border-gray-200/20">
                                    <View
                                        className="h-full bg-primary rounded-full"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </View>
                            </View>

                            {/* Footer Utility Row */}
                            <View className="flex-row items-center justify-between pt-4 border-t border-transparent">
                                <View className="flex-row items-center">
                                    <Clock size={12} color={isOverdue ? "#EF4444" : "#9CA3AF"} />
                                    <Typography className={`${isOverdue ? 'text-rose-600' : 'text-textGray'} text-[10px] ml-1.5 font-bold uppercase tracking-widest`}>
                                        {isOverdue ? 'MELEWATI BATAS' : 'TEMPO'}: {formatDate(item.tanggal_jatuh_tempo || item.tanggal)}
                                    </Typography>
                                </View>
                                <ChevronRight size={16} color="#D1D5DB" />
                            </View>
                        </Pressable>
                    );
                }}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
                ListHeaderComponent={
                    <View className="mb-6">
                        {/* Tampilan per struk atau per nama (folder otomatis dari nama) */}
                        <View className="flex-row bg-surface p-1 rounded-2xl mb-4 border border-transparent shadow-sm">
                            {([['struk', 'Per Struk'], ['nama', 'Per Nama']] as const).map(([nilai, label]) => (
                                <Pressable
                                    key={nilai}
                                    onPress={() => setTampilan(nilai)}
                                    className={`flex-1 py-2.5 rounded-xl items-center ${tampilan === nilai ? 'bg-primary' : ''}`}
                                >
                                    <Typography className={`text-xs font-bold ${tampilan === nilai ? 'text-white' : 'text-textGray'}`}>{label}</Typography>
                                </Pressable>
                            ))}
                        </View>
                        {/* Receivables Insight Card (White Bento Style) */}
                        <View className="bg-surface p-6 rounded-[32px] border border-transparent shadow-sm mb-6">
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                    <Typography className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest">Global Overview</Typography>
                                </View>
                                <Typography className="text-textGray text-[10px] font-bold uppercase tracking-widest">Saldo Piutang</Typography>
                            </View>

                            <View className="flex-row items-center justify-between">
                                <View>
                                    <Typography variant="h1" weight="bold" className="text-textMain text-3xl tracking-tighter" numberOfLines={1} adjustsFontSizeToFit>
                                        {formatCurrency(overview?.total_sisa || 0)}
                                    </Typography>
                                    <Typography className="text-textGray text-xs mt-1">Total Dari {overview?.jumlah_belum_lunas || 0} {tampilan === 'nama' ? 'Nama' : 'Invoice'}</Typography>
                                </View>
                                <View className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                    <CircleDollarSign size={24} color={themeColors.primary} />
                                </View>
                            </View>

                            {/* Bento Stats Row */}
                            <View className="h-[1px] bg-background my-6" />
                            <View className="flex-row justify-between">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                                        <Typography className="text-textGray text-[9px] uppercase font-bold tracking-widest">Belum Lunas</Typography>
                                    </View>
                                    <Typography weight="bold" className="text-textMain text-sm">{overview?.jumlah_belum_lunas || 0} Akun</Typography>
                                </View>
                                {tampilan === 'struk' && (
                                <View className="flex-1 items-end pl-4 border-l border-transparent">
                                    <View className="flex-row items-center mb-1">
                                        <AlertTriangle size={10} color="#F43F5E" className="mr-1.5" />
                                        <Typography className="text-textGray text-[9px] uppercase font-bold tracking-widest">Jatuh Tempo</Typography>
                                    </View>
                                    <Typography weight="bold" className="text-rose-600 text-sm">{overview?.jumlah_overdue || 0} Akun</Typography>
                                </View>
                                )}
                            </View>
                        </View>

                        <Typography variant="h3" weight="bold" className="mb-4 tracking-tight">Daftar Piutang</Typography>
                        {isLoadingList && (
                            <View className="space-y-6">
                                <SkeletonCard className="rounded-[32px] h-40" />
                                <SkeletonCard className="rounded-[32px] h-40" />
                                <SkeletonCard className="rounded-[32px] h-40" />
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    isLoadingList ? null : (
                        <View className="mt-10">
                            <EmptyState
                                title={selectedFilter === 'LUNAS' ? 'Semua Piutang Lunas' : 'Tidak Ada Piutang'}
                                description={selectedFilter === 'LUNAS' ? 'Belum ada riwayat piutang yang sudah lunas.' : 'Belum ada data piutang untuk filter ini.'}
                                icon={CheckCircle2}
                            />
                        </View>
                    )
                }
            />

            {/* Modals & Bottom Sheets Upgraded to Premium Style */}
            {Platform.OS === 'web' ? (
                <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => {
                    setCreateVisible(false);
                    setIsSheetOpen(false);
                }}>
                    <View className="flex-1 justify-end bg-black/40">
                        <Pressable className="absolute inset-0" onPress={() => {
                            setCreateVisible(false);
                            setIsSheetOpen(false);
                        }} />
                        <View className="bg-surface rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView style={{ flex: 1 }} className="px-8" showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {renderCreateContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={createSheetRef}
                    index={-1}
                    snapPoints={createSnapPoints}
                    enablePanDownToClose
                    enableContentPanningGesture
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    backdropComponent={renderBackdrop}
                    backgroundStyle={chrome.backgroundStyle}
                    handleIndicatorStyle={chrome.handleIndicatorStyle}
                    topInset={insets.top}
                    onChange={(index) => setIsSheetOpen(index !== -1)}
                >
                    <BottomSheetScrollView
                        contentContainerStyle={{ padding: 24, paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 48) }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                    >
                        {renderCreateContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            {/* Detail UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal visible={detailVisible} transparent animationType="slide" onRequestClose={() => {
                    setDetailVisible(false);
                    setIsSheetOpen(false);
                }}>
                    <View className="flex-1 justify-end bg-black/40">
                        <Pressable className="absolute inset-0" onPress={() => {
                            setDetailVisible(false);
                            setIsSheetOpen(false);
                        }} />
                        <View className="bg-surface rounded-t-[48px] w-full max-w-[640px] h-[80%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {renderDetailContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={detailSheetRef}
                    index={-1}
                    snapPoints={detailSnapPoints}
                    enablePanDownToClose
                    enableContentPanningGesture
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    backdropComponent={renderBackdrop}
                    backgroundStyle={chrome.backgroundStyle}
                    handleIndicatorStyle={chrome.handleIndicatorStyle}
                    topInset={insets.top}
                    onChange={(index) => setIsSheetOpen(index !== -1)}
                >
                    <BottomSheetScrollView
                        contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 48) }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                    >
                        {renderDetailContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            {/* Payment Modal Refactored */}
            {selectedPiutang && (
                <PaymentModal
                    visible={paymentVisible}
                    onClose={() => {
                        setPaymentVisible(false);
                        setIsSheetOpen(false);
                    }}
                    onSuccess={onRefresh}
                    id={selectedPiutang.id}
                    initialAmount={selectedPiutang.sisa_piutang}
                    type="piutang"
                    unit={selectedPiutang.unit}
                    kas_jenis={getUnitKasJenis(selectedPiutang.unit)}
                />
            )}

            {/* Global Alert */}
            <AlertDialog
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                variant={alertState.variant}
                onClose={hideAlert}
                onConfirm={hideAlert}
            />

            {/* FAB pojok kanan bawah (di atas tab bar): header desktop menutupi tombol di kanan atas */}
            {canCreate && (
                <Pressable
                    onPress={handleOpenCreate}
                    accessibilityLabel="Buat piutang baru"
                    style={{ position: 'absolute', right: 20, bottom: getCustomTabBarBottomPadding(insets.bottom, 16), elevation: 5, zIndex: 999 }}
                    className="bg-primary w-14 h-14 rounded-full items-center justify-center shadow-xl active:opacity-90"
                >
                    <Plus size={26} color="white" strokeWidth={2.5} />
                </Pressable>
            )}
        </View>
    );
}
