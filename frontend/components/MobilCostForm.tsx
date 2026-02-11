import React, { useState } from 'react';
import { View, ScrollView, TextInput, ActivityIndicator, Alert, Platform, StyleSheet, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from '@gorhom/bottom-sheet'; // Removed due to web compatibility issues
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Receipt, Wrench, Plus, Trash2, Calendar, FileText } from 'lucide-react-native';
import { useAddBiaya, useDeleteBiaya, useAddPartService, useDeletePartService, useAddBengkelTransaction, useMobilDetail } from '../hooks/useMobil';
import { SparePartSelector } from './ui/SparePartSelector';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';
import { JasaSelector } from './ui/JasaSelector';

interface MobilCostFormProps {
    unit: any;
    onSuccess?: () => void;
}

export const MobilCostForm = ({ unit, onSuccess }: MobilCostFormProps) => {
    const [activeTab, setActiveTab] = useState<'lainnya' | 'perbaikan'>('lainnya');
    const { data: detailUnit, isLoading: isDetailLoading } = useMobilDetail(unit?.id);

    const activeUnit = detailUnit || unit;

    // Mutations
    const addBiayaMutation = useAddBiaya();
    const deleteBiayaMutation = useDeleteBiaya();
    const addPartServiceMutation = useAddPartService();
    const deletePartServiceMutation = useDeletePartService();
    const addBengkelTrxMutation = useAddBengkelTransaction();

    // Form States
    const [newLainnya, setNewLainnya] = useState({ kategori: 'BBN', deskripsi: '', jumlah: '' });
    const [newPerbaikan, setNewPerbaikan] = useState({ tipe: 'perbaikan', deskripsi: '', qty: '1', harga_satuan: '' });

    // Workshop Integration States
    const [showBengkel, setShowBengkel] = useState(false);
    const [bengkelServices, setBengkelServices] = useState<{ deskripsi: string; harga: string }[]>([]);
    const [bengkelParts, setBengkelParts] = useState<{ id: number; nama: string; qty: string; harga: number }[]>([]);

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        loading?: boolean;
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert',
        loading: false
    });

    const handleAddBengkelTrx = () => {
        if (bengkelServices.length === 0 && bengkelParts.length === 0) {
            setDialogConfig({ visible: true, title: 'Error', message: 'Belum ada data servis atau sparepart', variant: 'error', type: 'alert' });
            return;
        }

        const payload = {
            parts: bengkelParts.filter(p => p.id !== 0 && parseFloat(p.qty) > 0).map(p => ({
                part_id: p.id,
                qty: parseInt(p.qty)
            })),
            services: bengkelServices.filter(s => s.deskripsi && s.harga).map(s => ({
                deskripsi: s.deskripsi,
                harga: typeof s.harga === 'string' ? parseNumber(s.harga) : s.harga
            }))
        };

        addBengkelTrxMutation.mutate({
            id: activeUnit.id,
            data: payload
        }, {
            onSuccess: () => {
                setShowBengkel(false);
                setBengkelServices([]);
                setBengkelParts([]);
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Integrasi bengkel berhasil dicatat',
                    variant: 'success',
                    type: 'alert',
                    loading: false
                });
            },
            onError: (err: any) => {
                setDialogConfig({
                    visible: true,
                    title: 'Error',
                    message: getErrorMessage(err, 'Gagal integrasi bengkel'),
                    variant: 'error',
                    type: 'alert',
                    loading: false
                });
            }
        });
    };

    // Cost Management Helpers
    const addService = () => setBengkelServices([...bengkelServices, { deskripsi: '', harga: '' }]);
    const removeService = (index: number) => {
        const newServices = [...bengkelServices];
        newServices.splice(index, 1);
        setBengkelServices(newServices);
    };
    const updateService = (index: number, key: 'deskripsi' | 'harga', value: string) => {
        const newServices = [...bengkelServices];
        if (key === 'harga') {
            newServices[index][key] = formatNumber(value);
        } else {
            newServices[index][key] = value;
        }
        setBengkelServices(newServices);
    };

    const addPart = () => setBengkelParts([...bengkelParts, { id: 0, nama: '', qty: '1', harga: 0 }]);
    const removePart = (index: number) => {
        const newParts = [...bengkelParts];
        newParts.splice(index, 1);
        setBengkelParts(newParts);
    };
    const updatePart = (index: number, part: any) => {
        const newParts = [...bengkelParts];
        if (part) {
            newParts[index].id = part.id;
            newParts[index].nama = part.nama;
            newParts[index].harga = part.harga_jual;
        } else {
            newParts[index].id = 0;
            newParts[index].nama = '';
            newParts[index].harga = 0;
        }
        setBengkelParts(newParts);
    };
    const updatePartQty = (index: number, qty: string) => {
        const newParts = [...bengkelParts];
        newParts[index].qty = qty;
        setBengkelParts(newParts);
    };

    const handleAddBiaya = () => {
        const jumlahNum = parseNumber(newLainnya.jumlah);
        if (isNaN(jumlahNum) || jumlahNum <= 0) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Mohon isi jumlah biaya yang valid', variant: 'warning', type: 'alert' });
            return;
        }

        addBiayaMutation.mutate({
            id: unit.id,
            data: {
                kategori: newLainnya.kategori || 'Lain-lain',
                deskripsi: newLainnya.deskripsi || newLainnya.kategori || 'Biaya Persiapan Unit',
                jumlah: jumlahNum,
                tanggal: new Date().toISOString().split('T')[0],
            }
        }, {
            onSuccess: () => {
                setNewLainnya({ kategori: 'BBN', deskripsi: '', jumlah: '' });
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Biaya berhasil ditambahkan',
                    variant: 'success',
                    type: 'alert'
                });
            },
            onError: (err: any) => {
                setDialogConfig({
                    visible: true,
                    title: 'Gagal',
                    message: getErrorMessage(err, 'Gagal menambahkan biaya'),
                    variant: 'error',
                    type: 'alert'
                });
            }
        });
    };

    const handleDeleteBiaya = (biayaId: number) => {
        setDialogConfig({
            visible: true,
            title: 'Hapus Biaya',
            message: 'Yakin menghapus biaya ini?',
            variant: 'error',
            type: 'confirm',
            loading: false,
            onConfirm: () => {
                setDialogConfig(prev => ({ ...prev, loading: true }));
                deleteBiayaMutation.mutate({ id: activeUnit.id, biayaId }, {
                    onSuccess: () => {
                        setDialogConfig({ visible: true, title: 'Sukses', message: 'Biaya berhasil dihapus', variant: 'success', type: 'alert', loading: false });
                    },
                    onError: (err) => {
                        setDialogConfig({ visible: true, title: 'Gagal', message: getErrorMessage(err, 'Gagal menghapus biaya'), variant: 'error', type: 'alert', loading: false });
                    }
                });
            }
        });
    };

    const handleAddPerbaikan = () => {
        const hrgNum = parseNumber(newPerbaikan.harga_satuan);
        const qtyNum = parseInt(newPerbaikan.qty) || 1;

        if (!newPerbaikan.deskripsi) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Mohon isi deskripsi perbaikan', variant: 'warning', type: 'alert' });
            return;
        }
        if (isNaN(hrgNum) || hrgNum <= 0) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Mohon isi harga perbaikan yang valid', variant: 'warning', type: 'alert' });
            return;
        }

        addPartServiceMutation.mutate({
            id: unit.id,
            data: {
                tipe: newPerbaikan.tipe,
                deskripsi: newPerbaikan.deskripsi,
                qty: qtyNum,
                harga_satuan: hrgNum,
                tanggal: new Date().toISOString().split('T')[0],
            }
        }, {
            onSuccess: () => {
                setNewPerbaikan({ tipe: 'perbaikan', deskripsi: '', qty: '1', harga_satuan: '' });
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Data perbaikan berhasil ditambahkan',
                    variant: 'success',
                    type: 'alert'
                });
            },
            onError: (err: any) => {
                setDialogConfig({
                    visible: true,
                    title: 'Gagal',
                    message: getErrorMessage(err, 'Gagal menambahkan perbaikan'),
                    variant: 'error',
                    type: 'alert'
                });
            }
        });
    };

    const handleDeletePartService = (partServiceId: number) => {
        setDialogConfig({
            visible: true,
            title: 'Hapus Item',
            message: 'Yakin menghapus item ini?',
            variant: 'error',
            type: 'confirm',
            loading: false,
            onConfirm: () => {
                setDialogConfig(prev => ({ ...prev, loading: true }));
                deletePartServiceMutation.mutate({ id: activeUnit.id, partServiceId }, {
                    onSuccess: () => {
                        setDialogConfig({ visible: true, title: 'Sukses', message: 'Item berhasil dihapus', variant: 'success', type: 'alert', loading: false });
                    },
                    onError: (err) => {
                        setDialogConfig({ visible: true, title: 'Gagal', message: getErrorMessage(err, 'Gagal menghapus item'), variant: 'error', type: 'alert', loading: false });
                    }
                });
            }
        });
    };


    const calculateTotal = () => {
        const totalLainnya = (activeUnit?.biaya_lainnya || []).reduce((acc: number, curr: any) => acc + (Number(curr.jumlah) || 0), 0);
        const totalPerbaikan = (activeUnit?.part_services || []).reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
        return totalLainnya + totalPerbaikan;
    };

    const renderTabs = () => (
        <View className="px-6 pt-4 mb-4">
            <Typography variant="h3" weight="bold">Manajemen Biaya Unit</Typography>
            <Typography variant="caption" className="text-gray-400">{activeUnit?.merek} {activeUnit?.model} ({activeUnit?.nomor_plat})</Typography>

            <View className="flex-row bg-gray-100 rounded-xl p-1 mt-4">
                <TouchableOpacity
                    onPress={() => setActiveTab('lainnya')}
                    className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'lainnya' ? 'bg-white shadow-sm' : ''}`}
                >
                    <View className="flex-row items-center">
                        <Receipt size={14} color={activeTab === 'lainnya' ? '#00AA13' : '#8E8E93'} />
                        <Typography weight="bold" className={`ml-2 ${activeTab === 'lainnya' ? 'text-primary' : 'text-gray-400'}`}>Admin & Pajak</Typography>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('perbaikan')}
                    className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'perbaikan' ? 'bg-white shadow-sm' : ''}`}
                >
                    <View className="flex-row items-center">
                        <Wrench size={14} color={activeTab === 'perbaikan' ? '#00AA13' : '#8E8E93'} />
                        <Typography weight="bold" className={`ml-2 ${activeTab === 'perbaikan' ? 'text-primary' : 'text-gray-400'}`}>Perbaikan</Typography>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderFormContent = () => (
        <View className="px-6 pb-4">
            {activeTab === 'lainnya' ? (
                <View>
                    <Card className="bg-primary/5 border border-primary/10 p-4 mb-6">
                        <Typography variant="body2" weight="bold" className="text-primary mb-4">INPUT BIAYA ADMIN/PAJAK</Typography>

                        <View className="flex-row space-x-3 mb-2">
                            <View className="flex-1">
                                <Typography variant="caption" className="mb-1 font-medium">Kategori</Typography>
                                <View className="bg-white border border-gray-200 rounded-lg h-10 justify-center px-3">
                                    <TextInput
                                        value={newLainnya.kategori}
                                        onChangeText={(val) => setNewLainnya({ ...newLainnya, kategori: val })}
                                        placeholder="BBN/Pajak"
                                        className="text-xs font-bold"
                                    />
                                </View>
                            </View>
                            <Input
                                label="Jumlah (Rp)"
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="flex-1"
                                className="h-10 text-xs"
                                value={newLainnya.jumlah}
                                onChangeText={(val) => setNewLainnya({ ...newLainnya, jumlah: formatNumber(val) })}
                            />
                        </View>

                        <Input
                            label="Keterangan"
                            placeholder="Contoh: Balik nama an. PT TPM"
                            containerClassName="mb-4"
                            className="h-10 text-xs"
                            value={newLainnya.deskripsi}
                            onChangeText={(val) => setNewLainnya({ ...newLainnya, deskripsi: val })}
                        />
                        <Button
                            title={addBiayaMutation.isPending ? "Menambahkan..." : "Tambah Biaya"}
                            variant="primary"
                            size="sm"
                            onPress={handleAddBiaya}
                            disabled={addBiayaMutation.isPending}
                        />
                    </Card>

                    {(activeUnit?.biaya_lainnya || []).map((item: any) => (
                        <Card key={item.id} className="mb-3 p-3 flex-row items-center border border-gray-100">
                            <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-3">
                                <FileText size={18} color="#00AA13" />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-xs">{item.kategori}</Typography>
                                <Typography variant="caption" className="text-gray-400">{item.deskripsi}</Typography>
                            </View>
                            <Typography weight="bold" className="text-xs mr-3">{formatCurrency(Number(item.jumlah))}</Typography>
                            <TouchableOpacity
                                onPress={() => handleDeleteBiaya(item.id)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={{
                                    padding: 8,
                                    zIndex: 100,
                                    cursor: Platform.OS === 'web' ? 'pointer' : undefined
                                }}
                            >
                                <Trash2 size={22} color="#EE2737" />
                            </TouchableOpacity>
                        </Card>
                    ))}
                    {isDetailLoading && <ActivityIndicator color="#00AA13" className="my-4" />}
                </View>
            ) : (
                <View>
                    <View className="flex-row justify-between items-center mb-4">
                        <Typography variant="body2" weight="bold" className="text-primary">METODE INPUT PERBAIKAN</Typography>
                        <TouchableOpacity
                            onPress={() => setShowBengkel(!showBengkel)}
                            className={`px-3 py-1 rounded-full border ${showBengkel ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}
                        >
                            <Typography variant="caption" weight="bold" className={showBengkel ? 'text-white' : 'text-gray-600'}>
                                {showBengkel ? "Integrasi Bengkel" : "Input Manual"}
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    {showBengkel ? (
                        <Card className="bg-orange-50 border border-orange-100 p-4 mb-6">
                            <Typography variant="caption" className="text-orange-600 mb-4 italic font-medium">
                                Mode Integrasi: Stok sparepart akan berkurang dan transaksi tercatat di modul Bengkel.
                            </Typography>

                            {/* Services */}
                            <View className="mb-4">
                                <View className="flex-row justify-between items-center mb-2">
                                    <View className="flex-row items-center">
                                        <Typography variant="caption" weight="bold">JASA SERVIS</Typography>
                                    </View>
                                    <TouchableOpacity onPress={addService}>
                                        <Plus size={16} color="#F97316" />
                                    </TouchableOpacity>
                                </View>
                                {bengkelServices.length === 0 && <Typography variant="caption" className="text-gray-400 mb-2">Belum ada jasa servis</Typography>}
                                {bengkelServices.map((item, index) => (
                                    <View key={index} className="flex-row space-x-2 items-center mb-2">
                                        <View className="flex-[2]">
                                            <JasaSelector
                                                value={item.deskripsi ? { nama: item.deskripsi, harga: parseNumber(item.harga) } : null}
                                                onSelect={(val) => {
                                                    const newServices = [...bengkelServices];
                                                    if (val) {
                                                        const cleanPrice = Math.floor(Number(val.harga)).toString();
                                                        newServices[index] = { deskripsi: val.nama, harga: formatNumber(cleanPrice) };
                                                    } else {
                                                        newServices[index] = { deskripsi: '', harga: '' };
                                                    }
                                                    setBengkelServices(newServices);
                                                }}
                                                placeholder="Pilih Jasa Servis..."
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Input
                                                placeholder="Harga"
                                                keyboardType="numeric"
                                                value={item.harga}
                                                onChangeText={v => updateService(index, 'harga', v)}
                                                containerClassName="mb-0"
                                                className="bg-white"
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => removeService(index)}
                                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                            style={{ padding: 8 }}
                                        >
                                            <Trash2 size={18} color="#EE2737" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            {/* Parts */}
                            <View className="mb-4">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Typography variant="caption" weight="bold">SPAREPART</Typography>
                                    <TouchableOpacity onPress={addPart}>
                                        <Plus size={16} color="#F97316" />
                                    </TouchableOpacity>
                                </View>
                                {bengkelParts.length === 0 && <Typography variant="caption" className="text-gray-400 mb-2">Belum ada sparepart</Typography>}
                                {bengkelParts.map((item, index) => (
                                    <View key={index} className="mb-3 border-b border-orange-200 pb-2">
                                        <SparePartSelector
                                            value={item.id ? { id: item.id, nama: item.nama, harga_jual: item.harga } : null}
                                            onSelect={(p) => updatePart(index, p)}
                                        />
                                        <View className="flex-row space-x-2 mt-2 items-center">
                                            <View className="flex-1">
                                                <Input
                                                    label="Qty"
                                                    keyboardType="numeric"
                                                    value={item.qty}
                                                    onChangeText={v => updatePartQty(index, v)}
                                                    containerClassName="mb-0"
                                                    className="bg-white"
                                                />
                                            </View>
                                            <View className="flex-[2]">
                                                <Typography variant="caption" className="text-gray-500">
                                                    @ {formatCurrency(item.harga)}
                                                </Typography>
                                                <Typography weight="bold">
                                                    Total: {formatCurrency(item.harga * (parseFloat(item.qty) || 0))}
                                                </Typography>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => removePart(index)}
                                                className="pt-4"
                                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                                style={{ padding: 8 }}
                                            >
                                                <Trash2 size={18} color="#EE2737" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <Button
                                title={addBengkelTrxMutation.isPending ? "Memproses..." : "Tambah Perbaikan Bengkel"}
                                variant="primary"
                                size="sm"
                                onPress={handleAddBengkelTrx}
                                disabled={addBengkelTrxMutation.isPending}
                            />
                        </Card>
                    ) : (
                        <Card className="bg-primary/5 border border-primary/10 p-4 mb-6">
                            <Typography variant="body2" weight="bold" className="text-primary mb-4">INPUT PERBAIKAN / PART (MANUAL)</Typography>

                            <Input
                                label="Deskripsi Pekerjaan"
                                placeholder="Contoh: Ganti Ban Depan"
                                containerClassName="mb-3"
                                className="h-10 text-xs"
                                value={newPerbaikan.deskripsi}
                                onChangeText={(val) => setNewPerbaikan({ ...newPerbaikan, deskripsi: val })}
                            />

                            <View className="flex-row space-x-3 mb-4">
                                <Input
                                    label="Qty"
                                    placeholder="1"
                                    keyboardType="numeric"
                                    containerClassName="w-20"
                                    className="h-10 text-xs"
                                    value={newPerbaikan.qty}
                                    onChangeText={(val) => setNewPerbaikan({ ...newPerbaikan, qty: val })}
                                />
                                <Input
                                    label="Harga/Item (Rp)"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    containerClassName="flex-1"
                                    className="h-10 text-xs"
                                    value={newPerbaikan.harga_satuan}
                                    onChangeText={(val) => setNewPerbaikan({ ...newPerbaikan, harga_satuan: formatNumber(val) })}
                                />
                            </View>

                            <Button
                                title={addPartServiceMutation.isPending ? "Menambahkan..." : "Tambah Perbaikan"}
                                variant="primary"
                                size="sm"
                                onPress={handleAddPerbaikan}
                                disabled={addPartServiceMutation.isPending}
                            />
                        </Card>
                    )}

                    {(activeUnit?.part_services || []).map((item: any) => (
                        <Card key={item.id} className="mb-3 p-3 flex-row items-center border border-gray-100">
                            <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-3">
                                <Wrench size={18} color="#00AA13" />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-xs">{item.deskripsi}</Typography>
                                <Typography variant="caption" className="text-gray-400">{item.qty} x {formatCurrency(Number(item.harga_satuan))}</Typography>
                            </View>
                            <Typography weight="bold" className="text-xs mr-3">{formatCurrency(Number(item.total))}</Typography>
                            <TouchableOpacity
                                onPress={() => handleDeletePartService(item.id)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={{
                                    padding: 8,
                                    zIndex: 100,
                                    cursor: Platform.OS === 'web' ? 'pointer' : undefined
                                }}
                            >
                                <Trash2 size={22} color="#EE2737" />
                            </TouchableOpacity>
                        </Card>
                    ))}
                    {isDetailLoading && <ActivityIndicator color="#00AA13" className="my-4" />}
                </View>
            )}
        </View>
    );

    const renderFooter = () => (
        <View className="p-6 border-t border-gray-100 bg-white">
            <View className="flex-row justify-between items-center mb-4">
                <Typography variant="body1" weight="bold">Total Tambahan Biaya</Typography>
                <Typography variant="h3" weight="bold" className="text-primary">{formatCurrency(calculateTotal())}</Typography>
            </View>
            <Button title="Selesai" variant="primary" size="lg" onPress={() => onSuccess?.()} />
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View style={styles.webContainer}>
                {renderTabs()}
                <ScrollView style={styles.flex1} showsVerticalScrollIndicator={true}>
                    {renderFormContent()}
                </ScrollView>
                {renderFooter()}

                <AlertDialog
                    visible={dialogConfig.visible}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    variant={dialogConfig.variant}
                    type={dialogConfig.type}
                    loading={dialogConfig.loading}
                    onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                    onConfirm={dialogConfig.onConfirm}
                />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex1}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.mobileContainer}>
                {renderTabs()}
                <BottomSheetScrollView
                    style={styles.flex1}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                >
                    {renderFormContent()}
                </BottomSheetScrollView>
                {renderFooter()}
            </View>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                loading={dialogConfig.loading}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    flex1: {
        flex: 1,
    },
    webContainer: {
        flex: 1,
        backgroundColor: 'white',
        height: '85vh' as any,
    },
    mobileContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
});
