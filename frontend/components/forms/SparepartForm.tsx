import React, { useState, useEffect } from 'react';
import { View, Pressable, ScrollView, Image, Platform, TextInput } from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { BarcodeScannerModal } from '../ui/BarcodeScannerModal';
import { getCustomTabBarBottomPadding } from '../ui/CustomTabBar';
import { formatNumber, parseNumber } from '../../utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { offlineAwareWrite, enqueueOfflineAction } from '../../services/offlineQueue';
import { useCreateSparePart, useUpdateSparePart, useDeleteSparePart, useUploadSparePartImage, useNextSparePartKode } from '../../hooks';
import { FILE_URL } from '../../utils/api';
import { useScanSound } from '../../utils/sounds';
import { mapBarcodeToSparePartFields, parseBarcodeScan } from '../../utils/barcodeScan';
import { ALWAYS_READY_STOCK, isAlwaysReadyStock } from '../../utils/sparepartStock';
import { Package, Image as ImageIcon, Camera, QrCode, Sparkles, Check } from 'lucide-react-native';

export interface SparePartFormData {
    id?: number;
    kode?: string;
    nama: string;
    kode_part: string;
    kode_ean?: string;
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

const INITIAL_FORM: SparePartFormData = {
    nama: '', kode_part: '', kode_ean: '', harga_beli: '', harga_jual: '',
    stok: '', stok_minimum: '5', kategori: 'Umum', merek: '',
    satuan: 'pcs', lokasi_rak: '', catatan: '',
};

interface Props {
    initialData?: SparePartFormData;
    onSuccess?: () => void;
}

export default function SparepartForm({ initialData, onSuccess }: Props) {
    const isEditing = !!initialData?.id;
    const [form, setForm] = useState<SparePartFormData>(initialData || INITIAL_FORM);
    const [isAlwaysReady, setIsAlwaysReady] = useState(isAlwaysReadyStock(initialData?.stok));

    useEffect(() => {
        if (!initialData) return;
        const alwaysReady = isAlwaysReadyStock(initialData.stok);
        setIsAlwaysReady(alwaysReady);
        if (alwaysReady) {
            setForm((prev) => ({ ...prev, stok: ALWAYS_READY_STOCK }));
        }
    }, [initialData?.id, initialData?.stok]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerTarget, setScannerTarget] = useState<'kode' | 'kode_part' | 'kode_ean' | 'auto'>('auto');

    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const createMutation = useCreateSparePart();
    const updateMutation = useUpdateSparePart();
    const deleteMutation = useDeleteSparePart();
    const uploadImageMutation = useUploadSparePartImage();
    const { refetch: fetchNextKode } = useNextSparePartKode();

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
        if (status !== 'granted') { appAlert('Izin Ditolak', 'Maaf, kami butuh izin galeri untuk mengunggah gambar.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) setForm(prev => ({ ...prev, imageUri: result.assets[0].uri }));
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { appAlert('Izin Ditolak', 'Maaf, kami butuh izin kamera untuk mengambil foto.'); return; }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) setForm(prev => ({ ...prev, imageUri: result.assets[0].uri }));
    };

    const handleSubmit = async () => {
        try {
            const payload = { ...form, harga_beli: parseNumber(form.harga_beli), harga_jual: parseNumber(form.harga_jual), stok: Number(form.stok), stok_minimum: Number(form.stok_minimum) };
            const result = await offlineAwareWrite(queryClient, {
                type: isEditing && form.id ? 'bengkel.updateSparePart' : 'bengkel.createSparePart',
                payload: isEditing && form.id ? { id: form.id, data: payload } : payload,
                label: isEditing ? 'Update sparepart' : 'Sparepart baru',
                description: payload.nama,
                onlineFn: async () => {
                    let savedPart;
                    if (isEditing && form.id) savedPart = await updateMutation.mutateAsync({ id: form.id, data: payload });
                    else savedPart = await createMutation.mutateAsync(payload);
                    if (form.imageUri && (savedPart?.id || (isEditing && form.id))) {
                        const targetId = savedPart?.id || form.id;
                        const fd = new FormData();
                        if (Platform.OS === 'web') {
                            const r = await fetch(form.imageUri);
                            fd.append('file', await r.blob(), 'image.jpg');
                        } else {
                            // @ts-ignore
                            fd.append('file', { uri: form.imageUri, name: 'image.jpg', type: 'image/jpeg' } as any);
                        }
                        await uploadImageMutation.mutateAsync({ id: targetId!, formData: fd });
                    }
                    return savedPart;
                },
            });
            if (result.mode === 'offline') {
                // Queue image separately if local URI (upload after create needs server id — store alongside create only when editing)
                if (form.imageUri && isEditing && form.id && Platform.OS !== 'web') {
                    enqueueOfflineAction(queryClient, {
                        type: 'bengkel.uploadSparePartImage',
                        payload: { id: form.id },
                        label: 'Upload foto sparepart',
                        upload: { uri: form.imageUri, name: 'image.jpg', type: 'image/jpeg' },
                        skipOptimistic: true,
                    });
                }
                appAlert(
                    'Offline Mode',
                    form.imageUri && !isEditing
                        ? 'Data barang tersimpan di antrean. Foto akan diunggah setelah sync (edit ulang jika perlu).'
                        : 'Data barang tersimpan di antrean offline (perangkat).'
                );
                onSuccess?.();
                return;
            }
            onSuccess?.();
        } catch (error) {
            console.error('Failed to save sparepart:', error);
            const msg = 'Gagal menyimpan data barang. Periksa kembali input Anda.';
            appAlert('Error', msg);
        }
    };

    const handleDelete = () => {
        if (!form.id) return;
        const act = async () => {
            const result = await offlineAwareWrite(queryClient, {
                type: 'bengkel.deleteSparePart',
                payload: { id: form.id },
                label: 'Hapus sparepart',
                description: form.nama,
                onlineFn: () => deleteMutation.mutateAsync(form.id!),
            });
            if (result.mode === 'offline') {
                appAlert('Offline Mode', 'Penghapusan dijadwalkan di antrean offline.');
            }
            onSuccess?.();
        };
        appConfirm('Hapus Barang', 'Apakah Anda yakin ingin menghapus barang ini?', act, { confirmText: 'Hapus', variant: 'warning' });
    };

    return (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: getCustomTabBarBottomPadding(insets.bottom) }}>
            <Typography variant="h2" weight="bold" className="mb-6">{isEditing ? 'Edit Sparepart' : 'Tambah Sparepart'}</Typography>
            <View className="space-y-5">
                {/* Foto */}
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Foto Barang</Typography>
                    <View className="flex-row items-center space-x-4">
                        <View className="w-24 h-24 bg-gray-50 border border-gray-100 rounded-2xl items-center justify-center overflow-hidden">
                            {(form.imageUri || form.gambar) ? (
                                <Image key={form.imageUri || form.gambar} source={{ uri: form.imageUri || (form.gambar ? `${FILE_URL}/uploads/${form.gambar}` : undefined) }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center justify-center"><ImageIcon size={32} color="#9CA3AF" strokeWidth={1.5} /><Typography className="text-[8px] text-gray-400 mt-1">Kosong</Typography></View>
                            )}
                        </View>
                        <View className="flex-1 space-y-2">
                            <Pressable onPress={pickImage} className="flex-row items-center bg-white border border-indigo-100 rounded-xl px-3 py-2.5 active:bg-indigo-50"><ImageIcon size={16} color="#4F46E5" /><Typography className="text-indigo-600 font-bold text-xs ml-2">Pilih Galeri</Typography></Pressable>
                            <Pressable onPress={takePhoto} className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 active:bg-gray-50"><Camera size={16} color="#6B7280" /><Typography className="text-gray-600 font-bold text-xs ml-2">Ambil Foto</Typography></Pressable>
                        </View>
                    </View>
                </View>

                {/* Identitas */}
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Identitas Barang</Typography>
                    <Typography className="mb-3 text-textGray/70 text-[11px] ml-1">
                        Isi kode part pabrik dan/atau EAN. Keduanya opsional, tapi membantu scan & pencarian.
                    </Typography>
                    <View className="space-y-3">
                        <View className="flex-row items-center space-x-3">
                            <View className="flex-1">
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                    placeholder="Kode Part Pabrik (GS1 / OEM)"
                                    placeholderTextColor="#9CA3AF"
                                    value={form.kode_part}
                                    onChangeText={(t) => setForm({ ...form, kode_part: t })}
                                />
                            </View>
                            <Pressable onPress={() => { setScannerTarget('kode_part'); setIsScannerOpen(true); }} className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl items-center justify-center">
                                <QrCode size={20} color="#4F46E5" />
                            </Pressable>
                        </View>
                        <View className="flex-row items-center space-x-3">
                            <View className="flex-1">
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                    placeholder="Barcode EAN / GTIN (opsional)"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    value={form.kode_ean || ''}
                                    onChangeText={(t) => setForm({ ...form, kode_ean: t })}
                                />
                            </View>
                            <Pressable onPress={() => { setScannerTarget('kode_ean'); setIsScannerOpen(true); }} className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl items-center justify-center">
                                <QrCode size={20} color="#059669" />
                            </Pressable>
                        </View>
                        <Pressable
                            onPress={() => { setScannerTarget('auto'); setIsScannerOpen(true); }}
                            className="flex-row items-center justify-center bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 active:bg-blue-100"
                        >
                            <QrCode size={18} color="#2563EB" />
                            <Typography className="text-blue-700 font-bold text-xs ml-2">Scan Otomatis (isi kode part / EAN)</Typography>
                        </Pressable>
                        <View className="flex-row items-center space-x-3">
                            <View className="flex-1">
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 text-xs italic"
                                    placeholder="ID Stok Internal (SKU)"
                                    placeholderTextColor="#9CA3AF"
                                    value={form.kode}
                                    onChangeText={(t) => setForm({ ...form, kode: t })}
                                    readOnly={isEditing}
                                />
                            </View>
                            {!isEditing && (
                                <Pressable onPress={handleGenerateKode} className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-xl items-center justify-center">
                                    <Sparkles size={20} color="#D97706" />
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>

                {/* Nama */}
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Barang *</Typography>
                    <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="Contoh: Oli Yamalube" placeholderTextColor="#9CA3AF" value={form.nama} onChangeText={(t) => setForm({ ...form, nama: t })} />
                </View>

                {/* Harga */}
                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Beli</Typography>
                        <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={form.harga_beli} onChangeText={(t) => setForm({ ...form, harga_beli: formatNumber(t) })} />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Jual</Typography>
                        <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={form.harga_jual} onChangeText={(t) => setForm({ ...form, harga_jual: formatNumber(t) })} />
                    </View>
                </View>

                {/* Stok */}
                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <View className="flex-row justify-between items-center mb-2">
                            <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Stok Awal</Typography>
                            <Pressable onPress={() => {
                                const v = !isAlwaysReady;
                                setIsAlwaysReady(v);
                                if (v) {
                                    setForm((prev) => ({ ...prev, stok: ALWAYS_READY_STOCK }));
                                } else {
                                    setForm((prev) => (prev.stok === ALWAYS_READY_STOCK ? { ...prev, stok: '0' } : prev));
                                }
                            }} className="flex-row items-center">
                                <View className={`w-4 h-4 rounded border items-center justify-center mr-1.5 ${isAlwaysReady ? 'bg-primary border-primary' : 'border-gray-300'}`}>{isAlwaysReady && <Check size={10} color="white" />}</View>
                                <Typography className={`text-[10px] font-bold ${isAlwaysReady ? 'text-primary' : 'text-textGray'}`}>Always Ready</Typography>
                            </Pressable>
                        </View>
                        <TextInput className={`bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 ${isAlwaysReady ? 'opacity-50' : ''}`} placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={form.stok} onChangeText={(t) => setForm({ ...form, stok: t })} editable={!isAlwaysReady} />
                        {isAlwaysReady && <Typography className="text-[8px] text-indigo-500 mt-1 italic font-bold">* Mode Always Ready: Stok diset ke 999999 dan tidak akan berkurang.</Typography>}
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Min. Stok</Typography>
                        <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="5" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={form.stok_minimum} onChangeText={(t) => setForm({ ...form, stok_minimum: t })} />
                    </View>
                </View>

                {/* Satuan & Kategori */}
                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Satuan</Typography>
                        <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="pcs" placeholderTextColor="#9CA3AF" value={form.satuan} onChangeText={(t) => setForm({ ...form, satuan: t })} />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kategori</Typography>
                        <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="Umum" placeholderTextColor="#9CA3AF" value={form.kategori} onChangeText={(t) => setForm({ ...form, kategori: t })} />
                    </View>
                </View>

                {/* Lokasi Rak */}
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Lokasi Rak (Opsional)</Typography>
                    <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5" placeholder="Contoh: Rak A-1" placeholderTextColor="#9CA3AF" value={form.lokasi_rak} onChangeText={(t) => setForm({ ...form, lokasi_rak: t })} />
                </View>

                {/* Catatan */}
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Catatan (Opsional)</Typography>
                    <TextInput className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[80px]" placeholder="Keterangan tambahan..." placeholderTextColor="#9CA3AF" value={form.catatan} onChangeText={(t) => setForm({ ...form, catatan: t })} multiline textAlignVertical="top" />
                </View>

                {/* Tombol Aksi */}
                <View className="space-y-3 mt-4">
                    <Button title={isEditing ? 'Simpan Perubahan' : 'Simpan Barang'} onPress={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="shadow-lg shadow-primary/30" size="lg" />
                    {isEditing && <Button title="Hapus Barang" variant="danger" onPress={handleDelete} className="mt-2" />}
                </View>
            </View>

            <BarcodeScannerModal
                visible={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={(d) => {
                    if (scannerTarget === 'auto') {
                        const mapped = mapBarcodeToSparePartFields(d);
                        setForm((prev) => ({
                            ...prev,
                            ...(mapped.kode_part ? { kode_part: mapped.kode_part } : {}),
                            ...(mapped.kode_ean ? { kode_ean: mapped.kode_ean } : {}),
                        }));
                    } else if (scannerTarget === 'kode_part') {
                        const mapped = mapBarcodeToSparePartFields(d);
                        setForm((prev) => ({ ...prev, kode_part: mapped.kode_part || parseBarcodeScan(d).preferred }));
                    } else if (scannerTarget === 'kode_ean') {
                        const mapped = mapBarcodeToSparePartFields(d);
                        setForm((prev) => ({ ...prev, kode_ean: mapped.kode_ean || parseBarcodeScan(d).preferred }));
                    } else {
                        setForm((prev) => ({ ...prev, kode: parseBarcodeScan(d).preferred }));
                    }
                    setIsScannerOpen(false);
                    return true;
                }}
            />
        </ScrollView>
    );
}
