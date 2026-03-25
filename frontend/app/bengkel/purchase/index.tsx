import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Modal, FlatList, ActivityIndicator } from 'react-native';
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
import { useRouter } from 'expo-router';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { MasterDataSelector } from '../../../components/ui/MasterDataSelector';
import { useCreatePembelianParts, useSparePartsList } from '../../../hooks/useBengkel';
import { formatNumber, parseNumber, formatCurrency } from '../../../utils/format';

export default function PurchaseScreen() {
    const router = useRouter(); const queryClient = useQueryClient();

    // Form State
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [nomorFaktur, setNomorFaktur] = useState('');
    const [tanggal, setTanggal] = useState(new Date());
    const [items, setItems] = useState<any[]>([]);
    const [catatan, setCatatan] = useState('');
    const [statusBayar, setStatusBayar] = useState('LUNAS');
    const [metodeBayar, setMetodeBayar] = useState<string | null>(null);
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string }[]>([
        { id: Date.now(), metode: 'TUNAI', nominal: '' }
    ]);

    // Modal State
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [partSearchQuery, setPartSearchQuery] = useState('');
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null); // Track which item row triggered the modal

    // API Hooks
    const createPembelianMutation = useCreatePembelianParts();
    const { data: partsData, isLoading: isLoadingParts } = useSparePartsList({ search: partSearchQuery });
    const spareParts = partsData?.data || [];

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
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
            { id: Date.now(), spare_part_id: 0, name: '', qty: '', price: '' }
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
        setPayments([...payments, { id: Date.now(), metode: 'TUNAI', nominal: '' }]);
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
            metode_bayar: isSplitPayment ? 'SPLIT' : (metodeBayar || 'TUNAI').toUpperCase(),
            payments: isSplitPayment ? payments.map(p => ({
                metode: p.metode,
                jumlah: parseNumber(p.nominal)
            })).filter(p => p.jumlah > 0) : [
                { metode: (metodeBayar || 'TUNAI').toUpperCase(), jumlah: statusBayar === 'LUNAS' ? total : parseNumber(payments[0]?.nominal || '0') }
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
            await createPembelianMutation.mutateAsync(payload);
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
                <TouchableOpacity onPress={handleBack} className="mr-4">
                    <ChevronLeft size={24} color="#1C1C1C" />
                </TouchableOpacity>
                <Typography variant="h2" weight="bold">Restock (Pembelian)</Typography>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
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
                <View className="flex-row space-x-3 mb-6">
                    <Input
                        label="Nomor Faktur"
                        placeholder="INV/2024/001"
                        containerClassName="flex-1"
                        value={nomorFaktur}
                        onChangeText={setNomorFaktur}
                    />
                    <View className="flex-1">
                        <Typography variant="body2" className="text-textGray text-sm mb-1 font-medium">Tanggal</Typography>
                        <TouchableOpacity className="bg-gray-100 rounded-xl px-4 h-[52px] justify-center border-2 border-transparent">
                            <View className="flex-row items-center">
                                <Calendar size={18} color="#767676" />
                                <Typography className="ml-2 font-medium">
                                    {tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </Typography>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Metode Pembayaran */}
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <Typography variant="body2" weight="bold" className="text-primary uppercase pr-1">Pembayaran</Typography>
                        <TouchableOpacity
                            onPress={() => setIsSplitPayment(!isSplitPayment)}
                            className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                        >
                            <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {!isSplitPayment ? (
                        <View className="space-y-4">
                            {/* Row: Method */}
                            <View>
                                <Typography variant="caption" weight="bold" className="text-textGray mb-2 uppercase tracking-tight">Metode Pembayaran</Typography>
                                <View className="flex-row bg-gray-100 rounded-2xl p-1 border border-gray-200/50 space-x-1">
                                    {[
                                        { label: 'Cash', value: 'TUNAI' },
                                        { label: 'Trf', value: 'TRANSFER' },
                                        { label: 'Hutang Penuh', value: 'KREDIT' }
                                    ].map((m) => (
                                        <TouchableOpacity
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
                                            className={`flex-1 py-3 rounded-xl items-center justify-center ${metodeBayar === m.value ? 'bg-white shadow-sm' : ''}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={`text-center ${metodeBayar === m.value ? 'text-primary' : 'text-gray-400'}`}>
                                                {m.label}
                                            </Typography>
                                        </TouchableOpacity>
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
                                <View key={p.id} className="flex-row space-x-3 items-end mb-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                    <View className="flex-1">
                                        {idx === 0 && <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Metode</Typography>}
                                        <View className="flex-row bg-white border border-gray-200 rounded-xl overflow-hidden h-10">
                                            {['TUNAI', 'TRANSFER'].map((m) => {
                                                const label = m === 'TRANSFER' ? 'Trf' : 'Cash';
                                                return (
                                                    <TouchableOpacity
                                                        key={m}
                                                        onPress={() => handleUpdatePaymentRow(p.id, 'metode', m)}
                                                        className={`flex-1 items-center justify-center ${p.metode === m ? 'bg-primary' : 'bg-transparent'}`}
                                                    >
                                                        <Typography weight="bold" className={`text-[9px] ${p.metode === m ? 'text-white' : 'text-textGray'}`}>{label}</Typography>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                    <View className="flex-[1.5]">
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
                                    <TouchableOpacity
                                        onPress={() => handleRemovePaymentRow(p.id)}
                                        className="h-10 w-8 items-center justify-center bg-rose-50 rounded-xl"
                                    >
                                        <Trash2 size={14} color="#F43F5E" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                onPress={handleAddPaymentRow}
                                className="flex-row items-center justify-center py-2.5 bg-white border border-dashed border-primary/30 rounded-xl mt-1"
                            >
                                <Plus size={14} color="#023C69" />
                                <Typography weight="bold" className="text-primary text-[10px] ml-1.5 uppercase">Tambah Metode</Typography>
                            </TouchableOpacity>

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

                {/* Items List */}
                <View className="flex-row justify-between items-center mt-2 mb-4">
                    <View className="flex-row items-center">
                        <Package size={18} color="#023C69" />
                        <Typography weight="bold" className="ml-2 text-primary uppercase">Daftar Barang</Typography>
                    </View>
                    <TouchableOpacity onPress={handleAddItem} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl">
                        <Plus size={14} color="#023C69" />
                        <Typography weight="bold" className="text-primary text-[10px] ml-1.5 uppercase">Tambah</Typography>
                    </TouchableOpacity>
                </View>

                {items.map((item, index) => (
                    <Card key={item.id} className="mb-4 p-4 border border-gray-100 shadow-sm">
                        <View className="flex-row justify-between items-start mb-3">
                            <Typography variant="caption" weight="bold" className="text-primary">ITEM #{index + 1}</Typography>
                            <TouchableOpacity onPress={() => handleRemoveItem(item.id)} className="bg-red-50 p-1.5 rounded-lg">
                                <Trash2 size={16} color="#EE2737" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
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
                        </TouchableOpacity>

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
                        <TouchableOpacity onPress={handleAddItem} className="mt-2">
                            <Typography weight="bold" className="text-primary">Tambah Barang</Typography>
                        </TouchableOpacity>
                    </View>
                )}

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
                    title="Simpan Pembelian"
                    onPress={handleSubmit}
                    className="mb-10 rounded-xl"
                    loading={createPembelianMutation.isPending}
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
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsPartModalOpen(false)} activeOpacity={1} />
                    <View className="bg-white rounded-t-[32px] h-[85%] overflow-hidden">
                        <View className="p-6 flex-1">
                            <View className="items-center mb-2">
                                <View className="w-10 h-1 bg-gray-300 rounded-full" />
                            </View>
                            <View className="flex-row justify-between items-center mb-4">
                                <Typography variant="h3" weight="bold">Pilih Sparepart</Typography>
                                <TouchableOpacity onPress={() => setIsPartModalOpen(false)}>
                                    <X size={24} color="#6B7280" />
                                </TouchableOpacity>
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
                                        <TouchableOpacity
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
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        <Typography className="text-center text-gray-500 mt-4">
                                            {partSearchQuery ? 'Barang tidak ditemukan' : 'Mulai ketik untuk mencari'}
                                        </Typography>
                                    }
                                />
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}
