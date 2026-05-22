import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StatusBar, FlatList, ActivityIndicator, RefreshControl, Alert, TextInput, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    CircleDollarSign,
    Search,
    ChevronRight,
    CreditCard,
    Plus,
    Trash2,
} from 'lucide-react-native';
import { useRouter, router, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { onlineManager } from '@tanstack/react-query';
import { keuanganService, Hutang, HutangSummary, HutangStatus, PembayaranHutang } from '../../services/keuangan';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { useHutangList, useHutangSummary, useProcessHutangPaymentSplit, useCreateHutang } from '../../hooks/useKeuangan';
import { useMobilList } from '../../hooks/useMobil';
import { useTransaksiBengkelList } from '../../hooks/useBengkel';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PaymentModal } from '../../components/PaymentModal';
import { useAuthStore } from '../../store/useAuthStore';

const STATUS_FILTERS: { label: string; value: HutangStatus | 'all' }[] = [
    { label: 'Semua', value: 'all' },
    { label: 'Belum Lunas', value: 'BELUM_LUNAS' },
    { label: 'Sebagian', value: 'SEBAGIAN' },
    { label: 'Lunas', value: 'LUNAS' },
];

const STATUS_BADGE_MAP: Record<HutangStatus, 'warning' | 'success' | 'info'> = {
    BELUM_LUNAS: 'warning',
    SEBAGIAN: 'info',
    LUNAS: 'success',
};

const SUMBER_LABEL: Record<string, string> = {
    PEMBELIAN_PART: 'Pembelian Part',
    PEMBELIAN_MOBIL: 'Pembelian Unit',
    LAINNYA: 'Lainnya',
};

const formatUnitLabel = (unit?: string) => {
    if (!unit) return undefined;
    return unit
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
};

export default function HutangUsahaScreen() {
    const { user } = useAuthStore();
    const params = useLocalSearchParams<{ unit?: string }>();
    const unitFilter = params.unit === 'BENGKEL' ? 'BENGKEL' : undefined;
    const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';
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
    const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = useHutangSummary({ unit: unitFilter as any });
    const paymentMutation = useProcessHutangPaymentSplit();
    const createMutation = useCreateHutang();

    const detailSheetRef = useRef<BottomSheet>(null);
    const paymentSheetRef = useRef<BottomSheet>(null);
    const createSheetRef = useRef<BottomSheet>(null);

    const detailSnapPoints = useMemo(() => ['70%', '85%'], []);
    const paymentSnapPoints = useMemo(() => ['65%', '85%'], []);
    const createSnapPoints = useMemo(() => ['75%', '90%'], []);

    // Create form states
    const [createVisible, setCreateVisible] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createSource, setCreateSource] = useState('LAINNYA');
    const [createMethod, setCreateMethod] = useState<'TUNAI' | 'TRANSFER' | undefined>(undefined);
    const [createDate, setCreateDate] = useState(new Date().toISOString().split('T')[0]);
    const [createNote, setCreateNote] = useState('');
    const [isCreateSplitPayment, setIsCreateSplitPayment] = useState(false);
    const [createPayments, setCreatePayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }
    ]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchList(), refetchSummary()]);
        setRefreshing(false);
    }, [refetchList, refetchSummary]);

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

    const hutangListRaw = listData?.data || [];

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

        // 2. Map sold cars to their Bengkel invoice numbers (BGL...)
        const soldBengkelInvoices = new Set<string>();
        if (bengkelData?.data) {
            bengkelData.data.forEach((b: any) => {
                const kategori = String(b.kategori || '').toLowerCase();
                if (kategori === 'jual_beli_mobil' && b.mobil_id && soldCarIds.has(String(b.mobil_id))) {
                    if (b.nomor_transaksi) soldBengkelInvoices.add(b.nomor_transaksi);
                }
            });
        }

        let totalSisa = 0;
        let countBelumLunas = 0;

        const filtered = hutangListRaw.filter(item => {
            const isInternal = item.nama_kreditur?.toUpperCase().includes('BENGKEL');

            // Jika internal dan ada referensi nomor_transaksi bengkel, cek apakah mobilnya sudah terjual
            if (isInternal && item.nomor_referensi) {
                if (soldBengkelInvoices.has(item.nomor_referensi)) {
                    return false; // Sembunyikan otomatis
                }
            }
            
            // Accumulate summary for visible items
            if (item.status !== 'LUNAS') {
                totalSisa += item.sisa_hutang;
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
        setCreateSource('LAINNYA');
        setCreateMethod(undefined);
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

        try {
            const validatedPayments = createPayments
                .filter(p => parseNumber(p.nominal) > 0)
                .map(p => ({
                    metode: p.metode as any,
                    nominal: parseNumber(p.nominal),
                    catatan: p.catatan || undefined
                }));

            const payload: any = {
                tanggal: createDate,
                sumber: createSource as any,
                nama_kreditur: createName,
                nominal_hutang: parseNumber(createAmount),
                catatan: createNote,
            };

            if (isCreateSplitPayment && validatedPayments.length > 0) {
                payload.payments = validatedPayments;
            } else if (createMethod) {
                payload.metode_pembayaran = createMethod;
            }

            if (!onlineManager.isOnline()) {
                createMutation.mutate(payload);
                showAlert('Offline Mode', 'Hutang telah disimpan di antrean offline.', 'info');
                // Reset state
                setCreateName('');
                setCreateAmount('');
                setCreateNote('');
                setCreateMethod(undefined);
                setIsCreateSplitPayment(false);
                setCreatePayments([{ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);

                if (Platform.OS === 'web') {
                    setCreateVisible(false);
                    setIsSheetOpen(false);
                } else {
                    createSheetRef.current?.close();
                    setIsSheetOpen(false);
                }
                return;
            }

            await createMutation.mutateAsync(payload);
            showAlert('Sukses', 'Hutang berhasil dibuat', 'success');

            // Reset state
            setCreateName('');
            setCreateAmount('');
            setCreateNote('');
            setCreateMethod(undefined);
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

    const renderCreateContent = () => (
        <View className="p-8">
            <Typography variant="h2" weight="bold" className="mb-6 tracking-tighter">Buat Hutang Baru</Typography>

            <Input
                label="Nama Kreditur"
                placeholder="Nama orang/perusahaan"
                value={createName}
                onChangeText={setCreateName}
            />

            <Input
                label="Nominal (Rp)"
                keyboardType="numeric"
                placeholder="0"
                value={createAmount}
                onChangeText={(t) => setCreateAmount(formatNumber(t))}
            />

            <View className="mb-6">
                <Typography className="mb-3 text-gray-500 font-bold text-[10px] uppercase tracking-widest">Sumber Hutang</Typography>
                <View className="flex-row flex-wrap gap-2">
                    {Object.entries(SUMBER_LABEL).map(([key, label]) => (
                        <Pressable
                            key={key}
                            onPress={() => setCreateSource(key)}
                            className={`px-4 py-2.5 rounded-2xl border ${createSource === key ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50/50'}`}
                        >
                            <Typography
                                className={createSource === key ? 'text-primary' : 'text-gray-400'}
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
                    <Typography className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Metode Penerimaan (Opsional)</Typography>
                    <Pressable
                        onPress={() => setIsCreateSplitPayment(!isCreateSplitPayment)}
                        className={`px-3 py-1.5 rounded-full border ${isCreateSplitPayment ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <Typography className={`text-[9px] font-bold ${isCreateSplitPayment ? 'text-amber-600' : 'text-gray-400'}`}>
                            {isCreateSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                        </Typography>
                    </Pressable>
                </View>

                {!isCreateSplitPayment ? (
                    <View className="flex-row space-x-2 gap-2">
                        <Pressable
                            onPress={() => setCreateMethod(undefined)}
                            className={`flex-1 py-3.5 items-center rounded-2xl border ${!createMethod ? 'border-gray-400 bg-gray-100' : 'border-gray-100 bg-gray-50/50'}`}
                        >
                            <Typography className={!createMethod ? 'text-gray-700 font-bold' : 'text-gray-400'} variant="caption">Tidak Ada</Typography>
                        </Pressable>
                        {['TUNAI', 'TRANSFER'].map((m) => (
                            <Pressable
                                key={m}
                                onPress={() => setCreateMethod(m as 'TUNAI' | 'TRANSFER')}
                                className={`flex-1 py-3.5 items-center rounded-2xl border ${createMethod === m ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50/50'}`}
                            >
                                <Typography
                                    className={createMethod === m ? 'text-primary font-bold' : 'text-gray-400'}
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
                            <Card key={p.id} variant="outlined" className="p-5 border-gray-100 rounded-[24px] bg-gray-50/30">
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
                                            className={`flex-1 py-3 items-center rounded-xl border ${p.metode === m ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={p.metode === m ? 'text-white' : 'text-gray-400'}>{m}</Typography>
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
                            className="flex-row items-center justify-center p-4 border border-dashed border-gray-300 rounded-[24px] bg-white"
                        >
                            <Plus size={18} color="#64748B" className="mr-2" />
                            <Typography weight="bold" className="text-gray-500 text-xs">Tambah Metode Penerimaan</Typography>
                        </Pressable>
                    </View>
                )}
            </View>

            <Input
                label="Tanggal (YYYY-MM-DD)"
                placeholder="2024-01-01"
                value={createDate}
                onChangeText={setCreateDate}
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
                        <Typography variant="caption" className="text-gray-400">{selectedHutang.nomor_hutang}</Typography>
                    </View>
                    <Badge
                        label={selectedHutang.status === 'LUNAS' ? 'Lunas' : selectedHutang.status === 'SEBAGIAN' ? 'Sebagian' : 'Belum Lunas'}
                        variant={STATUS_BADGE_MAP[selectedHutang.status]}
                    />
                </View>

                <Card variant="outlined" className="p-4 mb-4 border-gray-100">
                    <View className="flex-row justify-between mb-2">
                        <Typography variant="caption" className="text-gray-500">Total Hutang</Typography>
                        <Typography variant="body2" weight="bold">{formatCurrency(selectedHutang.nominal_hutang)}</Typography>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Typography variant="caption" className="text-gray-500">Sudah Dibayar</Typography>
                        <Typography variant="body2" weight="medium" className="text-green-600">{formatCurrency(selectedHutang.total_dibayar)}</Typography>
                    </View>
                    <View className="h-[1px] bg-gray-100 my-2" />
                    <View className="flex-row justify-between">
                        <Typography variant="caption" weight="bold" className="text-gray-600">Sisa Hutang</Typography>
                        <Typography variant="body1" weight="bold" className="text-red-600">{formatCurrency(selectedHutang.sisa_hutang)}</Typography>
                    </View>
                </Card>

                {/* Informasi hutang untuk verifikasi sebelum pembayaran */}
                <Card variant="outlined" className="p-4 mb-4 border-gray-100">
                    <Typography variant="caption" weight="bold" className="text-gray-500 mb-3">
                        INFORMASI HUTANG
                    </Typography>

                    <View className="gap-3">
                        <View className="flex-row justify-between gap-4">
                            <Typography variant="caption" className="text-gray-500">Tanggal Hutang</Typography>
                            <Typography variant="body2" weight="medium" className="text-right">
                                {formatDate(selectedHutang.tanggal)}
                            </Typography>
                        </View>

                        <View className="flex-row justify-between gap-4">
                            <Typography variant="caption" className="text-gray-500">Sumber</Typography>
                            <Typography variant="body2" weight="medium" className="text-right">
                                {SUMBER_LABEL[selectedHutang.sumber] || selectedHutang.sumber}
                            </Typography>
                        </View>

                        {selectedHutang.unit && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-gray-500">Unit</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {formatUnitLabel(selectedHutang.unit)}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.nomor_referensi && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-gray-500">Referensi</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {selectedHutang.nomor_referensi}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.tanggal_jatuh_tempo && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-gray-500">Jatuh Tempo</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {formatDate(selectedHutang.tanggal_jatuh_tempo)}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.tanggal_lunas && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-gray-500">Tanggal Lunas</Typography>
                                <Typography variant="body2" weight="medium" className="text-right text-green-600">
                                    {formatDate(selectedHutang.tanggal_lunas)}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.telepon_kreditur && (
                            <View className="flex-row justify-between gap-4">
                                <Typography variant="caption" className="text-gray-500">Telepon</Typography>
                                <Typography variant="body2" weight="medium" className="text-right">
                                    {selectedHutang.telepon_kreditur}
                                </Typography>
                            </View>
                        )}

                        {selectedHutang.alamat_kreditur && (
                            <View>
                                <Typography variant="caption" className="text-gray-500 mb-1">Alamat</Typography>
                                <Typography variant="body2">{selectedHutang.alamat_kreditur}</Typography>
                            </View>
                        )}

                        {selectedHutang.catatan && (
                            <View>
                                <Typography variant="caption" className="text-gray-500 mb-1">Keterangan</Typography>
                                <Typography variant="body2">{selectedHutang.catatan}</Typography>
                            </View>
                        )}
                    </View>
                </Card>

                {/* History */}
                {selectedHutang.pembayaran && selectedHutang.pembayaran.length > 0 && (
                    <View className="mb-4">
                        <Typography variant="caption" weight="bold" className="text-gray-500 mb-2">RIWAYAT PEMBAYARAN</Typography>
                        {selectedHutang.pembayaran.map((p: PembayaranHutang) => (
                            <View key={p.id} className="flex-row justify-between py-2.5 border-b border-gray-50 items-center">
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-textMain">{formatDate(p.tanggal)}</Typography>
                                    <View className="bg-gray-100 px-1.5 py-0.5 rounded-md self-start mt-0.5">
                                        <Typography className="text-[8px] font-bold text-gray-500 tracking-tighter">{p.metode_bayar}</Typography>
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
        <View className="flex-1 bg-surface">
            <Header
                title={unitFilter ? 'Hutang Bengkel' : 'Hutang Usaha'}
                subtitle={unitFilter ? 'Daftar hutang unit bengkel' : 'Monitoring Kewajiban & Pembayaran'}
                showBackButton
                onBackButtonPress={handleGoBack}
                rightElement={canCreate ? (
                    <Pressable
                        onPress={handleOpenCreate}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <Plus size={24} color="white" />
                    </Pressable>
                ) : undefined}
            />

            {/* Filters & Search */}
            {!isSheetOpen && (
                <View className="px-6 -mt-8 z-10">
                    <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-col">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 p-1">
                            {STATUS_FILTERS.map((filter) => (
                                <Pressable
                                    key={filter.value}
                                    onPress={() => setSelectedFilter(filter.value)}
                                    className={`px-5 py-2.5 rounded-2xl mr-2 ${selectedFilter === filter.value ? 'bg-primary border border-white/10 shadow-md shadow-primary/20' : 'bg-gray-50 border border-gray-100'}`}
                                >
                                    <Typography
                                        variant="caption"
                                        weight="bold"
                                        className={selectedFilter === filter.value ? 'text-white' : 'text-textGray/60'}
                                    >
                                        {filter.label}
                                    </Typography>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <View className="flex-row items-center px-4 bg-gray-50 h-14 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-sm text-textMain font-medium h-full"
                                placeholder="Cari nama kreditur atau nomor hutang..."
                                value={search}
                                onChangeText={setSearch}
                                placeholderTextColor="#9CA3AF"
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
                <FlatList
                    data={hutangList}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => handleOpenDetail(item)}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm"
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
                    )}
                    ListHeaderComponent={
                        <View className="mb-6">
                            {/* Summary Card (White Bento Style) */}
                            <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                                <View className="flex-row justify-between items-center mb-6">
                                    <View className="bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                                        <Typography className="text-rose-600 text-[10px] font-bold uppercase tracking-widest">Global Overview</Typography>
                                    </View>
                                    <Typography className="text-textGray/40 text-[10px] font-bold uppercase tracking-widest">Saldo Hutang</Typography>
                                </View>

                                <View className="flex-row items-center justify-between">
                                    <View>
                                        <Typography variant="h1" weight="bold" className="text-textMain text-3xl tracking-tighter">
                                            {formatCurrency(localSummary?.total_sisa || 0)}
                                        </Typography>
                                        <Typography className="text-textGray/40 text-xs mt-1">Total Dari {localSummary?.jumlah_belum_lunas || 0} Invoice</Typography>
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
                    <Modal visible={detailVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.webModalContent}>
                                {renderDetailContent()}
                            </View>
                        </View>
                    </Modal>
                    <Modal visible={createVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.webModalContent}>
                                <ScrollView>{renderCreateContent()}</ScrollView>
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
                        index={-1}
                        backgroundStyle={{ borderRadius: 40 }}
                        onClose={() => setIsSheetOpen(false)}
                    >
                        <BottomSheetScrollView>{renderDetailContent()}</BottomSheetScrollView>
                    </BottomSheet>
                    <BottomSheet
                        ref={createSheetRef}
                        snapPoints={createSnapPoints}
                        enablePanDownToClose
                        index={-1}
                        backgroundStyle={{ borderRadius: 40 }}
                        onClose={() => setIsSheetOpen(false)}
                    >
                        <BottomSheetScrollView>{renderCreateContent()}</BottomSheetScrollView>
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
                    kas_jenis={selectedHutang.unit ? `KAS_UNIT_${selectedHutang.unit}` : undefined}
                />
            )}

            <AlertDialog
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                variant={alertState.variant}
                onClose={hideAlert}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    webModalContent: {
        backgroundColor: 'white',
        width: 500,
        borderRadius: 32,
        overflow: 'hidden',
    }
});
