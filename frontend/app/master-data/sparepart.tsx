import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, FlatList, ActivityIndicator, Image, Platform, Modal, TextInput } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    Plus,
    Search,
    Edit2,
    Trash2,
    Package,
    Settings,
    X,
    FileUp,
    Sparkles,
    AlertTriangle,
    RefreshCw,
    QrCode,
    Barcode,
    Printer,
    Image as ImageIcon,
    Camera,
    Check,
    Circle,
    Download
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BarcodeScannerModal } from '../../components/ui/BarcodeScannerModal';
import { BaseModal } from '../../components/ui/BaseModal';
import {
    useSparePartsList,
    useCreateSparePart,
    useUpdateSparePart,
    useDeleteSparePart,
    useImportSpareParts,
    useNextSparePartKode,
    useDebounce,
    useUploadSparePartImage,
    useBulkDeleteSpareParts,
    useExportSpareParts
} from '../../hooks';
import { formatNumber, parseNumber } from '../../utils/format';
import { onlineManager } from '@tanstack/react-query';
import { Alert } from 'react-native';
import api, { FILE_URL } from '../../utils/api';

interface SparePartForm {
    id?: number;
    kode?: string;
    nama: string;
    kode_part: string;
    harga_beli: string;
    harga_jual: string;
    stok: string;
    stok_minimum: string;
    kategori: string;
    merek: string;
    satuan: string;
    lokasi_rak: string;
    catatan: string;
    gambar?: string;
    imageUri?: string;
}

const INITIAL_FORM: SparePartForm = {
    nama: '',
    kode_part: '',
    harga_beli: '',
    harga_jual: '',
    stok: '',
    stok_minimum: '5',
    kategori: 'Umum',
    merek: '',
    satuan: 'pcs',
    lokasi_rak: '',
    catatan: '',
};

export default function SparePartMasterScreen() {
    const router = useRouter();
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Queries
    const {
        data: sparePartsData,
        isLoading,
        refetch,
        isRefetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useSparePartsList({
        search: debouncedSearch,
        limit: 20
    });

    const sparePartsList = useMemo(() =>
        sparePartsData?.pages.flatMap((page: any) => page.data) || [],
        [sparePartsData]);

    // Stats Calculation
    const stats = useMemo(() => {
        // total should be from the first page's meta if possible, or total of all pages
        const totalCount = sparePartsData?.pages[0]?.total || 0;
        const lowStock = sparePartsList.filter((item: any) => item.stok !== 999 && item.stok <= item.stok_minimum).length;
        return { total: totalCount, lowStock };
    }, [sparePartsData, sparePartsList]);

    // Mutations
    const createMutation = useCreateSparePart();
    const updateMutation = useUpdateSparePart();
    const deleteMutation = useDeleteSparePart();
    const uploadImageMutation = useUploadSparePartImage();

    // Form State
    const [form, setForm] = useState<SparePartForm>(INITIAL_FORM);
    const [isEditing, setIsEditing] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerTarget, setScannerTarget] = useState<'kode' | 'kode_part'>('kode_part');
    const [isAlwaysReady, setIsAlwaysReady] = useState(false);
    const importMutation = useImportSpareParts();
    const { refetch: fetchNextKode } = useNextSparePartKode();

    const [isPrintModalVisible, setIsPrintModalVisible] = useState(false);
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const handleGenerateKode = async () => {
        try {
            const { data } = await fetchNextKode();
            if (data?.kode) setForm(prev => ({ ...prev, kode: data.kode }));
        } catch (error) {
            console.error('Failed to generate code:', error);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Izin Ditolak', 'Maaf, kami butuh izin galeri untuk mengunggah gambar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setForm(prev => ({ ...prev, imageUri: result.assets[0].uri }));
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Izin Ditolak', 'Maaf, kami butuh izin kamera untuk mengambil foto.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setForm(prev => ({ ...prev, imageUri: result.assets[0].uri }));
        }
    };

    const [sheetVisible, setSheetVisible] = useState(false);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['85%', '95%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/master-data');
        }
    };

    const handleOpenSheet = (item?: any) => {
        if (item) {
            setIsEditing(true);
            setForm({
                id: item.id,
                kode: item.kode,
                kode_part: item.kode_part || '',
                nama: item.nama,
                harga_beli: formatNumber(item.harga_beli.toString()),
                harga_jual: formatNumber(item.harga_jual.toString()),
                stok: (item.stok || 0).toString(),
                stok_minimum: (item.stok_minimum || 5).toString(),
                kategori: item.kategori || 'Umum',
                merek: item.merek || '',
                satuan: item.satuan || 'pcs',
                lokasi_rak: item.lokasi_rak || '',
                catatan: item.catatan || '',
                gambar: item.gambar,
            });
            setIsAlwaysReady(item.stok === 999);
        } else {
            setIsEditing(false);
            setForm(INITIAL_FORM);
            setIsAlwaysReady(false);
        }

        // Set visible for both platforms
        setSheetVisible(true);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = () => {
        setSheetVisible(false);
        setIsAlwaysReady(false);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        }

        setForm(INITIAL_FORM);
        setIsEditing(false);
    };

    const handleScanCode = (data: string) => {
        setForm(prev => ({ ...prev, [scannerTarget]: data }));
        setIsScannerOpen(false);
    };



    const handleSubmit = async () => {
        try {
            const payload = {
                ...form,
                harga_beli: parseNumber(form.harga_beli),
                harga_jual: parseNumber(form.harga_jual),
                stok: Number(form.stok),
                stok_minimum: Number(form.stok_minimum),
            };

            if (!onlineManager.isOnline()) {
                if (isEditing && form.id) {
                    updateMutation.mutate({ id: form.id, data: payload });
                } else {
                    createMutation.mutate(payload);
                }
                Alert.alert('Offline Mode', 'Data barang telah disimpan di antrean offline.');
                handleCloseSheet();
                return;
            }

            let savedPart;
            if (isEditing && form.id) {
                savedPart = await updateMutation.mutateAsync({ id: form.id, data: payload });
            } else {
                savedPart = await createMutation.mutateAsync(payload);
            }

            // Upload image if selected
            if (form.imageUri && (savedPart?.id || (isEditing && form.id))) {
                const targetId = savedPart?.id || form.id;
                const formData = new FormData();

                if (Platform.OS === 'web') {
                    const response = await fetch(form.imageUri);
                    const blob = await response.blob();
                    formData.append('file', blob, 'image.jpg');
                } else {
                    // @ts-ignore
                    formData.append('file', {
                        uri: form.imageUri,
                        name: 'image.jpg',
                        type: 'image/jpeg',
                    });
                }

                await uploadImageMutation.mutateAsync({ id: targetId!, formData });
            }

            handleCloseSheet();
        } catch (error) {
            console.error('Failed to save sparepart:', error);
            const msg = 'Gagal menyimpan data barang. Periksa kembali input Anda.';
            if (Platform.OS === 'web') {
                alert(msg);
            } else {
                Alert.alert('Error', msg);
            }
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = () => {
            if (!onlineManager.isOnline()) {
                deleteMutation.mutate(id);
                if (Platform.OS === 'web') {
                    alert('Barang telah dijadwalkan untuk dihapus saat online.');
                } else {
                    Alert.alert('Offline Mode', 'Barang telah dijadwalkan untuk dihapus saat online.');
                }
                return;
            }
            deleteMutation.mutate(id);
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                'Hapus Barang',
                'Apakah Anda yakin ingin menghapus barang ini?',
                [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Hapus', style: 'destructive', onPress: confirmDelete }
                ]
            );
        }
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            const formData = new FormData();

            if (Platform.OS === 'web') {
                // @ts-ignore
                formData.append('file', file.file);
            } else {
                // @ts-ignore
                formData.append('file', {
                    uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
                    name: file.name,
                    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
            }

            const response = await importMutation.mutateAsync(formData);

            if (Platform.OS === 'web') {
                alert(`Import Berhasil\nTotal: ${response.total}\nSukses: ${response.success}\nUpdate: ${response.updated}\nGagal: ${response.failed}${response.failed > 0 ? '\n\nDetail Error: ' + response.errors.slice(0, 5).join('\n') : ''}`);
            } else {
                Alert.alert(
                    'Import Berhasil',
                    `Total: ${response.total}\nSukses: ${response.success}\nUpdate: ${response.updated}\nGagal: ${response.failed}`,
                    response.failed > 0 ? [
                        {
                            text: 'Lihat Error',
                            onPress: () => Alert.alert('Detail Error', response.errors.slice(0, 5).join('\n') + (response.errors.length > 5 ? '\n...' : ''))
                        },
                        { text: 'OK' }
                    ] : undefined
                );
            }
        } catch (error) {
            console.error('Import failed:', error);
            if (Platform.OS === 'web') {
                alert('Terjadi kesalahan saat mengimpor data. Pastikan format file sesuai.');
            } else {
                Alert.alert('Gagal', 'Terjadi kesalahan saat mengimpor data. Pastikan format file sesuai.');
            }
        }
    };

    const handleBulkPrint = async (type: 'QR' | 'BARCODE') => {
        const listToPrint = selectedIds.length > 0
            ? sparePartsList.filter((item: any) => selectedIds.includes(item.id))
            : sparePartsList;

        if (!listToPrint || listToPrint.length === 0) {
            if (Platform.OS === 'web') {
                alert('Tidak ada data untuk dicetak.');
            } else {
                Alert.alert('Info', 'Tidak ada data untuk dicetak.');
            }
            return;
        }

        try {
            const itemsHtml = listToPrint.map((item: any) => {
                const imageSource = type === 'QR'
                    ? `https://api.qrserver.com/v1/create-qr-code/?data=${item.kode}&size=200x200`
                    : `https://bwipjs-api.metafloor.com/?bcid=code128&text=${item.kode}&scale=2&rotate=N&includetext`;

                return `
                    <div class="sticker">
                        <img src="${imageSource}" />
                        <div class="code-text">${item.kode_part || item.kode}</div>
                        <div class="name-text">${item.nama}</div>
                    </div>
                `;
            }).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Cetak Label Sparepart</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-wrap: wrap; gap: 15px; padding: 20px; background: white; margin: 0; }
                            .sticker { 
                                width: 140px; 
                                border: 1px solid #e2e8f0; 
                                border-radius: 12px;
                                padding: 12px; 
                                text-align: center; 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center;
                                page-break-inside: avoid;
                                margin-bottom: 10px;
                                background: white;
                            }
                            img { max-width: 100%; height: auto; }
                            .code-text { font-size: 10px; font-weight: bold; margin-top: 10px; color: #023C69; text-transform: uppercase; letter-spacing: 0.5px; }
                            .name-text { font-size: 11px; margin-top: 4px; font-weight: 600; color: #1e293b; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
                            @media print {
                                body { padding: 0; }
                                .sticker { border-color: #eee; }
                            }
                        </style>
                    </head>
                    <body>
                        ${itemsHtml}
                    </body>
                </html>
            `;

            if (Platform.OS === 'web') {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);

                const doc = iframe.contentWindow?.document || iframe.contentDocument;
                if (doc) {
                    // @ts-ignore - write exists on Document
                    doc.open();
                    // @ts-ignore - write exists on Document
                    doc.write(html);
                    // @ts-ignore - write exists on Document
                    doc.close();

                    // Give images a moment to start loading
                    setTimeout(() => {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 500);
                    }, 500);
                }
            } else {
                await Print.printAsync({ html });
            }
        } catch (error) {
            console.error('Print error:', error);
            Alert.alert('Error', 'Gagal mencetak label.');
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;

        const executeDelete = async () => {
            try {
                await bulkDeleteMutation.mutateAsync(selectedIds);
                setSelectedIds([]);
                if (Platform.OS === 'web') {
                    alert('Item berhasil dihapus.');
                } else {
                    Alert.alert('Sukses', 'Item berhasil dihapus.');
                }
            } catch (error) {
                if (Platform.OS === 'web') {
                    alert('Gagal menghapus item.');
                } else {
                    Alert.alert('Error', 'Gagal menghapus item.');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} item terpilih?`)) {
                executeDelete();
            }
        } else {
            Alert.alert(
                'Hapus Masal',
                `Apakah Anda yakin ingin menghapus ${selectedIds.length} item terpilih?`,
                [
                    { text: 'Batal', style: 'cancel' },
                    {
                        text: 'Hapus',
                        style: 'destructive',
                        onPress: executeDelete
                    }
                ]
            );
        }
    };

    const handleBulkExport = async () => {
        try {
            const data = await exportMutation.mutateAsync(selectedIds.length > 0 ? selectedIds : undefined);
            const filename = `spare_parts_export_${new Date().getTime()}.xlsx`;

            if (Platform.OS === 'web') {
                const url = window.URL.createObjectURL(new Blob([data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } else {
                Alert.alert('Export', 'Fitur download di mobile akan segera hadir. Gunakan format Web untuk export.');
            }
        } catch (error) {
            Alert.alert('Error', 'Gagal mengekspor data.');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === sparePartsList.length && sparePartsList.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sparePartsList.map((item: any) => item.id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const bulkDeleteMutation = useBulkDeleteSpareParts();
    const exportMutation = useExportSpareParts();

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
            />
        ),
        []
    );

    const renderItem = ({ item }: { item: any }) => {
        const isAlwaysReady = item.stok === 999;
        const isLowStock = !isAlwaysReady && item.stok <= item.stok_minimum;
        const imageUrl = item.gambar ? `${FILE_URL}/uploads/${item.gambar}` : null;
        const isSelected = selectedIds.includes(item.id);

        return (
            <View className="flex-row items-center space-x-3 mb-4">
                <Pressable
                    onPress={() => toggleSelect(item.id)}
                    className="p-1"
                >
                    {isSelected ? (
                        <View className="bg-primary rounded-lg p-1">
                            <Check size={16} color="white" />
                        </View>
                    ) : (
                        <Circle size={24} color="#CBD5E1" strokeWidth={1} />
                    )}
                </Pressable>

                <Pressable
                    onPress={() => handleOpenSheet(item)}
                    className="flex-1"
                >
                    <View className={`p-4 rounded-[28px] shadow-sm flex-row items-center ${isLowStock ? 'bg-red-50/50 border border-red-200' : 'bg-white border border-gray-100'}`}>
                        <View className={`w-20 h-20 rounded-2xl items-center justify-center mr-4 overflow-hidden border ${isLowStock ? 'bg-red-100 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                            {imageUrl ? (
                                <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Package size={28} color={isLowStock ? '#EF4444' : '#9CA3AF'} strokeWidth={1.5} />
                            )}
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-1">
                                <View className="flex-1 mr-2">
                                    <Typography variant="caption" weight="bold" className="text-primary/60 text-[10px] uppercase mb-0.5">{item.kode_part || item.kode}</Typography>
                                    <Typography variant="body1" weight="bold" className="text-textMain text-base" numberOfLines={1}>{item.nama}</Typography>
                                </View>
                                {isLowStock && (
                                    <View className="bg-red-100 px-2 py-1 rounded-lg flex-row items-center">
                                        <AlertTriangle size={10} color="#EF4444" className="mr-1" />
                                        <Typography className="text-red-600 text-[10px] font-bold uppercase">Stok Rendah</Typography>
                                    </View>
                                )}
                            </View>

                            <View className="flex-row items-center mb-1">
                                <Typography className="text-primary font-bold text-base mr-2">
                                    Rp {Number(item.harga_jual).toLocaleString('id-ID')}
                                </Typography>
                                <Typography className="text-gray-400 text-xs">/ {item.satuan}</Typography>
                            </View>

                            <View className="flex-row items-center pt-2 mt-2 border-t border-gray-100/50 border-dashed">
                                {isAlwaysReady ? (
                                    <Badge
                                        label="Always Ready"
                                        variant="infinity"
                                        className="mr-2 px-3"
                                    />
                                ) : (
                                    <Typography className="text-textGray text-xs font-semibold px-2 py-1 bg-gray-100 rounded-lg mr-2">
                                        Stok: {item.stok}
                                    </Typography>
                                )}
                                <Typography className="text-textGray/60 text-xs italic">
                                    Rak: {item.lokasi_rak || '-'}
                                </Typography>
                            </View>
                        </View>
                    </View>
                </Pressable>
            </View>
        );
    };

    const renderFormContent = () => (
        <View className="p-6 pb-12">
            <View className="flex-row justify-between items-center mb-6">
                <Typography variant="h2" weight="bold">
                    {isEditing ? 'Edit Sparepart' : 'Tambah Sparepart'}
                </Typography>
                <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                    <X size={20} color="#6B7280" />
                </Pressable>
            </View>

            <View className="space-y-5">
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Foto Barang</Typography>
                    <View className="flex-row items-center space-x-4">
                        <View className="w-24 h-24 bg-gray-50 border border-gray-100 rounded-2xl items-center justify-center overflow-hidden">
                            {(form.imageUri || form.gambar) ? (
                                <Image
                                    key={form.imageUri || form.gambar}
                                    source={{ uri: form.imageUri || (form.gambar ? `${FILE_URL}/uploads/${form.gambar}` : undefined) }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="items-center justify-center">
                                    <ImageIcon size={32} color="#9CA3AF" strokeWidth={1.5} />
                                    <Typography className="text-[8px] text-gray-400 mt-1">Kosong</Typography>
                                </View>
                            )}
                        </View>
                        <View className="flex-1 space-y-2">
                            <Pressable
                                onPress={pickImage}
                                className="flex-row items-center bg-white border border-indigo-100 rounded-xl px-3 py-2.5 active:bg-indigo-50"
                            >
                                <ImageIcon size={16} color="#4F46E5" />
                                <Typography className="text-indigo-600 font-bold text-xs ml-2">Pilih Galeri</Typography>
                            </Pressable>
                            <Pressable
                                onPress={takePhoto}
                                className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 active:bg-gray-50"
                            >
                                <Camera size={16} color="#6B7280" />
                                <Typography className="text-gray-600 font-bold text-xs ml-2">Ambil Foto</Typography>
                            </Pressable>
                        </View>
                    </View>
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Identitas Barang</Typography>
                    <View className="space-y-3">
                        <View className="flex-row items-center space-x-3">
                            <View className="flex-1">
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                    placeholder="Kode Part (OEM / Pabrik)"
                                    placeholderTextColor="#9CA3AF"
                                    value={form.kode_part}
                                    onChangeText={(t) => setForm({ ...form, kode_part: t })}
                                />
                            </View>
                            <Pressable
                                onPress={() => { setScannerTarget('kode_part'); setIsScannerOpen(true); }}
                                className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl items-center justify-center"
                            >
                                <QrCode size={20} color="#4F46E5" />
                            </Pressable>
                        </View>

                        <View className="flex-row items-center space-x-3">
                            <View className="flex-1">
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 text-xs italic"
                                    placeholder="ID Stok (Internal SKU)"
                                    placeholderTextColor="#9CA3AF"
                                    value={form.kode}
                                    onChangeText={(t) => setForm({ ...form, kode: t })}
                                    readOnly={isEditing}
                                />
                            </View>
                            {!isEditing && (
                                <View className="flex-row space-x-2">
                                    <Pressable
                                        onPress={handleGenerateKode}
                                        className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-xl items-center justify-center"
                                    >
                                        <Sparkles size={20} color="#D97706" />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => { setScannerTarget('kode'); setIsScannerOpen(true); }}
                                        className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-xl items-center justify-center"
                                    >
                                        <QrCode size={20} color="#6B7280" />
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Barang *</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                        placeholder="Contoh: Oli Yamalube"
                        placeholderTextColor="#9CA3AF"
                        value={form.nama}
                        onChangeText={(t) => setForm({ ...form, nama: t })}
                    />
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Beli</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.harga_beli}
                            onChangeText={(t) => setForm({ ...form, harga_beli: formatNumber(t) })}
                        />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Jual</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.harga_jual}
                            onChangeText={(t) => setForm({ ...form, harga_jual: formatNumber(t) })}
                        />
                    </View>
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <View className="flex-row justify-between items-center mb-2">
                            <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Stok Awal</Typography>
                            <Pressable 
                                onPress={() => {
                                    const newValue = !isAlwaysReady;
                                    setIsAlwaysReady(newValue);
                                    if (newValue) {
                                        setForm(prev => ({ ...prev, stok: '999' }));
                                    }
                                }}
                                className="flex-row items-center"
                            >
                                <View className={`w-4 h-4 rounded border items-center justify-center mr-1.5 ${isAlwaysReady ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                    {isAlwaysReady && <Check size={10} color="white" />}
                                </View>
                                <Typography className={`text-[10px] font-bold ${isAlwaysReady ? 'text-primary' : 'text-textGray'}`}>Always Ready</Typography>
                            </Pressable>
                        </View>
                        <TextInput
                            className={`bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 ${isAlwaysReady ? 'opacity-50' : ''}`}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.stok}
                            onChangeText={(t) => setForm({ ...form, stok: t })}
                            editable={!isAlwaysReady}
                        />
                        {isAlwaysReady && (
                            <Typography className="text-[8px] text-indigo-500 mt-1 italic font-bold">
                                * Mode Always Ready: Stok diset ke 999 dan tidak akan berkurang.
                            </Typography>
                        )}
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Min. Stok</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="5"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.stok_minimum}
                            onChangeText={(t) => setForm({ ...form, stok_minimum: t })}
                        />
                    </View>
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Satuan</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="pcs"
                            placeholderTextColor="#9CA3AF"
                            value={form.satuan}
                            onChangeText={(t) => setForm({ ...form, satuan: t })}
                        />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kategori</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Umum"
                            placeholderTextColor="#9CA3AF"
                            value={form.kategori}
                            onChangeText={(t) => setForm({ ...form, kategori: t })}
                        />
                    </View>
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Lokasi Rak (Opsional)</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                        placeholder="Contoh: Rak A-1"
                        placeholderTextColor="#9CA3AF"
                        value={form.lokasi_rak}
                        onChangeText={(t) => setForm({ ...form, lokasi_rak: t })}
                    />
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Catatan (Opsional)</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[80px]"
                        placeholder="Keterangan tambahan..."
                        placeholderTextColor="#9CA3AF"
                        value={form.catatan}
                        onChangeText={(t) => setForm({ ...form, catatan: t })}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                <View className="flex-col space-y-3 mt-4">
                    <Button
                        title={isEditing ? "Simpan Perubahan" : "Simpan Barang"}
                        onPress={handleSubmit}
                        loading={createMutation.isPending || updateMutation.isPending}
                        className="shadow-lg shadow-primary/30"
                        size="lg"
                    />
                    {isEditing && (
                        <Button
                            title="Hapus Barang"
                            variant="danger"
                            onPress={() => {
                                if (form.id) handleDelete(form.id);
                                handleCloseSheet();
                            }}
                            className="mt-2"
                        />
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-20 px-6 rounded-b-[48px] shadow-2xl z-0">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tight">Sparepart</Typography>
                            <Typography className="text-white/60 text-xs font-medium">Manajemen Stok & Harga</Typography>
                        </View>
                    </View>
                    <View className="flex-row space-x-3">
                        <Pressable
                            onPress={() => setIsImportModalVisible(true)}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            <FileUp size={20} color="white" />
                        </Pressable>
                        <Pressable
                            onPress={() => setIsPrintModalVisible(true)}
                            className="w-11 h-11 bg-indigo-500/20 rounded-2xl items-center justify-center border border-indigo-500/30"
                        >
                            <Printer size={20} color="white" />
                        </Pressable>

                        <Pressable
                            onPress={() => refetch()}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            {isRefetching ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                        </Pressable>
                    </View>
                </View>

                {/* Dashboard Stats (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="bg-white/20 p-2 rounded-xl mr-3">
                                <Package size={16} color="white" />
                            </View>
                            <Typography className="text-white/90 text-sm font-bold">Total Barang</Typography>
                        </View>
                        <Typography variant="h2" weight="bold" className="text-white text-3xl tracking-tight">{stats.total}</Typography>
                    </View>

                    {stats.lowStock > 0 ? (
                        <View className="bg-red-500/20 p-3 rounded-2xl border border-red-500/30 flex-row items-center">
                            <View className="bg-red-500/20 p-1.5 rounded-lg mr-3">
                                <AlertTriangle size={14} color="#FCA5A5" />
                            </View>
                            <View>
                                <Typography className="text-red-200 text-[10px] font-bold uppercase tracking-widest">Perhatian</Typography>
                                <Typography className="text-white font-bold">{stats.lowStock} Barang Stok Menipis</Typography>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/30 flex-row items-center">
                            <View className="bg-emerald-500/20 p-1.5 rounded-lg mr-3">
                                <Package size={14} color="#6EE7B7" />
                            </View>
                            <View>
                                <Typography className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest">Status Aman</Typography>
                                <Typography className="text-white font-bold">Stok Semua Barang Aman</Typography>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* Floating Search Overlay - Hide when form is open */}
            {!sheetVisible && (
                <View className="px-6 -mt-10 z-10 mb-4">
                    <View className="bg-white p-2 rounded-[24px] shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                placeholder="Cari sparepart..."
                                className="flex-1 ml-3 text-sm font-medium text-textMain"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>
                </View>
            )}

            {/* Bulk Actions Header */}
            {!sheetVisible && (
                <View className="px-6 mb-4">
                    <Card className="bg-white p-3 rounded-3xl border border-gray-100 flex-row items-center justify-between shadow-sm">
                        <View className="flex-row items-center">
                            <Pressable
                                onPress={toggleSelectAll}
                                className="flex-row items-center mr-4"
                            >
                                <View className={`w-6 h-6 rounded-lg border items-center justify-center ${selectedIds.length === sparePartsList.length && sparePartsList.length > 0 ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                    {selectedIds.length === sparePartsList.length && sparePartsList.length > 0 && <Check size={14} color="white" />}
                                </View>
                                <Typography className="ml-2 text-xs font-bold text-textGray">Pilih Semua</Typography>
                            </Pressable>

                            {selectedIds.length > 0 && (
                                <Typography className="text-xs font-bold text-primary px-2 py-1 bg-primary/5 rounded-lg">
                                    {selectedIds.length} terpilih
                                </Typography>
                            )}
                        </View>

                        <View className="flex-row space-x-2">
                            {selectedIds.length > 0 ? (
                                <>
                                    <View className="flex-row bg-indigo-50 border border-indigo-100 rounded-2xl p-1 mr-2">
                                        <Pressable
                                            onPress={() => setIsPrintModalVisible(true)}
                                            className="w-10 h-10 items-center justify-center"
                                        >
                                            <Printer size={18} color="#4F46E5" />
                                        </Pressable>
                                    </View>
                                    <Pressable
                                        onPress={handleBulkDelete}
                                        className="w-10 h-10 bg-red-50 rounded-2xl items-center justify-center border border-red-100"
                                    >
                                        <Trash2 size={18} color="#EF4444" />
                                    </Pressable>
                                    <Pressable
                                        onPress={handleBulkExport}
                                        className="w-10 h-10 bg-emerald-50 rounded-2xl items-center justify-center border border-emerald-100"
                                    >
                                        <Download size={18} color="#10B981" />
                                    </Pressable>
                                </>
                            ) : (
                                <Pressable
                                    onPress={handleBulkExport}
                                    className="px-4 py-2.5 bg-gray-50 rounded-2xl flex-row items-center border border-gray-100"
                                >
                                    <Download size={16} color="#4B5563" className="mr-2" />
                                    <Typography className="text-xs font-bold text-gray-600">Download XLS</Typography>
                                </Pressable>
                            )}
                        </View>
                    </Card>
                </View>
            )}

            {/* List */}
            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#16A34A" />
                </View>
            ) : (
                <FlatList
                    data={sparePartsList}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#16A34A" />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <Package size={64} color="#E5E7EB" strokeWidth={1} />
                            <Typography className="text-textGray mt-4">Tidak ada data sparepart</Typography>
                        </View>
                    }
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <ActivityIndicator size="small" color="#16A34A" className="py-4" />
                        ) : null
                    }
                />
            )}

            {/* Floating Action Button */}
            {!sheetVisible && (
                <Pressable
                    onPress={() => handleOpenSheet()}
                    className="absolute bottom-10 right-8 w-16 h-16 bg-primary rounded-[24px] items-center justify-center shadow-2xl elevation-8"
                >
                    <Plus size={32} color="white" />
                </Pressable>
            )}

            {/* Sheet Form */}
            {Platform.OS === 'web' ? (
                <BaseModal visible={sheetVisible} onClose={handleCloseSheet} title={isEditing ? 'Edit Sparepart' : 'Tambah Sparepart'} fullScreen>
                    <ScrollView>{renderFormContent()}</ScrollView>
                </BaseModal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    onClose={handleCloseSheet}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ borderRadius: 48 }}
                >
                    <BottomSheetScrollView>
                        {renderFormContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            {/* Scanner Modals */}
            <BarcodeScannerModal
                visible={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanCode}
            />



            {/* Print Selection Modal */}
            <BaseModal
                visible={isPrintModalVisible}
                onClose={() => setIsPrintModalVisible(false)}
                title="Cetak Label"
            >
                <View className="p-4">
                    <Typography className="text-textGray mb-6 text-center">
                        {selectedIds.length > 0
                            ? `Cetak label untuk ${selectedIds.length} item terpilih.`
                            : 'Pilih jenis label yang akan dicetak untuk semua data yang tampil di layar saat ini.'}
                    </Typography>

                    <View className="space-y-4">
                        <Pressable
                            onPress={() => {
                                setIsPrintModalVisible(false);
                                setTimeout(() => handleBulkPrint('QR'), 300);
                            }}
                            className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex-row items-center"
                        >
                            <View className="bg-primary/10 p-3 rounded-xl mr-4">
                                <QrCode size={24} color="#023C69" />
                            </View>
                            <View>
                                <Typography variant="body1" weight="bold" className="text-primary">QR Code</Typography>
                                <Typography variant="caption" className="text-textGray">Format kotak, cepat dipindai</Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setIsPrintModalVisible(false);
                                setTimeout(() => handleBulkPrint('BARCODE'), 300);
                            }}
                            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row items-center"
                        >
                            <View className="bg-emerald-100 p-3 rounded-xl mr-4">
                                <Barcode size={24} color="#059669" />
                            </View>
                            <View>
                                <Typography variant="body1" weight="bold" className="text-emerald-700">Barcode</Typography>
                                <Typography variant="caption" className="text-textGray">Format garis standar (Code 128)</Typography>
                            </View>
                        </Pressable>

                        <Button
                            title="Tutup"
                            variant="outline"
                            onPress={() => setIsPrintModalVisible(false)}
                            className="mt-4"
                        />
                    </View>
                </View>
            </BaseModal>
            {/* Import & Bulk Update Modal */}
            <BaseModal
                visible={isImportModalVisible}
                onClose={() => setIsImportModalVisible(false)}
                title="Kelola Data Massal (XLS)"
            >
                <View className="p-4">
                    <Typography className="text-textGray mb-6 text-center">
                        Pilih jenis aksi massal yang ingin Anda lakukan menggunakan file Excel.
                    </Typography>

                    <View className="space-y-4">
                        <Pressable
                            onPress={() => {
                                setIsImportModalVisible(false);
                                handleImport();
                            }}
                            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row items-center"
                        >
                            <View className="bg-emerald-100 p-3 rounded-xl mr-4">
                                <Plus size={24} color="#059669" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-emerald-700">Tambah Barang Massal</Typography>
                                <Typography variant="caption" className="text-textGray">Impor ribuan data barang baru sekaligus.</Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setIsImportModalVisible(false);
                                handleImport();
                            }}
                            className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex-row items-center"
                        >
                            <View className="bg-amber-100 p-3 rounded-xl mr-4">
                                <RefreshCw size={24} color="#D97706" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-amber-700">Bulk Update (Harga/Stok)</Typography>
                                <Typography variant="caption" className="text-textGray">Upload file XLS hasil ekspor untuk memperbarui data.</Typography>
                            </View>
                        </Pressable>

                        <View className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mt-2">
                            <Typography className="text-blue-700 text-[10px] font-bold uppercase mb-2 tracking-widest">Alur Bulk Update:</Typography>
                            <Typography className="text-blue-600 text-[11px] leading-relaxed">
                                1. Pilih barang di daftar atau klik <Typography weight="bold">"Download XLS"</Typography>{"\n"}
                                2. Ubah harga/stok pada file Excel tersebut.{"\n"}
                                3. Klik menu ini dan upload kembali file yang sudah diubah.
                            </Typography>
                        </View>

                        <Button
                            title="Tutup"
                            variant="outline"
                            onPress={() => setIsImportModalVisible(false)}
                            className="mt-4"
                        />
                    </View>
                </View>
            </BaseModal>
        </View>
    );
}
