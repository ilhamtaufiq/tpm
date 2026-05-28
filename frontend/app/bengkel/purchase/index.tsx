import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
    ChevronLeft,
    ShoppingCart,
    Plus,
    Trash2,
    Calendar,
    Truck,
    Search,
    Package,
    X
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QrCode } from 'lucide-react-native';
import { BarcodeScannerModal } from '../../../components/ui/BarcodeScannerModal';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { MasterDataSelector } from '../../../components/ui/MasterDataSelector';
import { useCreatePembelianParts, useSparePartsList, useUpdatePembelianParts } from '../../../hooks/useBengkel';
import { formatNumber, parseNumber, formatCurrency } from '../../../utils/format';
import { bengkelService } from '../../../services/bengkel';

export default function PurchaseScreen() {
    const router = useRouter(); const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ id?: string }>();
    const editId = params.id ? Number(params.id) : null;
    const isEditMode = Number.isFinite(editId) && !!editId;

    // Form State
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [nomorFaktur, setNomorFaktur] = useState('');
    const [tanggal, setTanggal] = useState(new Date());
    const [items, setItems] = useState<any[]>([]);
    const [catatan, setCatatan] = useState('');
    const [statusBayar, setStatusBayar] = useState('LUNAS');
    const [metodeBayar, setMetodeBayar] = useState<string | null>(null);
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; sumber: string; nominal: string }[]>([
        { id: Date.now() + Math.random(), sumber: 'BENGKEL_TUNAI', nominal: '' }
    ]);

    const getPaymentDetails = (sumber: string) => {
        if (sumber === 'BENGKEL_TUNAI') return { metode: 'TUNAI', kas_jenis: 'KAS_UNIT_BENGKEL' };
        if (sumber === 'UTAMA_TUNAI') return { metode: 'TUNAI', kas_jenis: 'KAS_UTAMA' };
        if (sumber === 'UTAMA_TRANSFER') return { metode: 'TRANSFER', kas_jenis: 'BANK_UTAMA' };
        return { metode: 'TUNAI', kas_jenis: 'KAS_UNIT_BENGKEL' };
    };

    // Modal State
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [partSearchQuery, setPartSearchQuery] = useState('');
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null); // Track which item row triggered the modal

    // API Hooks
    const createPembelianMutation = useCreatePembelianParts();
    const updatePembelianMutation = useUpdatePembelianParts();
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const { data: partsData, isLoading: isLoadingParts } = useSparePartsList({ search: partSearchQuery });
    const spareParts = useMemo(() =>
        partsData?.pages.flatMap((page: any) => page.data || []) || [],
        [partsData]
    );

    useEffect(() => {
        if (!isEditMode || !editId) return;

        const loadDetail = async () => {
            setIsLoadingDetail(true);
            try {
                const detail = await bengkelService.getDetailPembelianPart(editId);
                setSelectedSupplier(detail.supplier || {
                    id: detail.supplier_id,
                    nama: detail.supplier_nama,
                });
                setNomorFaktur(detail.nomor_faktur && detail.nomor_faktur !== '-' ? detail.nomor_faktur : '');
                setTanggal(detail.tanggal ? new Date(detail.tanggal) : new Date());
                setCatatan(detail.catatan || '');
                setItems((detail.detail || []).map((item: any) => ({
                    id: item.id || Date.now() + Math.random(),
                    spare_part_id: item.spare_part_id,
                    name: item.spare_part?.nama || item.spare_part_nama || '',
                    qty: String(item.qty || 1),
                    price: formatNumber(String(item.harga_satuan || 0)),
                })));

                const hydratedPayments = Array.isArray(detail.payments) && detail.payments.length > 0
                    ? detail.payments.map((payment: any, index: number) => ({
                        id: Date.now() + index + Math.random(),
                        sumber: payment.kas_jenis === 'BANK_UTAMA'
                            ? 'UTAMA_TRANSFER'
                            : payment.kas_jenis === 'KAS_UTAMA'
                                ? 'UTAMA_TUNAI'
                                : 'BENGKEL_TUNAI',
                        nominal: formatNumber(String(payment.jumlah || 0)),
                    }))
                    : [{ id: Date.now() + Math.random(), sumber: 'BENGKEL_TUNAI', nominal: '' }];

                setPayments(hydratedPayments);
                setIsSplitPayment(hydratedPayments.length > 1 || detail.metode_bayar === 'SPLIT');
                setStatusBayar(detail.status_bayar || 'BELUM_LUNAS');
                if (detail.metode_bayar === 'KREDIT' || (detail.status_bayar !== 'LUNAS' && hydratedPayments.every((p: any) => !parseNumber(p.nominal)))) {
                    setMetodeBayar('KREDIT');
                } else if (hydratedPayments[0]?.sumber) {
                    setMetodeBayar(hydratedPayments[0].sumber);
                }
            } catch (error: any) {
                const errorDetail = error.response?.data?.detail;
                const message = typeof errorDetail === 'string' ? errorDetail : 'Gagal memuat detail pembelian';
                alert(message);
                handleBack();
            } finally {
                setIsLoadingDetail(false);
            }
        };

        loadDetail();
    }, [editId, isEditMode]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    // Calculations
    const total = useMemo(() => {
        return items.reduce((acc, item) => acc + (Number(parseNumber(item.price) || 0) * Number(item.qty || 0)), 0);
    }, [items]);

    const totalSplitAmount = useMemo(() => {
        return payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);
    }, [payments]);

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now() + Math.random(), spare_part_id: 0, name: '', qty: '', price: '' }
        ]);
    };

    const handleRemoveItem = (id: number) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        if (field === 'price') {
            newItems[index] = { ...newItems[index], [field]: formatNumber(value) };
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        setItems(newItems);
    };

    const handleAddPaymentRow = () => {
        setPayments([...payments, { id: Date.now() + Math.random(), sumber: 'BENGKEL_TUNAI', nominal: '' }]);
    };

    const handleRemovePaymentRow = (id: number) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const handleUpdatePaymentRow = (id: number, field: string, value: string) => {
        const nextPayments = payments.map(p => {
            if (p.id === id) {
                return { ...p, [field]: field === 'nominal' ? formatNumber(value) : value };
            }
            return p;
        });
        setPayments(nextPayments);

        if (field === 'nominal') {
            const totalPaid = nextPayments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);
            setStatusBayar(totalPaid >= total ? 'LUNAS' : 'BELUM_LUNAS');
        }
    };

    const handleSelectPart = (part: any) => {
        if (activeItemIndex !== null) {
            const newItems = [...items];
            newItems[activeItemIndex] = {
                ...newItems[activeItemIndex],
                spare_part_id: part.id,
                name: part.nama,
                price: formatNumber(part.harga_beli.toString()), // Default to last buy price
                qty: '1'
            };
            setItems(newItems);
            setIsPartModalOpen(false);
            setActiveItemIndex(null);
            setPartSearchQuery('');
        }
    };

    const handleScanPart = (data: string) => {
        const cleanData = data.trim();
        const availableParts = spareParts || [];
        // Better logic: use the hook that fetches all for search but maybe we need a dedicated search by code.

        let part = availableParts.find((p: any) => p.kode === cleanData);
        if (!part) {
            const strippedData = cleanData.replace(/^0+/, '');
            part = availableParts.find((p: any) => (p.kode || '').replace(/^0+/, '') === strippedData);
        }

        if (part) {
            // Check if already in items
            const existingIndex = items.findIndex(i => i.spare_part_id === part.id);
            if (existingIndex !== -1) {
                const newItems = [...items];
                newItems[existingIndex].qty = (Number(newItems[existingIndex].qty) + 1).toString();
                setItems(newItems);
            } else {
                setItems([...items, {
                    id: Date.now() + Math.random(),
                    spare_part_id: part.id,
                    name: part.nama,
                    qty: '1',
                    price: formatNumber(part.harga_beli.toString())
                }]);
            }
            setIsScannerOpen(false);
        } else {
            setIsScannerOpen(false);
            alert(`Part dengan kode "${data}" tidak ditemukan.`);
        }
    };

    const handleSubmit = async () => {
        if (!selectedSupplier) {
            alert('Mohon pilih supplier terlebih dahulu');
            return;
        }
        if (items.length === 0 || items.some(i => !i.spare_part_id || !i.qty || Number(i.qty) <= 0)) {
            alert('Mohon lengkapi data barang dengan jumlah yang valid (> 0)');
            return;
        }

        if (!isSplitPayment && !metodeBayar) {
            alert('Mohon pilih metode pembayaran');
            return;
        }

        const payload = {
            tanggal: tanggal.toISOString().split('T')[0],
            supplier_id: selectedSupplier.id,
            nomor_faktur: nomorFaktur || '-', // Optional
            catatan: catatan,
            status_bayar: isSplitPayment ? (totalSplitAmount >= total ? 'LUNAS' : 'BELUM_LUNAS') : statusBayar,
            metode_bayar: isSplitPayment ? 'SPLIT' : (metodeBayar === 'KREDIT' ? 'KREDIT' : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').metode),
            kas_jenis: isSplitPayment ? undefined : (metodeBayar === 'KREDIT' ? undefined : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').kas_jenis),
            payments: isSplitPayment ? payments.map(p => ({
                metode: getPaymentDetails(p.sumber).metode,
                jumlah: parseNumber(p.nominal),
                kas_jenis: getPaymentDetails(p.sumber).kas_jenis
            })).filter(p => p.jumlah > 0) : [
                {
                    metode: metodeBayar === 'KREDIT' ? 'KREDIT' : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').metode,
                    jumlah: statusBayar === 'LUNAS' ? total : parseNumber(payments[0]?.nominal || '0'),
                    kas_jenis: metodeBayar === 'KREDIT' ? undefined : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').kas_jenis
                }
            ],
            diskon: 0,
            detail: items.map(item => ({
                spare_part_id: item.spare_part_id,
                qty: Number(item.qty),
                harga_satuan: Number(parseNumber(item.price))
            }))
        };

        // Check online status via TanStack Query's onlineManager
        const isOnline = onlineManager.isOnline();

        if (!isOnline) {
            // Mode Offline: Fire and forget (it will be queued in TanStack Query)
            createPembelianMutation.mutate(payload);
            alert('Mode Offline: Transaksi telah disimpan di antrian. Data akan disinkronkan otomatis saat Anda terhubung ke internet kembali.');
            handleBack();
            return;
        }

        try {
            if (isEditMode && editId) {
                await updatePembelianMutation.mutateAsync({ id: editId, data: payload });
            } else {
                await createPembelianMutation.mutateAsync(payload);
            }
            handleBack();
        } catch (error: any) {
            console.error(error);
            const errorDetail = error.response?.data?.detail;
            const message = typeof errorDetail === 'string' ? errorDetail : 'Gagal menyimpan transaksi pembelian. Pastikan semua data valid dan saldo mencukupi.';
            alert(message);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center border-b border-gray-100 bg-white">
                <Pressable onPress={handleBack} className="mr-4">
                    <ChevronLeft size={24} color="#1C1C1C" />
                </Pressable>
                <Typography variant="h2" weight="bold">{isEditMode ? 'Edit Restock' : 'Restock (Pembelian)'}</Typography>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {isLoadingDetail && (
                    <View className="py-10 items-center justify-center">
                        <ActivityIndicator color="#023C69" />
                        <Typography className="text-gray-500 mt-3">Memuat data pembelian...</Typography>
                    </View>
                )}
                {/* Supplier Info */}
                <Card variant="outlined" className="p-4 mb-6 border-gray-100 bg-gray-50/30">
                    <MasterDataSelector
                        type="supplier"
                        label="Informasi Supplier"
                        value={selectedSupplier}
                        onSelect={setSelectedSupplier}
                        placeholder="Pilih Supplier..."
                    />
                </Card>
                <Input
                    label="Nomor Faktur"
                    placeholder="INV/2024/001"
                    value={nomorFaktur}
                    onChangeText={setNomorFaktur}
                    containerClassName="mb-6"
                />

                <View className="mb-6">
                    <Typography variant="body2" className="text-textGray text-sm mb-1 font-medium">Tanggal Pembelian</Typography>
                    <Pressable className="bg-gray-100 rounded-xl px-4 h-[52px] justify-center border-2 border-transparent">
                        <View className="flex-row items-center">
                            <Calendar size={18} color="#767676" />
                            <Typography className="ml-2 font-medium">
                                {tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Typography>
                        </View>
                    </Pressable>
                </View>

                {/* Items List */}
                <View className="flex-row justify-between items-center mt-2 mb-4">
                    <View className="flex-row items-center">
                        <Package size={18} color="#023C69" />
                        <Typography weight="bold" className="ml-2 text-primary uppercase">Daftar Barang</Typography>
                    </View>
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={() => setIsScannerOpen(true)}
                            className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-xl mr-2 border border-blue-100"
                        >
                            <QrCode size={14} color="#2563EB" />
                            <Typography weight="bold" className="text-blue-700 text-[10px] ml-1.5 uppercase">Scan</Typography>
                        </Pressable>
                        <Pressable onPress={handleAddItem} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl">
                            <Plus size={14} color="#023C69" />
                            <Typography weight="bold" className="text-primary text-[10px] ml-1.5 uppercase">Tambah</Typography>
                        </Pressable>
                    </View>
                </View>

                {items.map((item, index) => (
                    <Card key={item.id} className="mb-4 p-4 border border-gray-100 shadow-sm">
                        <View className="flex-row justify-between items-start mb-3">
                            <Typography variant="caption" weight="bold" className="text-primary">ITEM #{index + 1}</Typography>
                            <Pressable onPress={() => handleRemoveItem(item.id)} className="bg-red-50 p-1.5 rounded-lg">
                                <Trash2 size={16} color="#EE2737" />
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => {
                                setActiveItemIndex(index);
                                setIsPartModalOpen(true);
                            }}
                        >
                            <View pointerEvents="none">
                                <Input
                                    label="Nama Barang"
                                    placeholder="Ketuk untuk cari sparepart..."
                                    value={item.name}
                                    editable={false}
                                    containerClassName="mb-3"
                                    endIcon={<Search size={18} color="#9CA3AF" />}
                                />
                            </View>
                        </Pressable>

                        <View className="flex-row space-x-3">
                            <Input
                                label="Qty"
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="flex-1"
                                value={item.qty}
                                onChangeText={(val) => handleUpdateItem(index, 'qty', val)}
                            />
                            <Input
                                label="Harga Beli (Satuan)"
                                placeholder="Rp 0"
                                keyboardType="numeric"
                                containerClassName="flex-[1.5]"
                                value={item.price}
                                onChangeText={(val) => handleUpdateItem(index, 'price', val)}
                            />
                        </View>

                        {/* Subtotal preview */}
                        <View className="flex-row justify-end mt-1">
                            <Typography variant="caption" className="text-gray-500">
                                Subtotal: {formatCurrency((Number(item.qty) || 0) * (Number(parseNumber(item.price)) || 0))}
                            </Typography>
                        </View>
                    </Card>
                ))}

                {items.length === 0 && (
                    <View className="items-center py-8 border-2 border-dashed border-gray-200 rounded-xl mb-6">
                        <Truck size={32} color="#D1D5DB" />
                        <Typography className="text-gray-400 mt-2">Belum ada barang dipilih</Typography>
                        <Pressable onPress={handleAddItem} className="mt-2">
                            <Typography weight="bold" className="text-primary">Tambah Barang</Typography>
                        </Pressable>
                    </View>
                )}

                {/* Metode Pembayaran */}
                <View className="mb-6 mt-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <Typography variant="body2" weight="bold" className="text-primary uppercase pr-1">Pembayaran</Typography>
                        <Pressable
                            onPress={() => setIsSplitPayment(!isSplitPayment)}
                            className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                        >
                            <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                            </Typography>
                        </Pressable>
                    </View>

                    {!isSplitPayment ? (
                        <View className="space-y-4">
                            {/* Row: Method */}
                            <View>
                                <Typography variant="caption" weight="bold" className="text-textGray mb-2 uppercase tracking-tight">Metode Pembayaran</Typography>
                                <View className="flex-row flex-wrap justify-between bg-gray-100 rounded-2xl p-1 border border-gray-200/50">
                                    {[
                                        { label: 'Tunai Bengkel', value: 'BENGKEL_TUNAI' },
                                        { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                        { label: 'Transfer', value: 'UTAMA_TRANSFER' },
                                        { label: 'Hutang Penuh', value: 'KREDIT' }
                                    ].map((m) => (
                                        <Pressable
                                            key={m.value}
                                            onPress={() => {
                                                setMetodeBayar(m.value);
                                                if (m.value === 'KREDIT') {
                                                    setStatusBayar('BELUM_LUNAS');
                                                    handleUpdatePaymentRow(payments[0].id, 'nominal', '0');
                                                } else {
                                                    // Default to Lunas if switching to Cash/Trf
                                                    setStatusBayar('LUNAS');
                                                    handleUpdatePaymentRow(payments[0].id, 'nominal', formatNumber(total.toString()));
                                                }
                                            }}
                                            className={`w-[48%] mb-1 py-3 rounded-xl items-center justify-center ${metodeBayar === m.value ? 'bg-white shadow-sm' : ''}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={`text-center ${metodeBayar === m.value ? 'text-primary' : 'text-gray-400'}`}>
                                                {m.label}
                                            </Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Row: Nominal if NOT full Hutang and NOT null */}
                            {metodeBayar && metodeBayar !== 'KREDIT' && (
                                <View className="bg-primary/5 border border-primary/10 p-4 rounded-[28px]">
                                    <View className="flex-row justify-between items-center mb-2 px-1">
                                        <Typography variant="caption" weight="bold" className="text-primary uppercase tracking-tight">Jumlah Bayar (Rp)</Typography>
                                        <Typography
                                            variant="caption"
                                            weight="bold"
                                            className={parseNumber(payments[0]?.nominal || '0') >= total ? "text-emerald-600" : "text-amber-600"}
                                        >
                                            {parseNumber(payments[0]?.nominal || '0') >= total ? "Lunas" : "Titip / DP"}
                                        </Typography>
                                    </View>
                                    <Input
                                        placeholder="0"
                                        keyboardType="numeric"
                                        containerClassName="mb-1"
                                        className="h-12 text-lg border-primary/20 bg-white"
                                        value={payments[0]?.nominal || ''}
                                        onChangeText={(v) => {
                                            const nominal = parseNumber(v);
                                            handleUpdatePaymentRow(payments[0].id, 'nominal', v);
                                            setStatusBayar(nominal >= total ? 'LUNAS' : 'BELUM_LUNAS');
                                        }}
                                    />
                                    {parseNumber(payments[0]?.nominal || '0') < total && (
                                        <Typography variant="caption" className="text-amber-600 italic mt-1 px-1">
                                            * Sisa {formatCurrency(Math.max(0, total - parseNumber(payments[0]?.nominal || '0')))} akan dicatat sebagai <Typography weight="bold">Hutang</Typography>.
                                        </Typography>
                                    )}
                                </View>
                            )}

                            {/* Feedback if full Hutang */}
                            {metodeBayar === 'KREDIT' && (
                                <View className="bg-amber-50/50 border border-amber-100 p-5 rounded-[28px] flex-row items-center">
                                    <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-4">
                                        <Package size={20} color="#D97706" />
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="caption" weight="bold" className="text-amber-800 uppercase tracking-widest text-[10px] mb-1">Status: HUTANG PENUH</Typography>
                                        <Typography variant="body2" className="text-amber-700 font-medium">
                                            Transaksi dicatat sebagai hutang sebesar {formatCurrency(total)}.
                                        </Typography>
                                    </View>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View className="space-y-3">
                            {payments.map((p, idx) => (
                                <View key={p.id} className="flex-col mb-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                    {idx === 0 && <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Metode & Akun</Typography>}
                                    <View className="flex-row flex-wrap bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
                                        {[
                                            { label: 'Tunai Bengkel', value: 'BENGKEL_TUNAI' },
                                            { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                            { label: 'Transfer Utama', value: 'UTAMA_TRANSFER' }
                                        ].map((m) => (
                                            <Pressable
                                                key={m.value}
                                                onPress={() => handleUpdatePaymentRow(p.id, 'sumber', m.value)}
                                                className={`flex-1 min-w-[30%] py-2 items-center justify-center border-r border-gray-100 ${p.sumber === m.value ? 'bg-primary' : 'bg-transparent'}`}
                                            >
                                                <Typography weight="bold" className={`text-[9px] ${p.sumber === m.value ? 'text-white' : 'text-textGray'}`}>{m.label}</Typography>
                                            </Pressable>
                                        ))}
                                    </View>
                                    <View className="flex-row items-center space-x-2">
                                        <View className="flex-1">
                                            {idx === 0 && <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Nominal (Rp)</Typography>}
                                            <Input
                                                placeholder="0"
                                                keyboardType="numeric"
                                                containerClassName="mb-0"
                                                className="h-10 text-sm"
                                                value={p.nominal}
                                                onChangeText={(v) => handleUpdatePaymentRow(p.id, 'nominal', v)}
                                            />
                                        </View>
                                        <Pressable
                                            onPress={() => handleRemovePaymentRow(p.id)}
                                            className="h-10 w-10 items-center justify-center bg-rose-50 rounded-xl"
                                        >
                                            <Trash2 size={16} color="#F43F5E" />
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
                            <Pressable
                                onPress={handleAddPaymentRow}
                                className="flex-row items-center justify-center py-2.5 bg-white border border-dashed border-primary/30 rounded-xl mt-1"
                            >
                                <Plus size={14} color="#023C69" />
                                <Typography weight="bold" className="text-primary text-[10px] ml-1.5 uppercase">Tambah Metode</Typography>
                            </Pressable>

                            <View className="flex-row justify-between items-center p-4 bg-primary/5 rounded-2xl border border-primary/10 mt-2">
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-primary text-[10px]">TOTAL TERBAYAR</Typography>
                                    <Typography weight="bold" className="text-primary text-lg">{formatCurrency(totalSplitAmount)}</Typography>
                                </View>
                                <View className="items-end">
                                    {totalSplitAmount < total ? (
                                        <>
                                            <Typography variant="caption" weight="bold" className="text-amber-600 text-[10px]">SISA HUTANG</Typography>
                                            <Typography weight="bold" className="text-amber-600 text-lg">{formatCurrency(total - totalSplitAmount)}</Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="caption" weight="bold" className="text-emerald-600 text-[10px]">STATUS</Typography>
                                            <Typography weight="bold" className="text-emerald-600 text-lg">LUNAS</Typography>
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                <Input
                    label="Catatan (Opsional)"
                    placeholder="Contoh: Pengiriman via JNE"
                    value={catatan}
                    onChangeText={setCatatan}
                    multiline
                    numberOfLines={2}
                    containerClassName="mt-2"
                />

                {/* Summary */}
                <View className="mt-6 mb-10">
                    <Card className="bg-primary/5 border border-primary/10 p-5 rounded-2xl">
                        <View className="flex-row justify-between items-center">
                            <Typography variant="h3" weight="bold">Total Pembelian</Typography>
                            <Typography variant="h2" weight="bold" className="text-primary">
                                {formatCurrency(total)}
                            </Typography>
                        </View>
                    </Card>
                </View>

                <Button
                    title={isEditMode ? 'Simpan Perubahan' : 'Simpan Pembelian'}
                    onPress={handleSubmit}
                    className="mb-10 rounded-xl"
                    loading={createPembelianMutation.isPending || updatePembelianMutation.isPending}
                />
            </ScrollView>

            {/* Part Selection Modal */}
            <Modal
                visible={isPartModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsPartModalOpen(false)}
                statusBarTranslucent
            >
                <View className="flex-1 justify-end bg-black/50">
                    <Pressable style={{ flex: 1 }} onPress={() => setIsPartModalOpen(false)} />
                    <View className="bg-white rounded-t-[32px] h-[85%] overflow-hidden">
                        <View className="p-6 flex-1">
                            <View className="items-center mb-2">
                                <View className="w-10 h-1 bg-gray-300 rounded-full" />
                            </View>
                            <View className="flex-row justify-between items-center mb-4">
                                <Typography variant="h3" weight="bold">Pilih Sparepart</Typography>
                                <Pressable onPress={() => setIsPartModalOpen(false)}>
                                    <X size={24} color="#6B7280" />
                                </Pressable>
                            </View>

                            <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                                <Search size={20} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-text font-outfit"
                                    placeholder="Cari sparepart..."
                                    value={partSearchQuery}
                                    onChangeText={setPartSearchQuery}
                                    autoFocus
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {isLoadingParts ? (
                                <ActivityIndicator color="#023C69" className="mt-4" />
                            ) : (
                                <FlatList
                                    data={spareParts}
                                    keyExtractor={(item: any) => item.id.toString()}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }: { item: any }) => (
                                        <Pressable
                                            onPress={() => handleSelectPart(item)}
                                            className="mb-3"
                                        >
                                            <Card className="p-4 border border-gray-100 flex-row items-center justify-between">
                                                <View>
                                                    <Typography weight="semibold">{item.nama}</Typography>
                                                    <Typography variant="caption" className="text-gray-500">
                                                        Stok: {item.stok} {item.satuan || 'pcs'} • {item.kode}
                                                    </Typography>
                                                </View>
                                                <View className="items-end">
                                                    <Typography weight="bold" className="text-primary">
                                                        {formatCurrency(item.harga_beli)}
                                                    </Typography>
                                                    <Typography variant="caption" className="text-gray-400">Harga Beli</Typography>
                                                </View>
                                            </Card>
                                        </Pressable>
                                    )}
                                    ListEmptyComponent={
                                        <Typography className="text-center text-gray-500 mt-4">
                                            {partSearchQuery ? 'Data tidak ditemukan' : 'Mulai ketik untuk mencari'}
                                        </Typography>
                                    }
                                />
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            <BarcodeScannerModal
                visible={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanPart}
            />
        </SafeAreaView >
    );
}
