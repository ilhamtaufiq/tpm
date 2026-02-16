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
    X
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
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
    const [metodeBayar, setMetodeBayar] = useState('tunai');

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
        if (items.length === 0 || items.some(i => !i.spare_part_id)) {
            alert('Mohon lengkapi data barang');
            return;
        }

        const payload = {
            tanggal: tanggal.toISOString().split('T')[0],
            supplier_id: selectedSupplier.id,
            nomor_faktur: nomorFaktur || '-', // Optional
            catatan: catatan,
            metode_bayar: metodeBayar,
            diskon: 0,
            detail: items.map(item => ({
                spare_part_id: item.spare_part_id,
                qty: Number(item.qty),
                harga_satuan: Number(parseNumber(item.price))
            }))
        };

        try {
            await createPembelianMutation.mutateAsync(payload);
            queryClient.invalidateQueries({ queryKey: ['spare_parts'] }); // Refresh stock
            router.back();
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan transaksi pembelian');
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
                    <Typography variant="body2" className="text-textGray text-sm mb-2 font-medium">Metode Pembayaran *</Typography>
                    <View className="flex-row space-x-2">
                        {[
                            { id: 'tunai', label: 'Tunai' },
                            { id: 'transfer', label: 'Transfer' },
                            { id: 'kredit', label: 'Hutang' }
                        ].map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => setMetodeBayar(m.id)}
                                className={`flex-1 py-3 items-center rounded-xl border-2 ${metodeBayar === m.id ? 'border-primary bg-primary/5' : 'border-gray-100'}`}
                            >
                                <Typography
                                    className={metodeBayar === m.id ? 'text-primary' : 'text-gray-400'}
                                    weight={metodeBayar === m.id ? 'bold' : 'medium'}
                                >
                                    {m.label}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Items List */}
                <View className="flex-row justify-between items-center mt-2 mb-4">
                    <Typography variant="body2" weight="bold">Daftar Barang</Typography>
                    <TouchableOpacity onPress={handleAddItem} className="flex-row items-center bg-green-50 px-3 py-1.5 rounded-full">
                        <Plus size={16} color="#023C69" />
                        <Typography className="text-primary text-xs ml-1 font-bold">Tambah Item</Typography>
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
