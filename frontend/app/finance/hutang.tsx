import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, FlatList, ActivityIndicator, RefreshControl, Alert, TextInput, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    ChevronLeft,
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
import { useRouter, router } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { keuanganService, Hutang, HutangSummary, HutangStatus, PembayaranHutang } from '../../services/keuangan';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { useHutangList, useHutangSummary, useProcessHutangPaymentSplit, useCreateHutang } from '../../hooks/useKeuangan';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

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

export default function HutangUsahaScreen() {
    const [selectedFilter, setSelectedFilter] = useState<HutangStatus | 'all'>('BELUM_LUNAS');
    const [selectedHutang, setSelectedHutang] = useState<Hutang | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'payment'>('detail');
    const [refreshing, setRefreshing] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // API Hooks
    const { data: listData, isLoading: isLoadingList, refetch: refetchList } = useHutangList({
        limit: 50,
        status: selectedFilter === 'all' ? undefined : selectedFilter,
    });
    const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = useHutangSummary();
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
        { id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }
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

    const hutangList = listData?.data || [];

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/finance');
        }
    };

    // Payment form
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }
    ]);
    const [paymentNote, setPaymentNote] = useState('');

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
        setCreatePayments([{ id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }]);
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

            await createMutation.mutateAsync(payload);
            showAlert('Sukses', 'Hutang berhasil dibuat', 'success');

            // Reset state
            setCreateName('');
            setCreateAmount('');
            setCreateNote('');
            setCreateMethod(undefined);
            setIsCreateSplitPayment(false);
            setCreatePayments([{ id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }]);

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
        setPayments([{
            id: Date.now(),
            metode: 'TUNAI',
            nominal: formatNumber(selectedHutang.sisa_hutang.toString()),
            catatan: ''
        }]);
        setPaymentNote('');
        setIsSplitPayment(false);
        if (Platform.OS === 'web') {
            setDetailVisible(false);
            setPaymentVisible(true);
            setIsSheetOpen(true);
        } else {
            detailSheetRef.current?.close();
            setTimeout(() => {
                paymentSheetRef.current?.expand();
                setIsSheetOpen(true);
            }, 300);
        }
    };

    const handleSubmitPayment = async () => {
        if (!selectedHutang || payments.length === 0) return;

        const validatedPayments = payments
            .map(p => ({
                metode: p.metode as any,
                nominal: parseNumber(p.nominal),
                catatan: p.catatan || undefined
            }))
            .filter(p => p.nominal > 0);

        if (validatedPayments.length === 0) {
            showAlert('Validasi', 'Minimal satu pembayaran dengan nominal > 0', 'warning');
            return;
        }

        const totalInternal = validatedPayments.reduce((acc, p) => acc + p.nominal, 0);
        if (totalInternal > selectedHutang.sisa_hutang) {
            showAlert('Validasi', `Total pembayaran (${formatCurrency(totalInternal)}) melebihi sisa hutang (${formatCurrency(selectedHutang.sisa_hutang)})`, 'warning');
            return;
        }

        try {
            await paymentMutation.mutateAsync({
                hutang_id: selectedHutang.id,
                tanggal: new Date().toISOString().split('T')[0],
                payments: validatedPayments,
                catatan: paymentNote || undefined,
            });
            showAlert('Sukses', 'Pembayaran berhasil dicatat', 'success');
            if (Platform.OS === 'web') {
                setPaymentVisible(false);
                setIsSheetOpen(false);
            }
            else {
                paymentSheetRef.current?.close();
                setIsSheetOpen(false);
            }
            setSelectedHutang(null);
            refetchList();
            refetchSummary();
        } catch (error: any) {
            const errorMessage = error?.response?.data?.detail || error?.detail || error?.message || 'Terjadi kesalahan saat memproses pembayaran';
            showAlert('Gagal', errorMessage, 'error');
            console.error(error);
        }
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
                        <TouchableOpacity
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
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <Typography className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Metode Penerimaan (Opsional)</Typography>
                    <TouchableOpacity
                        onPress={() => setIsCreateSplitPayment(!isCreateSplitPayment)}
                        className={`px-3 py-1.5 rounded-full border ${isCreateSplitPayment ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <Typography className={`text-[9px] font-bold ${isCreateSplitPayment ? 'text-amber-600' : 'text-gray-400'}`}>
                            {isCreateSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                        </Typography>
                    </TouchableOpacity>
                </View>

                {!isCreateSplitPayment ? (
                    <View className="flex-row space-x-2 gap-2">
                        <TouchableOpacity
                            onPress={() => setCreateMethod(undefined)}
                            className={`flex-1 py-3.5 items-center rounded-2xl border ${!createMethod ? 'border-gray-400 bg-gray-100' : 'border-gray-100 bg-gray-50/50'}`}
                        >
                            <Typography className={!createMethod ? 'text-gray-700 font-bold' : 'text-gray-400'} variant="caption">Tidak Ada</Typography>
                        </TouchableOpacity>
                        {['TUNAI', 'TRANSFER'].map((m) => (
                            <TouchableOpacity
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
                            </TouchableOpacity>
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
                                        <TouchableOpacity
                                            onPress={() => setCreatePayments(createPayments.filter(item => item.id !== p.id))}
                                            className="w-8 h-8 items-center justify-center bg-rose-50 rounded-xl"
                                        >
                                            <Trash2 size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View className="flex-row space-x-2 mb-4 gap-2">
                                    {['TUNAI', 'TRANSFER'].map((m) => (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => setCreatePayments(createPayments.map(item => item.id === p.id ? { ...item, metode: m } : item))}
                                            className={`flex-1 py-3 items-center rounded-xl border ${p.metode === m ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={p.metode === m ? 'text-white' : 'text-gray-400'}>{m}</Typography>
                                        </TouchableOpacity>
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

                        <TouchableOpacity
                            onPress={() => setCreatePayments([...createPayments, { id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }])}
                            className="flex-row items-center justify-center p-4 border border-dashed border-gray-300 rounded-[24px] bg-white"
                        >
                            <Plus size={18} color="#64748B" className="mr-2" />
                            <Typography weight="bold" className="text-gray-500 text-xs">Tambah Metode Penerimaan</Typography>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

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

                {/* Info Sumber */}
                <View className="mb-4">
                    <Typography variant="caption" weight="bold" className="text-gray-500 mb-1">SUMBER</Typography>
                    <Typography variant="body2">{SUMBER_LABEL[selectedHutang.sumber] || selectedHutang.sumber}</Typography>
                    {selectedHutang.nomor_referensi && (
                        <Typography variant="caption" className="text-gray-400">Ref: {selectedHutang.nomor_referensi}</Typography>
                    )}
                </View>

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

    const renderPaymentContent = () => {
        const totalBayar = payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);
        const sisaHutang = selectedHutang?.sisa_hutang || 0;
        const sisaSetelahBayar = sisaHutang - totalBayar;

        return (
            <View className="p-8">
                <View className="flex-row justify-between items-center mb-6">
                    <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">Bayar Hutang</Typography>
                </View>

                {selectedHutang && (
                    <Card variant="outlined" className="p-6 mb-8 border-rose-100 bg-rose-50 rounded-[32px]">
                        <View className="flex-row justify-between mb-2">
                            <Typography variant="caption" className="text-rose-600/60 font-bold uppercase tracking-widest">Sisa Hutang</Typography>
                            <Typography variant="body2" weight="bold" className="text-rose-600 font-bold">{formatCurrency(selectedHutang.sisa_hutang)}</Typography>
                        </View>
                        <View className="flex-row justify-between">
                            <Typography variant="caption" className="text-rose-600/60 font-bold uppercase tracking-widest">Sisa Setelah Bayar</Typography>
                            <Typography variant="body2" weight="bold" className="text-primary">
                                {formatCurrency(Math.max(0, sisaSetelahBayar))}
                            </Typography>
                        </View>
                    </Card>
                )}

                <View className="mb-6">
                    {payments.map((p, idx) => (
                        <Card key={p.id} variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                            <View className="flex-row justify-between items-center mb-4">
                                <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-widest">
                                    Pembayaran #{idx + 1}
                                </Typography>
                                {payments.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => setPayments(prev => prev.filter(item => item.id !== p.id))}
                                        className="bg-rose-50 p-2 rounded-full"
                                    >
                                        <Trash2 size={16} color="#E11D48" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View className="flex-row space-x-2 mb-4 gap-2">
                                {['TUNAI', 'TRANSFER'].map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        onPress={() => setPayments(prev => prev.map(item => item.id === p.id ? { ...item, metode: m } : item))}
                                        className={`flex-1 py-3 items-center rounded-xl border ${p.metode === m ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                                    >
                                        <Typography
                                            className={p.metode === m ? 'text-white text-xs font-bold' : 'text-textGray text-xs'}
                                        >
                                            {m}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Input
                                label="Nominal (Rp)"
                                keyboardType="numeric"
                                placeholder="0"
                                value={p.nominal}
                                onChangeText={(t) => setPayments(prev => prev.map(item => item.id === p.id ? { ...item, nominal: formatNumber(t) } : item))}
                                containerClassName="mb-0"
                            />
                        </Card>
                    ))}

                    <TouchableOpacity
                        onPress={() => setPayments(prev => [...prev, { id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }])}
                        className="flex-row items-center justify-center p-4 border border-dashed border-gray-300 rounded-[24px] bg-gray-50/50 active:bg-gray-100"
                    >
                        <Plus size={20} color="#64748B" className="mr-2" />
                        <Typography weight="bold" className="text-gray-500">Tambah Metode Pembayaran</Typography>
                    </TouchableOpacity>
                </View>

                <Input
                    label="Catatan (Opsional)"
                    placeholder="Contoh: Pelunasan sisa pembelian part"
                    value={paymentNote}
                    onChangeText={setPaymentNote}
                    multiline
                    numberOfLines={2}
                    containerClassName="mb-8"
                />

                <View className="flex-row space-x-3">
                    <Button
                        title="Batal"
                        variant="outline"
                        onPress={() => {
                            if (Platform.OS === 'web') {
                                setPaymentVisible(false);
                                setIsSheetOpen(false);
                            } else {
                                paymentSheetRef.current?.close();
                            }
                        }}
                        className="flex-1 rounded-2xl h-14"
                    />
                    <Button
                        title={paymentMutation.isPending ? 'Memproses...' : 'Simpan Pembayaran'}
                        onPress={handleSubmitPayment}
                        disabled={paymentMutation.isPending || totalBayar <= 0}
                        loading={paymentMutation.isPending}
                        className="flex-[1.5] rounded-2xl h-14 shadow-lg shadow-primary/20"
                    />
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View className="bg-rose-600 pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Hutang Usaha</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Monitoring Kewajiban & Pembayaran</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleOpenCreate}
                        className="w-11 h-11 bg-white rounded-2xl items-center justify-center shadow-lg shadow-white/20"
                    >
                        <Plus size={20} color="#E11D48" />
                    </TouchableOpacity>
                </View>

                {/* Summary Card */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-white/20 px-3 py-1.5 rounded-full">
                            <Typography className="text-white text-[10px] font-bold uppercase tracking-widest">Global Overview</Typography>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View>
                            <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter">
                                {formatCurrency(summary?.total_sisa || 0)}
                            </Typography>
                            <Typography className="text-white/40 text-xs mt-1">Total Sisa Hutang</Typography>
                        </View>
                        <View className="bg-white/10 p-4 rounded-2xl">
                            <CircleDollarSign size={24} color="white" />
                        </View>
                    </View>
                </View>
            </View>

            {/* Filters */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="p-1">
                        {STATUS_FILTERS.map((filter) => (
                            <TouchableOpacity
                                key={filter.value}
                                onPress={() => setSelectedFilter(filter.value)}
                                className={`px-5 py-2.5 rounded-2xl mr-2 ${selectedFilter === filter.value ? 'bg-rose-600 border border-white/10' : 'bg-gray-50 border border-gray-100'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={selectedFilter === filter.value ? 'text-white' : 'text-textGray/60'}
                                >
                                    {filter.label}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

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
                        <TouchableOpacity
                            onPress={() => handleOpenDetail(item)}
                            activeOpacity={0.9}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-1 mr-3">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight">
                                        {item.nama_kreditur}
                                    </Typography>
                                    <Typography variant="caption" className="text-textGray mt-0.5">
                                        {item.nomor_hutang} • {SUMBER_LABEL[item.sumber] || item.sumber}
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
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<EmptyState title="Tidak ada data hutang" icon={CircleDollarSign} />}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}

            {/* Modal Components */}
            {Platform.OS === 'web' ? (
                <>
                    <Modal visible={detailVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.webModalContent}>
                                {renderDetailContent()}
                            </View>
                        </View>
                    </Modal>
                    <Modal visible={paymentVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.webModalContent}>
                                {renderPaymentContent()}
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
                        ref={paymentSheetRef}
                        snapPoints={paymentSnapPoints}
                        enablePanDownToClose
                        index={-1}
                        backgroundStyle={{ borderRadius: 40 }}
                        onClose={() => setIsSheetOpen(false)}
                    >
                        <BottomSheetScrollView>{renderPaymentContent()}</BottomSheetScrollView>
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
