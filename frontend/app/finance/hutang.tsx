import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StatusBar, FlatList, ActivityIndicator, RefreshControl, TextInput, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { keuanganService, Hutang, HutangSummary, HutangStatus, PembayaranHutang } from '../../services/keuangan';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { useHutangList, useHutangSummary, useProcessHutangPaymentSplit, useCreateHutang } from '../../hooks/useKeuangan';
import { useMobilList } from '../../hooks/useMobil';
import { useTransaksiBengkelList } from '../../hooks/useBengkel';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PaymentModal } from '../../components/PaymentModal';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlaceholderColor, useSheetChrome } from '../../utils/themeStyles';

const STATUS_FILTERS: { label: string; value: HutangStatus | 'all' }[] = [
    { label: 'Semua', value: 'all' },
    { label: 'Belum Bayar', value: 'BELUM_LUNAS' },
    { label: 'Belum Lunas', value: 'SEBAGIAN' },
    { label: 'Lunas', value: 'LUNAS' },
];

const STATUS_BADGE_MAP: Record<HutangStatus, 'warning' | 'success' | 'info'> = {
    BELUM_LUNAS: 'warning',
    SEBAGIAN: 'info',
    LUNAS: 'success',
};

// Filter status Per Nama: nama lolos jika punya minimal satu struk dengan status itu.
const cocokFilterNama = (g: GrupNama, f: HutangStatus | 'all') =>
    f === 'all'
    || (f === 'BELUM_LUNAS' && (g.belum_bayar ?? 0) > 0)
    || (f === 'SEBAGIAN' && (g.sebagian ?? 0) > 0)
    || (f === 'LUNAS' && (g.lunas ?? 0) > 0);

const SUMBER_LABEL: Record<string, string> = {
    PEMBELIAN_PART: 'Pembelian Part',
    PEMBELIAN_MOBIL: 'Pembelian Unit',
    JUAL_BELI_MOBIL: 'Jual Beli Mobil',
    UANG_MUKA_PENJUALAN: 'Refund DP Booking',
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

export default function HutangUsahaScreen() {
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
    const [selectedFilter, setSelectedFilter] = useState<HutangStatus | 'all'>('BELUM_LUNAS');
    const [search, setSearch] = useState('');
    const [selectedHutang, setSelectedHutang] = useState<Hutang | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'payment'>('detail');
    const [refreshing, setRefreshing] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // API Hooks
    const { data: listData, isLoading: isLoadingList, refetch: refetchList } = useHutangList({
        limit: 50,
        status: selectedFilter === 'all' ? undefined : selectedFilter,
        search: search || undefined,
        unit: unitFilter as any,
    });
    const { data: mobilData } = useMobilList();
    // exclude_internal: angka tab sama dengan daftar (hutang internal dan yang dibatalkan tidak ikut).
    const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = useHutangSummary({ unit: unitFilter as any, exclude_internal: true });
    const paymentMutation = useProcessHutangPaymentSplit();
    const queryClient = useQueryClient();
    const [tampilan, setTampilan] = useState<'struk' | 'nama'>('struk');
    // Filter status untuk tampilan Per Nama (terpisah dari filter Per Struk).
    const [namaFilter, setNamaFilter] = useState<HutangStatus | 'all'>('all');
    const grupQuery = useQuery({
        queryKey: ['hutang-nama', 'grup', unitFilter ?? null],
        queryFn: () => namaGrupService.hutangGrup(unitFilter),
    });
    // Semua nama yang cocok pencarian (dipakai untuk total). grupList = yang lolos filter status.
    const grupSemua = useMemo(() => {
        const kata = search.trim().toLowerCase();
        return (grupQuery.data ?? []).filter((g) => !kata || g.nama.toLowerCase().includes(kata));
    }, [grupQuery.data, search]);
    const grupList = useMemo(() => grupSemua.filter((g) => cocokFilterNama(g, namaFilter)), [grupSemua, namaFilter]);
    const namaFilterCounts = useMemo(() => ({
        all: grupSemua.length,
        BELUM_LUNAS: grupSemua.filter((g) => (g.belum_bayar ?? 0) > 0).length,
        SEBAGIAN: grupSemua.filter((g) => (g.sebagian ?? 0) > 0).length,
        LUNAS: grupSemua.filter((g) => (g.lunas ?? 0) > 0).length,
    }) as Record<string, number | undefined>, [grupSemua]);
    const createMutation = useCreateHutang();

    const detailSheetRef = useRef<any>(null);
    const paymentSheetRef = useRef<any>(null);
    const createSheetRef = useRef<any>(null);

    const detailSnapPoints = useMemo(() => ['95%'], []);
    const paymentSnapPoints = useMemo(() => ['65%', '85%'], []);
    const createSnapPoints = useMemo(() => ['75%', '90%'], []);

    // Create form states
    const [createVisible, setCreateVisible] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createSource, setCreateSource] = useState('LAINNYA');
    const [createMethod, setCreateMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
    const [createDate, setCreateDate] = useState('');
    const [createNote, setCreateNote] = useState('');
    const [isCreateSplitPayment, setIsCreateSplitPayment] = useState(false);
    const [createPayments, setCreatePayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }
    ]);

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

    const hutangListRaw = (listData?.data || []).filter((item: any) => Number(item.nominal_hutang || 0) > 0);

    // Fetch bengkel data to map BGL numbers to car IDs
    const { data: bengkelData } = useTransaksiBengkelList({ limit: 1000 });

    // Virtual Elimination Logic: Otomatis sembunyikan hutang internal (Bengkel)
    // jika unit mobil referensinya sudah terjual.
    const { filteredList, localSummary } = useMemo(() => {
        if (!mobilData?.data) return { filteredList: hutangListRaw, localSummary: summary };

        // 1. Get IDs of sold cars
        const soldCarIds = new Set(
            mobilData.data
                .filter((m: any) => m.status?.toUpperCase() === 'TERJUAL')
                .map((m: any) => String(m.id))
        );

        // 2. Map sold cars and Jasa Angkut to their Bengkel invoice numbers (BGL...)
        const soldBengkelInvoices = new Set<string>();
        const jaBengkelInvoices = new Set<string>();
        if (bengkelData?.data) {
            bengkelData.data.forEach((b: any) => {
                const kategori = String(b.kategori || '').toLowerCase();
                if (kategori === 'jual_beli_mobil' && b.mobil_id && soldCarIds.has(String(b.mobil_id))) {
                    if (b.nomor_transaksi) soldBengkelInvoices.add(b.nomor_transaksi);
                }
                if (kategori === 'jasa_angkut' || b.armada_id) {
                    if (b.nomor_transaksi) jaBengkelInvoices.add(b.nomor_transaksi);
                }
            });
        }

        let totalSisa = 0;
        let countBelumLunas = 0;

        const filtered = hutangListRaw.filter(item => {
            const isInternal = item.is_internal || item.nama_kreditur?.toUpperCase().includes('BENGKEL');

            // Sembunyikan transaksi bengkel internal untuk Jasa Angkut (sparepart / perbaikan)
            if (isInternal) {
                if (item.unit === 'JASA_ANGKUT') return false;
                if (item.nomor_referensi && jaBengkelInvoices.has(item.nomor_referensi)) return false;
            }

            // Jika internal dan ada referensi nomor_transaksi bengkel, cek apakah mobilnya sudah terjual
            if (isInternal && item.nomor_referensi) {
                if (soldBengkelInvoices.has(item.nomor_referensi)) {
                    return false; // Sembunyikan otomatis
                }
            }

            // Accumulate summary for visible items
            if (item.status !== 'LUNAS') {
                totalSisa += Number(item.sisa_hutang || 0);
                countBelumLunas++;
            }

            return true;
        });

        return {
            filteredList: filtered,
            localSummary: {
                total_sisa: totalSisa,
                jumlah_belum_lunas: countBelumLunas,
            }
        };
    }, [hutangListRaw, mobilData, bengkelData, summary]);

    const hutangList = filteredList;

    // Ringkasan atas ikut mode: di Per Nama dihitung dari grup yang tampil (sudah difilter pencarian nama).
    // Total sisa sama di kedua mode: dihitung dari grup per nama (semua hutang aktif, tidak ikut tab).
    const overview = useMemo(() => {
        const totalSisa = grupSemua.reduce((jumlah, g) => jumlah + Number(g.total_sisa || 0), 0);
        if (tampilan !== 'nama') return { total_sisa: totalSisa, jumlah_belum_lunas: Number((localSummary as any)?.jumlah_belum_lunas ?? 0) };
        return {
            total_sisa: totalSisa,
            jumlah_belum_lunas: grupSemua.filter((g) => g.belum_lunas > 0).length,
        };
    }, [tampilan, grupSemua, localSummary]);

    const filterCounts = useMemo(() => {
        if (!summary) return {} as Record<string, number | undefined>;
        return {
            all: (summary.jumlah_belum_lunas ?? 0) + (summary.jumlah_lunas ?? 0),
            BELUM_LUNAS: summary.jumlah_belum_lunas,
            SEBAGIAN: (summary as any).jumlah_sebagian,
            LUNAS: summary.jumlah_lunas,
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

    const [detailVisible, setDetailVisible] = useState(false);
    const [paymentVisible, setPaymentVisible] = useState(false);

    const handleOpenDetail = (hutang: Hutang) => {
        setSelectedHutang(hutang);
        setViewMode('detail');
        if (Platform.OS === 'web') {
            setDetailVisible(true);
            setIsSheetOpen(true);
        } else {
            detailSheetRef.current?.expand();
            setIsSheetOpen(true);
        }
    };

    const handleOpenCreate = () => {
        setCreateName('');
        setCreateAmount('');
        setCreateDate('');
        setCreateSource('LAINNYA');
        setCreateMethod('TUNAI');
        setIsCreateSplitPayment(false);
        setCreatePayments([{ id: Date.now() + Math.random(), metode: 'TUNAI', nominal: '', catatan: '' }]);
        setCreateNote('');
        if (Platform.OS === 'web') {
            setCreateVisible(true);
            setIsSheetOpen(true);
        } else {
            createSheetRef.current?.expand();
            setIsSheetOpen(true);
        }
    };

    const handleSubmitCreate = async () => {
        if (!createName || !createAmount) {
            showAlert('Error', 'Nama Kreditur dan Nominal wajib diisi', 'error');
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
                nama_kreditur: createName,
                nominal_hutang: parseNumber(createAmount),
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
                type: 'finance.createHutang',
                payload,
                label: 'Buat hutang',
                description: String(payload.nama_kreditur || ''),
                onlineFn: () => createMutation.mutateAsync(payload),
            });
            if (result.mode === 'offline') {
                showAlert(
                    'Offline Mode',
                    'Hutang tersimpan di antrean offline (perangkat). Akan dikirim saat online.',
                    'info'
                );
            } else {
                showAlert('Sukses', 'Hutang berhasil dibuat', 'success');
            }
            // Reset state (shared online/offline)

            // Reset state
            setCreateName('');
            setCreateAmount('');
            setCreateNote('');
            setCreateMethod('TUNAI');
            setIsCreateSplitPayment(false);
            setCreatePayments([{ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);

            if (Platform.OS === 'web') {
                setCreateVisible(false);
                setIsSheetOpen(false);
            } else {
                createSheetRef.current?.close();
                setIsSheetOpen(false);
            }
            refetchList();
            refetchSummary();
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || error?.detail || error?.message || 'Terjadi kesalahan saat membuat hutang';
            showAlert('Gagal', errorMessage, 'error');
            console.error(error);
        }
    };

    const handleOpenPayment = () => {
        if (!selectedHutang) return;
        setPaymentVisible(true);
        if (Platform.OS === 'web') {
            setDetailVisible(false);
            setIsSheetOpen(true);
        } else {
            detailSheetRef.current?.close();
            setIsSheetOpen(true);
        }
    };

    const handleSubmitPayment = async () => {
        // Handled by PaymentModal
    };

    // Nama yang sudah punya hutang: dipilih dari sini supaya masuk ke grup yang sama.
    const namaSaran = useMemo(() => {
        const kata = createName.trim().toLowerCase();
        return (grupQuery.data ?? [])
            .map((g) => g.nama)
            .filter((n) => n.toLowerCase().includes(kata) && n.toLowerCase() !== kata)
            .slice(0, 8);
    }, [grupQuery.data, createName]);

    const renderCreateContent = () => (
        <View className="p-8">
            <Typography variant="h2" weight="bold" className="mb-6 tracking-tighter">Buat Hutang Baru</Typography>

            <Input
                label="Nama Kreditur"
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

            <View className="mb-6">
                <Typography className="mb-3 text-textGray font-bold text-[10px] uppercase tracking-widest">Sumber Hutang</Typography>
                <View className="flex-row flex-wrap gap-2">
                    {Object.entries(SUMBER_LABEL).map(([key, label]) => (
                        <Pressable
                            key={key}
                            onPress={() => setCreateSource(key)}
                            className={`px-4 py-2.5 rounded-2xl border ${createSource === key ? 'border-primary bg-primary/5' : 'border-transparent bg-surface/50'}`}
                        >
                            <Typography
                                className={createSource === key ? 'text-primary' : 'text-textGray'}
                                weight={createSource === key ? 'bold' : 'medium'}
                                variant="caption"
                            >
                                {label}
                            </Typography>
                        </Pressable>
                    ))}
                </View>
            </View>

                        <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest">Metode Penerimaan</Typography>
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
                                            className={`flex-1 py-3 items-center rounded-xl border ${p.metode === m ? 'border-primary bg-primary' : 'border-transparent bg-surface'}`}
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
                            onPress={() => setCreatePayments([...createPayments, { id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }])}
                            className="flex-row items-center justify-center p-4 border border-dashed border-transparent rounded-[24px] bg-surface"
                        >
                            <Plus size={18} color="#64748B" className="mr-2" />
                            <Typography weight="bold" className="text-textGray text-xs">Tambah Metode Penerimaan</Typography>
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
                placeholder="Contoh: Pinjaman modal usaha"
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
                    title={createMutation.isPending ? 'Menyimpan...' : 'Simpan Hutang'}
                    onPress={handleSubmitCreate}
                    disabled={createMutation.isPending}
                    loading={createMutation.isPending}
                    className="flex-[2] rounded-[20px] h-14"
                />
            </View>
        </View>
    );

    const renderDetailContent = () => (
        selectedHutang && (
            <View className="p-6">
                <View className="flex-row justify-between items-start mb-4">
                    <View>
                        <Typography variant="h2" weight="bold">{selectedHutang.nama_kreditur}</Typography>
                        <Typography variant="caption" className="text-textGray">{selectedHutang.nomor_hutang}</Typography>
                    </View>
                    <Badge
                        label={selectedHutang.status === 'LUNAS' ? 'Lunas' : selectedHutang.status === 'SEBAGIAN' ? 'Belum Lunas' : 'Belum Bayar'}
                        variant={STATUS_BADGE_MAP[selectedHutang.status]}
                    />
                </View>

                <Card variant="outlined" className="p-4 mb-4 border-transparent">
                    <View className="flex-row justify-between mb-2">
                        <Typography variant="caption" className="text-textGray">Total Hutang</Typography>
                        <Typography variant="body2" weight="bold">{formatCurrency(selectedHutang.nominal_hutang)}</Typography>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Typography variant="caption" className="text-textGray">Sudah Dibayar</Typography>
                        <Typography variant="body2" weight="medium" className="text-green-600">{formatCurrency(selectedHutang.total_dibayar)}</Typography>
                    </View>
                    <View className="h-[1px] bg-background my-2" />
                    <View className="flex-row justify-between">
                        <Typography variant="caption" weight="bold" className="text-textGray">Sisa Hutang</Typography>
                        <Typography variant="body1" weight="bold" className="text-red-600">{formatCurrency(selectedHutang.sisa_hutang)}</Typography>
                    </View>
                </Card>

                {/* Informasi hutang untuk verifikasi sebelum pembayaran */}
                <Card variant="outlined" className="p-4 mb-4 border-transparent">
                    <Typography variant="caption" weight="bold" className="text-textGray mb-3">
                        INFORMASI HUTANG
                    </Typography>

                    <View className="gap-3">
                        <View className="flex-row justify-between gap-4">
                            <Typography variant="caption" className="text-textGray">Tanggal Hutang</Typography>
                            <Typography variant="body2" weight="medium" className="text-right">
                                {formatDate(selectedHutang.tanggal)}
                            </Typography>
                        </View>

                        <View className="flex-row justify-between gap-4">
                            <Typography variant="caption" className="text-textGray">Sumber</Typography>
                            <Typography variant="body2" weight="medium" className="text-right">
                                {SUMBER_LABEL[selectedHutang.sumber] || selectedHutang.sumber}
                            </Typography>
                        </View>

                        {selectedHutang.unit && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Unit</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {formatUnitLabel(selectedHutang.unit)}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.nomor_referensi && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Referensi</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {selectedHutang.nomor_referensi}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.catatan && (
                            <View className="mt-2 bg-background rounded-2xl p-3">
                                <Typography variant="caption" className="text-textGray mb-1">Keterangan saat input</Typography>
                                <Typography variant="body2" className="text-textMain">{selectedHutang.catatan}</Typography>
                            </View>
                        )}

                        {selectedHutang.tanggal_jatuh_tempo && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Jatuh Tempo</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {formatDate(selectedHutang.tanggal_jatuh_tempo)}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.tanggal_lunas && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Tanggal Lunas</Typography>
                                <Typography variant="body2" weight="medium" className="text-right text-green-600">
                                    {formatDate(selectedHutang.tanggal_lunas)}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.telepon_kreditur && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-textGray">Telepon</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {selectedHutang.telepon_kreditur}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.alamat_kreditur && (
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Alamat</Typography>
                                <Typography variant="body2">{selectedHutang.alamat_kreditur}</Typography>
                            </View>
                        )}

                        {selectedHutang.catatan && (
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Keterangan</Typography>
                                <Typography variant="body2">{selectedHutang.catatan}</Typography>
                            </View>
                        )}
                    </View>
                </Card>

                {/* History */}
                {selectedHutang.pembayaran && selectedHutang.pembayaran.length > 0 && (
                    <View className="mb-4">
                        <Typography variant="caption" weight="bold" className="text-textGray mb-2">RIWAYAT PEMBAYARAN</Typography>
                        {selectedHutang.pembayaran.map((p: PembayaranHutang) => (
                            <View key={p.id} className="flex-row justify-between py-2.5 border-b border-transparent items-center">
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-textMain">{formatDate(p.tanggal)}</Typography>
                                    <View className="bg-background px-1.5 py-0.5 rounded-md self-start mt-0.5">
                                        <Typography className="text-[8px] font-bold text-textGray tracking-tighter">{p.metode_bayar}</Typography>
                                    </View>
                                </View>
                                <Typography variant="caption" weight="bold" className="text-red-600">-{formatCurrency(p.nominal)}</Typography>
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
                    {selectedHutang.status !== 'LUNAS' && (
                        <Button
                            title="Bayar Hutang"
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
                title={unitLabel ? `Hutang ${unitLabel}` : 'Hutang Usaha'}
                subtitle={unitLabel ? `Daftar hutang unit ${unitLabel}` : 'Monitoring Kewajiban & Pembayaran'}
                showBackButton
                onBackButtonPress={handleGoBack}
            />

            {/* Filters & Search */}
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
                                placeholder="Cari nama kreditur atau nomor hutang..."
                                value={search}
                                onChangeText={setSearch}
                                placeholderTextColor={placeholder}
                                clearButtonMode="while-editing"
                            />
                        </View>
                    </View>
                </View>
            )}

            {/* List */}
            {isLoadingList ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#E11D48" />
                </View>
            ) : (
                <FlatList<Hutang | GrupNama>
                    data={tampilan === 'nama' ? grupList : hutangList}
                    keyExtractor={(item) => (tampilan === 'nama' ? `grup-${(item as GrupNama).nama}` : (item as Hutang).id.toString())}
                    contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                    renderItem={({ item: raw }) => {
                        if (tampilan === 'nama') {
                            const grup = raw as GrupNama;
                            return (
                                <Pressable
                                    onPress={() => router.push({ pathname: '/finance/hutang-nama', params: { nama: grup.nama } })}
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
                        const item = raw as Hutang;
                        return (
                        <Pressable
                            onPress={() => handleOpenDetail(item)}
                            className="bg-surface p-5 rounded-[32px] mb-6 border border-transparent shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-1 mr-3">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">
                                        {item.nama_kreditur}
                                    </Typography>
                                    <Typography variant="caption" className="text-textGray mt-0.5">
                                        {item.nomor_hutang} • {SUMBER_LABEL[item.sumber] || item.sumber}{!unitFilter && item.unit ? ` • ${formatUnitLabel(item.unit)}` : ''}
                                    </Typography>
                                </View>
                                <Badge
                                    label={item.status.replace('_', ' ')}
                                    variant={STATUS_BADGE_MAP[item.status]}
                                />
                            </View>

                            <View className="bg-rose-50 p-4 rounded-2xl flex-row justify-between border border-rose-100/50">
                                <View>
                                    <Typography className="text-rose-600/60 text-[9px] font-bold uppercase tracking-widest mb-1">Total Hutang</Typography>
                                    <Typography weight="semibold" className="text-textMain text-sm">{formatCurrency(item.nominal_hutang)}</Typography>
                                </View>
                                <View className="items-end">
                                    <Typography className="text-rose-600/60 text-[9px] font-bold uppercase tracking-widest mb-1">Sisa</Typography>
                                    <Typography weight="bold" className="text-rose-600 text-sm">{formatCurrency(item.sisa_hutang)}</Typography>
                                </View>
                            </View>
                        </Pressable>
                        );
                    }}
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
                            {/* Summary Card (White Bento Style) */}
                            <View className="bg-surface p-6 rounded-[32px] border border-transparent shadow-sm mb-6">
                                <View className="flex-row justify-between items-center mb-6">
                                    <View className="bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                                        <Typography className="text-rose-600 text-[10px] font-bold uppercase tracking-widest">Global Overview</Typography>
                                    </View>
                                    <Typography className="text-textGray text-[10px] font-bold uppercase tracking-widest">Saldo Hutang</Typography>
                                </View>

                                <View className="flex-row items-center justify-between">
                                    <View>
                                        <Typography variant="h1" weight="bold" className="text-textMain text-3xl tracking-tighter" numberOfLines={1} adjustsFontSizeToFit>
                                            {formatCurrency(overview?.total_sisa || 0)}
                                        </Typography>
                                        <Typography className="text-textGray text-xs mt-1">Total Dari {overview?.jumlah_belum_lunas || 0} {tampilan === 'nama' ? 'Nama' : 'Invoice'}</Typography>
                                    </View>
                                    <View className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                                        <CircleDollarSign size={24} color="#E11D48" />
                                    </View>
                                </View>
                            </View>

                            <Typography variant="h3" weight="bold" className="mb-4 tracking-tight">Daftar Hutang</Typography>
                        </View>
                    }
                    ListEmptyComponent={<EmptyState title="Tidak ada data hutang" icon={CircleDollarSign} />}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E11D48" />}
                />
            )}

            {/* Detail & Create Modals - Platform Specific */}
            {Platform.OS === 'web' ? (
                <>
                    <Modal onRequestClose={() => setDetailVisible(false)} visible={detailVisible} transparent animationType="slide">
                        <View className="flex-1 justify-end bg-black/50">
                            <Pressable className="absolute inset-0" onPress={() => { setDetailVisible(false); setIsSheetOpen(false); }} />
                            <View className="bg-surface" style={styles.sheetContent}>
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <ScrollView
                                    style={{ flex: 1 }}
                                    showsVerticalScrollIndicator
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {renderDetailContent()}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                    <Modal onRequestClose={() => setCreateVisible(false)} visible={createVisible} transparent animationType="slide">
                        <View className="flex-1 justify-end bg-black/50">
                            <Pressable className="absolute inset-0" onPress={() => { setCreateVisible(false); setIsSheetOpen(false); }} />
                            <View className="bg-surface" style={styles.sheetContent}>
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <ScrollView
                                    style={{ flex: 1 }}
                                    showsVerticalScrollIndicator
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {renderCreateContent()}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                </>
            ) : (
                <>
                    <BottomSheet
                        ref={detailSheetRef}
                        snapPoints={detailSnapPoints}
                        enablePanDownToClose
                        enableContentPanningGesture
                        keyboardBehavior="interactive"
                        keyboardBlurBehavior="restore"
                        android_keyboardInputMode="adjustResize"
                        index={-1}
                        backdropComponent={renderBackdrop}
                        handleIndicatorStyle={chrome.handleIndicatorStyle}
                        backgroundStyle={chrome.backgroundStyle}
                        topInset={insets.top}
                        onClose={() => setIsSheetOpen(false)}
                    >
                        <BottomSheetScrollView
                            contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 48) }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                        >
                            {renderDetailContent()}
                        </BottomSheetScrollView>
                    </BottomSheet>
                    <BottomSheet
                        ref={createSheetRef}
                        snapPoints={createSnapPoints}
                        enablePanDownToClose
                        enableContentPanningGesture
                        keyboardBehavior="interactive"
                        keyboardBlurBehavior="restore"
                        android_keyboardInputMode="adjustResize"
                        index={-1}
                        backdropComponent={renderBackdrop}
                        handleIndicatorStyle={chrome.handleIndicatorStyle}
                        backgroundStyle={chrome.backgroundStyle}
                        topInset={insets.top}
                        onClose={() => setIsSheetOpen(false)}
                    >
                        <BottomSheetScrollView
                            contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 48) }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                        >
                            {renderCreateContent()}
                        </BottomSheetScrollView>
                    </BottomSheet>
                </>
            )}

            {/* Payment Modal - Self-contained (handles its own Modal/BottomSheet) */}
            {selectedHutang && (
                <PaymentModal
                    visible={paymentVisible}
                    onClose={() => setPaymentVisible(false)}
                    onSuccess={onRefresh}
                    id={selectedHutang.id}
                    initialAmount={selectedHutang.sisa_hutang}
                    type="hutang"
                    unit={selectedHutang.unit}
                    kas_jenis={getUnitKasJenis(selectedHutang.unit)}
                />
            )}

            <AlertDialog
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                variant={alertState.variant}
                onClose={hideAlert}
            />

            {/* FAB pojok kanan bawah (di atas tab bar): header desktop menutupi tombol di kanan atas */}
            {canCreate && (
                <Pressable
                    onPress={handleOpenCreate}
                    accessibilityLabel="Buat hutang baru"
                    style={{ position: 'absolute', right: 20, bottom: getCustomTabBarBottomPadding(insets.bottom, 16), elevation: 5, zIndex: 999 }}
                    className="bg-primary w-14 h-14 rounded-full items-center justify-center shadow-xl active:opacity-90"
                >
                    <Plus size={26} color="white" strokeWidth={2.5} />
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    sheetContent: {
        width: '100%',
        maxWidth: 640,
        height: '95%',
        alignSelf: 'center',
        borderTopLeftRadius: 48,
        borderTopRightRadius: 48,
        overflow: 'hidden',
    }
});
