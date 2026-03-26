import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import {
    ChevronLeft,
    Search,
    Plus,
    AlertTriangle,
    Package,
    ArrowUpDown,
    Filter,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSparePartsList, useLowStockParts, useUpdateSparePart } from '../../../hooks/useBengkel';
import { SkeletonCard, SkeletonListItem } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RefreshControl as RNRefreshControl } from 'react-native';
import { formatCurrency } from '../../../utils/format';
import { BaseModal } from '../../../components/ui/BaseModal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import QRCode from 'react-native-qrcode-svg';
import { Barcode } from '../../../components/ui/Barcode';

const PARTS = [
    { id: '1', nama: 'Oli MPX 2 0.8L', kode: 'OL-001', stok: 2, stok_minimum: 5, price: 'Rp 65.000', category: 'Pelumas' },
    { id: '2', nama: 'Busi Honda Genio', kode: 'BS-042', stok: 15, stok_minimum: 5, price: 'Rp 25.000', category: 'Elektrik' },
    { id: '3', nama: 'Kampas Rem Depan Vario', kode: 'KR-012', stok: 4, stok_minimum: 10, price: 'Rp 45.000', category: 'Rem' },
    { id: '4', nama: 'Van Belt Beat ESP', kode: 'VB-005', stok: 8, stok_minimum: 3, price: 'Rp 145.000', category: 'Transmisi' },
];

export default function InventoryScreen() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const [codeType, setCodeType] = useState<'QR' | 'BARCODE'>('QR');

    // Form State
    const [formData, setFormData] = useState({
        nama: '',
        kode: '',
        kategori: '',
        stok: '0',
        stok_minimum: '0',
        harga_jual: '0',
        satuan: ''
    });

    // API Hooks
    const { data: partsData, isLoading, refetch } = useSparePartsList({ search });
    const { data: lowStockData } = useLowStockParts();
    const updatePartMutation = useUpdateSparePart();

    const parts = Array.isArray(partsData) ? partsData : partsData?.data || partsData?.items || [];
    const lowStockCount = lowStockData?.length || 0;

    const handleOpenDetail = (part: any) => {
        setSelectedPart(part);
        setFormData({
            nama: part.nama || '',
            kode: part.kode || '',
            kategori: part.kategori || '',
            stok: String(part.stok || 0),
            stok_minimum: String(part.stok_minimum || 0),
            harga_jual: String(part.harga_jual || 0),
            satuan: part.satuan || ''
        });
        setIsModalVisible(true);
        setIsEditing(false);
        setShowCode(false);
        setCodeType('QR');
    };

    const handleUpdate = async () => {
        if (!selectedPart) return;

        try {
            await updatePartMutation.mutateAsync({
                id: selectedPart.id,
                data: {
                    ...formData,
                    stok: parseInt(formData.stok) || 0,
                    stok_minimum: parseInt(formData.stok_minimum) || 0,
                    harga_jual: parseFloat(formData.harga_jual) || 0
                }
            });
            Alert.alert('Sukses', 'Data sparepart berhasil diperbarui');
            setIsEditing(false);
            refetch();
        } catch (error) {
            Alert.alert('Error', 'Gagal memperbarui data sparepart');
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </TouchableOpacity>
                    <Typography variant="h2" weight="bold">Stok Sparepart</Typography>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/bengkel/purchase')}
                    className="bg-primary/10 px-3 py-1.5 rounded-full flex-row items-center"
                >
                    <Plus size={16} color="#023C69" />
                    <Typography className="text-primary text-xs font-bold ml-1">Restock</Typography>
                </TouchableOpacity>
            </View>

            <View className="p-6 pb-0">
                {/* Search & Filter */}
                <View className="flex-row items-center space-x-3 mb-6">
                    <View className="flex-1 flex-row items-center bg-gray-100 rounded-2xl px-4 h-12">
                        <Search size={20} color="#767676" />
                        <TextInput
                            placeholder="Cari nama atau kode part..."
                            className="flex-1 ml-2 text-text font-outfit"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity className="w-12 h-12 bg-gray-100 rounded-2xl items-center justify-center">
                        <Filter size={20} color="#1C1C1C" />
                    </TouchableOpacity>
                </View>

                {/* Low Stock Banner */}
                {lowStockCount > 0 && (
                    <Card className="bg-secondary/10 border border-secondary/20 p-4 mb-6 flex-row items-center">
                        <View className="bg-secondary p-2 rounded-full mr-4">
                            <AlertTriangle size={20} color="white" />
                        </View>
                        <View className="flex-1">
                            <Typography variant="body2" weight="bold" className="text-secondary">Peringatan Stok Menipis</Typography>
                            <Typography variant="caption" className="text-secondary/80">Ada {lowStockCount} item yang berada di bawah stok minimum.</Typography>
                        </View>
                    </Card>
                )}
            </View>

            <ScrollView
                className="flex-1 px-6"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : parts.length === 0 ? (
                    <EmptyState
                        title="Sparepart tidak ditemukan"
                        description={search ? `Tidak ada hasil for "${search}"` : "Belum ada item sparepart di database."}
                        icon={Package}
                    />
                ) : (
                    parts.map((part: any) => (
                        <Card key={part.id} className="mb-4 p-4 flex-row items-center">
                            <View className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center mr-4">
                                <Package size={24} color={part.stok < part.stok_minimum ? '#EE2737' : '#023C69'} />
                            </View>

                            <View className="flex-1">
                                <Typography variant="body2" weight="bold">{part.nama}</Typography>
                                <Typography variant="caption">{part.kode} • {part.kategori || 'Suku Cadang'}</Typography>

                                <View className="flex-row items-center mt-2">
                                    <Typography variant="caption" weight="bold">Stok: </Typography>
                                    <Typography
                                        variant="caption"
                                        weight="bold"
                                        className={part.stok < part.stok_minimum ? 'text-secondary' : 'text-primary'}
                                    >
                                        {part.stok} {part.satuan || 'Unit'}
                                    </Typography>
                                    <Typography variant="caption" className="text-gray-400 ml-1">(Min: {part.stok_minimum})</Typography>
                                </View>
                            </View>

                            <View className="items-end">
                                <Typography variant="body2" weight="bold">{formatCurrency(part.harga_jual)}</Typography>
                                <TouchableOpacity
                                    className="mt-2 bg-gray-50 px-2 py-1 rounded-md"
                                    onPress={() => handleOpenDetail(part)}
                                >
                                    <Typography className="text-primary text-[10px] font-bold">Detail</Typography>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>

            {/* Detail & Edit Modal */}
            <BaseModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                title={isEditing ? "Edit Sparepart" : "Detail Sparepart"}
                maxHeight="90%"
            >
                <View className="space-y-4">
                    {!showCode ? (
                        <>
                            <Input
                                label="Nama Sparepart"
                                value={formData.nama}
                                onChangeText={(text) => setFormData({ ...formData, nama: text })}
                                editable={isEditing}
                                placeholder="Contoh: Oli MPX 2"
                            />
                            <Input
                                label="Kode Part"
                                value={formData.kode}
                                onChangeText={(text) => setFormData({ ...formData, kode: text })}
                                editable={isEditing}
                                placeholder="Contoh: OL-001"
                            />
                            <Input
                                label="Kategori"
                                value={formData.kategori}
                                onChangeText={(text) => setFormData({ ...formData, kategori: text })}
                                editable={isEditing}
                                placeholder="Contoh: Pelumas"
                            />
                            <Input
                                label="Satuan"
                                value={formData.satuan}
                                onChangeText={(text) => setFormData({ ...formData, satuan: text })}
                                editable={isEditing}
                                placeholder="Contoh: Unit, Pcs, Liter"
                            />
                            <View className="flex-row" style={{ gap: 12 }}>
                                <View className="flex-1">
                                    <Input
                                        label="Stok"
                                        value={formData.stok}
                                        onChangeText={(text) => setFormData({ ...formData, stok: text })}
                                        editable={isEditing}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Input
                                        label="Stok Min."
                                        value={formData.stok_minimum}
                                        onChangeText={(text) => setFormData({ ...formData, stok_minimum: text })}
                                        editable={isEditing}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                            <Input
                                label="Harga Jual"
                                value={formData.harga_jual}
                                onChangeText={(text) => setFormData({ ...formData, harga_jual: text })}
                                editable={isEditing}
                                keyboardType="numeric"
                            />

                            <View className="mt-6">
                                {isEditing ? (
                                    <View className="space-y-3">
                                        <Button
                                            title="Simpan Perubahan"
                                            onPress={handleUpdate}
                                            loading={updatePartMutation.isPending}
                                        />
                                        <Button
                                            title="Batal"
                                            variant="outline"
                                            onPress={() => setIsEditing(false)}
                                        />
                                    </View>
                                ) : (
                                    <View className="space-y-3">
                                        <Button
                                            title="Edit Data"
                                            onPress={() => setIsEditing(true)}
                                        />
                                        <View className="flex-row" style={{ gap: 12 }}>
                                            <Button
                                                title="QR Code"
                                                variant="outline"
                                                className="flex-1"
                                                onPress={() => {
                                                    setCodeType('QR');
                                                    setShowCode(true);
                                                }}
                                                icon={<Typography className="mr-1">📱</Typography>}
                                            />
                                            <Button
                                                title="Barcode"
                                                variant="outline"
                                                className="flex-1"
                                                onPress={() => {
                                                    setCodeType('BARCODE');
                                                    setShowCode(true);
                                                }}
                                                icon={<Typography className="mr-1">📊</Typography>}
                                            />
                                        </View>
                                    </View>
                                )}
                            </View>
                        </>
                    ) : (
                        <View className="items-center py-6">
                            <Typography variant="h3" weight="bold" className="mb-2">{selectedPart?.nama}</Typography>
                            <Typography variant="body2" className="text-gray-500 mb-6">{selectedPart?.kode}</Typography>

                            <View className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-8">
                                {codeType === 'QR' ? (
                                    <QRCode
                                        value={selectedPart?.kode || ''}
                                        size={200}
                                        backgroundColor="white"
                                        color="black"
                                    />
                                ) : (
                                    <Barcode
                                        value={selectedPart?.kode || ''}
                                        width={250}
                                        height={100}
                                    />
                                )}
                            </View>

                            <Typography variant="caption" className="text-center text-gray-400 mb-10 px-10">
                                Gunakan {codeType.toLowerCase()} ini untuk pemindaian instan saat transaksi atau pengecekan stok.
                            </Typography>

                            <Button
                                title="Kembali ke Detail"
                                variant="outline"
                                className="w-full"
                                onPress={() => setShowCode(false)}
                            />
                        </View>
                    )}
                </View>
            </BaseModal>
        </SafeAreaView>
    );
}
