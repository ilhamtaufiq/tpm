import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Alert, RefreshControl as RNRefreshControl } from 'react-native';
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
    QrCode,
    Barcode as BarcodeIcon,
    Printer,
    Edit3
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSparePartsList, useLowStockParts, useUpdateSparePart } from '../../../hooks/useBengkel';
import { SkeletonCard, SkeletonListItem } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatCurrency } from '../../../utils/format';
import { BaseModal } from '../../../components/ui/BaseModal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import QRCode from 'react-native-qrcode-svg';
import { Barcode } from '../../../components/ui/Barcode';
import * as Print from 'expo-print';

export default function InventoryScreen() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const [codeType, setCodeType] = useState<'QR' | 'BARCODE'>('QR');
    const qrRef = React.useRef<any>(null);

    const handlePrint = async () => {
        if (!selectedPart) return;

        try {
            let imageSource = '';
            
            if (codeType === 'QR') {
                imageSource = `https://api.qrserver.com/v1/create-qr-code/?data=${selectedPart.kode}&size=300x300`;
            } else {
                imageSource = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${selectedPart.kode}&scale=3&rotate=N&includetext`;
            }

            const html = `
                <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                        <style>
                            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: 'Helvetica', sans-serif; margin: 0; padding: 20px; }
                            h1 { font-size: 32px; margin-bottom: 5px; text-align: center; }
                            p { font-size: 20px; color: #666; margin-bottom: 30px; }
                            img { max-width: 100%; height: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; }
                            .footer { margin-top: 40px; font-size: 12px; color: #aaa; }
                        </style>
                    </head>
                    <body>
                        <h1>${selectedPart.nama}</h1>
                        <p>${selectedPart.kode}</p>
                        <img src="${imageSource}" />
                        <div class="footer">TPM Inventory System Management</div>
                    </body>
                </html>
            `;

            await Print.printAsync({ html });
        } catch (error) {
            Alert.alert('Error', 'Gagal mencetak kode.');
        }
    };

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
                maxHeight="92%"
                containerClassName="p-0 border-0"
            >
                <View className="flex-1">
                    {!showCode ? (
                        <View className="space-y-4 px-1">
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
                            <View className="flex-row space-x-3">
                                <Input
                                    label="Kategori"
                                    value={formData.kategori}
                                    containerClassName="flex-1"
                                    onChangeText={(text) => setFormData({ ...formData, kategori: text })}
                                    editable={isEditing}
                                    placeholder="Pelumas"
                                />
                                <Input
                                    label="Satuan"
                                    value={formData.satuan}
                                    containerClassName="flex-[0.7]"
                                    onChangeText={(text) => setFormData({ ...formData, satuan: text })}
                                    editable={isEditing}
                                    placeholder="Unit"
                                />
                            </View>
                            <View className="flex-row space-x-3">
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
                                label="Harga Jual (Rp)"
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
                                            title="Ubah Data"
                                            variant="outline-neutral"
                                            className="bg-gray-100 border-0"
                                            onPress={() => setIsEditing(true)}
                                            icon={<Edit3 size={16} color="#4B5563" style={{ marginRight: 8 }} />}
                                        />
                                        <View className="flex-row space-x-3">
                                            <TouchableOpacity 
                                                onPress={() => { setCodeType('QR'); setShowCode(true); }}
                                                className="flex-1 bg-primary/5 border border-primary/10 rounded-2xl py-4 items-center justify-center"
                                            >
                                                <QrCode size={20} color="#023C69" />
                                                <Typography variant="caption" weight="bold" className="text-primary mt-1">QR Code</Typography>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => { setCodeType('BARCODE'); setShowCode(true); }}
                                                className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl py-4 items-center justify-center"
                                            >
                                                <BarcodeIcon size={20} color="#10B981" />
                                                <Typography variant="caption" weight="bold" className="text-emerald-600 mt-1">Barcode</Typography>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View className="items-center py-4">
                            <View className="mb-6 w-full px-2">
                                <Card className="bg-gray-50 border-gray-100 p-4 items-center rounded-3xl">
                                    <Typography variant="h3" weight="bold" className="text-center mb-1">{selectedPart?.nama}</Typography>
                                    <Typography variant="body2" className="text-gray-400 text-center font-bold tracking-widest">{selectedPart?.kode}</Typography>
                                </Card>
                            </View>

                            <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                                {codeType === 'QR' ? (
                                    <QRCode
                                        value={selectedPart?.kode || ''}
                                        size={220}
                                        backgroundColor="white"
                                        color="black"
                                        getRef={(ref) => (qrRef.current = ref)}
                                    />
                                ) : (
                                    <Barcode
                                        value={selectedPart?.kode || ''}
                                        width={260}
                                        height={120}
                                    />
                                )}
                            </View>

                            <Typography variant="caption" className="text-center text-gray-400 mb-8 px-6 leading-5">
                                Gunakan label ini pada kemasan fisik sparepart untuk memudahkan scan saat transaksi.
                            </Typography>

                            <View className="w-full space-y-3 px-1">
                                <Button
                                    title={`Cetak ${codeType}`}
                                    onPress={handlePrint}
                                    icon={<Printer size={20} color="white" style={{ marginRight: 8 }} />}
                                />
                                <Button
                                    title="Kembali ke Detail"
                                    variant="outline"
                                    className="border-gray-200"
                                    onPress={() => setShowCode(false)}
                                />
                            </View>
                        </View>
                    )}
                </View>
            </BaseModal>
        </SafeAreaView>
    );
}
