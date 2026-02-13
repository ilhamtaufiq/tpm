import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Alert, Text, ScrollView, Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProfitSplitCard } from './ProfitSplitCard';
import { jasaAngkutService, Supir } from '../../services/jasaAngkut';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import { Plus, Trash2 } from 'lucide-react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AlertDialog } from '../ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

interface MuatanFormProps {
    onSuccess?: () => void;
    initialData?: any; // Data for edit mode
}

export const MuatanForm = ({ onSuccess, initialData }: MuatanFormProps) => {
    const isEditMode = !!initialData;
    const [submitting, setSubmitting] = useState(false);
    const [activeDrivers, setActiveDrivers] = useState<Supir[]>([]);
    const [loadingDrivers, setLoadingDrivers] = useState(true);
    const [driverMode, setDriverMode] = useState<'registered' | 'manual'>('registered');

    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        supir_id: '',
        supir_nama: '', // Manual name
        nopol: '',
        asal: '',
        tujuan: '',
        jenis_muatan: '',
        ritase: '1',
        harga_beli: '',
        harga_jual: '',
        status_bayar: 'BELUM_LUNAS',
        metode_bayar: 'TUNAI',
        catatan: ''
    });

    const [operationalCosts, setOperationalCosts] = useState<{ deskripsi: string; jumlah: string }[]>([
        { deskripsi: 'BBM/TOL/Parkir', jumlah: '' },
    ]);

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    useEffect(() => {
        loadDrivers();
    }, []);

    // Initialize form with edit data
    useEffect(() => {
        if (initialData) {
            setFormData({
                tanggal: initialData.tanggal?.split('T')[0] || new Date().toISOString().split('T')[0],
                supir_id: initialData.supir_id?.toString() || '',
                supir_nama: initialData.supir_nama || initialData.supir_nama_manual || '',
                nopol: initialData.nopol || '',
                asal: initialData.asal || '',
                tujuan: initialData.tujuan || '',
                jenis_muatan: initialData.jenis_muatan || '',
                ritase: initialData.ritase?.toString() || '1',
                harga_beli: formatNumber(initialData.harga_beli?.toString() || ''),
                harga_jual: formatNumber(initialData.harga_jual?.toString() || ''),
                status_bayar: initialData.status_bayar === 'LUNAS' ? 'LUNAS' : 'BELUM_LUNAS',
                metode_bayar: initialData.metode_bayar?.toUpperCase() || 'TUNAI',
                catatan: initialData.catatan || ''
            });

            // Set driver mode based on whether supir_id exists
            if (initialData.supir_id) {
                setDriverMode('registered');
            } else if (initialData.supir_nama || initialData.supir_nama_manual) {
                setDriverMode('manual');
            }

            // Initialize operational costs
            let opsCosts: { deskripsi: string; jumlah: string }[] = [];

            // Check biaya_tambahan (preferred) or biaya_operasional or fallback
            const additionalCosts = initialData.biaya_tambahan || initialData.biaya_operasional;

            if (additionalCosts && Array.isArray(additionalCosts)) {
                // Filter only 'Operasional' or items that aren't 'Perawatan Bengkel'
                opsCosts = additionalCosts
                    .filter((item: any) => !item.kategori || item.kategori === 'Operasional')
                    .map((item: any) => ({
                        deskripsi: item.deskripsi || '',
                        jumlah: formatNumber(item.jumlah?.toString() || '')
                    }));
            }

            // Fallback to old static fields if opsCosts still empty
            if (opsCosts.length === 0) {
                if (initialData.biaya_bbm) opsCosts.push({ deskripsi: 'BBM', jumlah: formatNumber(initialData.biaya_bbm.toString()) });
                if (initialData.biaya_tol) opsCosts.push({ deskripsi: 'Tol', jumlah: formatNumber(initialData.biaya_tol.toString()) });
                if (initialData.biaya_parkir) opsCosts.push({ deskripsi: 'Parkir', jumlah: formatNumber(initialData.biaya_parkir.toString()) });
                if (initialData.biaya_makan) opsCosts.push({ deskripsi: 'Makan', jumlah: formatNumber(initialData.biaya_makan.toString()) });
                if (initialData.biaya_lainnya) opsCosts.push({ deskripsi: 'Lainnya', jumlah: formatNumber(initialData.biaya_lainnya.toString()) });
            }

            if (opsCosts.length > 0) {
                setOperationalCosts(opsCosts);
            }

        }
    }, [initialData]);


    const loadDrivers = async () => {
        try {
            const drivers = await jasaAngkutService.getActiveSupir();
            setActiveDrivers(drivers);
        } catch (e) {
            console.error('Failed to load drivers:', e);
        } finally {
            setLoadingDrivers(false);
        }
    };

    const updateField = (key: string, value: string) => {
        if (['harga_beli', 'harga_jual'].includes(key)) {
            setFormData(prev => ({ ...prev, [key]: formatNumber(value) }));
        } else {
            setFormData(prev => ({ ...prev, [key]: value }));
        }
    };

    const updateCost = (index: number, key: 'deskripsi' | 'jumlah', value: string) => {
        const newCosts = [...operationalCosts];
        if (key === 'jumlah') {
            newCosts[index][key] = formatNumber(value);
        } else {
            newCosts[index][key] = value;
        }
        setOperationalCosts(newCosts);
    };

    const addCost = () => {
        setOperationalCosts([...operationalCosts, { deskripsi: '', jumlah: '' }]);
    };

    const removeCost = (index: number) => {
        const newCosts = [...operationalCosts];
        newCosts.splice(index, 1);
        setOperationalCosts(newCosts);
    };

    const updatePartQty = (index: number, qty: string) => {
        // ... removed related to bengkelParts
    };

    const calculations = useMemo(() => {
        const beli = parseNumber(formData.harga_beli) || 0;
        const jual = parseNumber(formData.harga_jual) || 0;
        const revenue = jual - beli;

        const totalCosts = operationalCosts.reduce((acc, item) => {
            return acc + (parseNumber(item.jumlah) || 0);
        }, 0);

        return { revenue, totalCosts, beli, jual, bengkelTotal: 0 };
    }, [formData, operationalCosts]);

    const handleSubmit = async () => {
        if (driverMode === 'registered' && !formData.supir_id) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih supir terlebih dahulu', variant: 'warning' });
            return;
        }
        if (driverMode === 'manual' && !formData.supir_nama) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Masukkan nama supir', variant: 'warning' });
            return;
        }
        if (!formData.asal || !formData.tujuan) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Asal dan Tujuan wajib diisi', variant: 'warning' });
            return;
        }
        if (!formData.harga_jual || !formData.harga_beli) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Harga Beli dan Jual wajib diisi', variant: 'warning' });
            return;
        }

        try {
            setSubmitting(true);

            const payload: any = {
                ...formData,
                status_bayar: formData.status_bayar?.toUpperCase(),
                metode_bayar: formData.metode_bayar?.toUpperCase(),
                supir_id: driverMode === 'registered' ? parseInt(formData.supir_id) : undefined,
                supir_nama: driverMode === 'manual' ? formData.supir_nama : undefined,
                ritase: parseInt(formData.ritase) || 1,
                harga_beli: parseNumber(formData.harga_beli),
                harga_jual: parseNumber(formData.harga_jual),
                pendapatan_kotor: calculations.revenue,
                biaya_operasional: operationalCosts
                    .filter(c => c.deskripsi && c.jumlah)
                    .map(c => ({
                        deskripsi: c.deskripsi,
                        jumlah: parseNumber(c.jumlah)
                    })),
                persentase_tpm: 50
            };

            if (isEditMode) {
                await jasaAngkutService.updateMuatan(initialData.id, payload);
            } else {
                await jasaAngkutService.createMuatan(payload);
            }

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: isEditMode ? 'Data muatan berhasil diperbarui' : 'Data muatan berhasil disimpan',
                variant: 'success'
            });

            setTimeout(() => {
                onSuccess?.();
            }, 1500);
        } catch (error: any) {
            setDialogConfig({
                visible: true,
                title: 'Gagal Menyimpan',
                message: getErrorMessage(error, 'Terjadi kesalahan saat menyimpan data'),
                variant: 'error'
            });
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const renderFormContent = () => (
        <View className="p-6 pb-24">
            <Typography variant="h2" weight="bold" className="mb-6">{isEditMode ? 'Edit Muatan' : 'Input Muatan Baru'}</Typography>

            {/* Driver Section */}
            <View className="flex-row items-center justify-between mb-2">
                <Typography variant="caption" weight="medium">Identitas Supir *</Typography>
                <View className="flex-row bg-gray-100 rounded-lg p-1">
                    <TouchableOpacity
                        onPress={() => setDriverMode('registered')}
                        className={`px-3 py-1 rounded-md ${driverMode === 'registered' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Typography variant="caption" weight={driverMode === 'registered' ? 'bold' : 'normal'}>Terdaftar</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDriverMode('manual')}
                        className={`px-3 py-1 rounded-md ${driverMode === 'manual' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Typography variant="caption" weight={driverMode === 'manual' ? 'bold' : 'normal'}>Manual</Typography>
                    </TouchableOpacity>
                </View>
            </View>

            {driverMode === 'registered' ? (
                loadingDrivers ? (
                    <ActivityIndicator className="my-4" />
                ) : (
                    <View className="flex-row flex-wrap mb-4">
                        {activeDrivers.map(d => (
                            <TouchableOpacity
                                key={d.id}
                                onPress={() => updateField('supir_id', d.id.toString())}
                                className={`px-4 py-2 rounded-full mr-2 mb-2 border ${formData.supir_id === d.id.toString()
                                    ? 'bg-primary border-primary'
                                    : 'bg-white border-gray-200'
                                    }`}
                            >
                                <Typography
                                    variant="caption"
                                    weight={formData.supir_id === d.id.toString() ? 'bold' : 'medium'}
                                    className={formData.supir_id === d.id.toString() ? 'text-white' : 'text-gray-600'}
                                >
                                    {d.nama}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                )
            ) : (
                <Input
                    label="Nama Supir"
                    placeholder="Masukkan nama supir"
                    value={formData.supir_nama}
                    onChangeText={v => updateField('supir_nama', v)}
                />
            )}

            <Input
                label="Nomor Polisi (Plat)"
                placeholder="Contoh: B 1234 AB"
                value={formData.nopol}
                onChangeText={v => updateField('nopol', v)}
            />

            <View className="h-[1px] bg-gray-100 my-4" />

            <Input
                label="Tanggal"
                value={formData.tanggal}
                onChangeText={v => updateField('tanggal', v)}
            />

            <View className="flex-row space-x-2">
                <View className="flex-1">
                    <Input
                        label="Asal *"
                        placeholder="Kota asal"
                        value={formData.asal}
                        onChangeText={v => updateField('asal', v)}
                    />
                </View>
                <View className="flex-1">
                    <Input
                        label="Tujuan *"
                        placeholder="Kota tujuan"
                        value={formData.tujuan}
                        onChangeText={v => updateField('tujuan', v)}
                    />
                </View>
            </View>

            <View className="flex-row space-x-2">
                <View className="flex-[2]">
                    <Input
                        label="Jenis Muatan"
                        placeholder="Contoh: Pasir"
                        value={formData.jenis_muatan}
                        onChangeText={v => updateField('jenis_muatan', v)}
                    />
                </View>
                <View className="flex-1">
                    <Input
                        label="Ritase"
                        keyboardType="numeric"
                        value={formData.ritase}
                        onChangeText={v => updateField('ritase', v)}
                    />
                </View>
            </View>

            {/* Financials */}
            <Typography variant="caption" weight="bold" className="mb-2 text-gray-500 mt-2">KEUANGAN & MARGIN</Typography>
            <View className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <View className="flex-row space-x-2">
                    <View className="flex-1">
                        <Input
                            label="Harga Beli (Modal)"
                            keyboardType="numeric"
                            placeholder="0"
                            value={formData.harga_beli}
                            onChangeText={v => updateField('harga_beli', v)}
                            containerClassName="mb-0"
                            className="bg-white"
                        />
                    </View>
                    <View className="flex-1">
                        <Input
                            label="Harga Jual"
                            keyboardType="numeric"
                            placeholder="0"
                            value={formData.harga_jual}
                            onChangeText={v => updateField('harga_jual', v)}
                            containerClassName="mb-0"
                            className="bg-white"
                        />
                    </View>
                </View>
                <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-blue-200">
                    <Typography variant="caption">Estimasi Pendapatan (Margin)</Typography>
                    <Typography weight="bold" className={calculations.revenue >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(calculations.revenue)}
                    </Typography>
                </View>
            </View>

            {/* Status & Metode Pembayaran */}
            <Typography variant="caption" weight="bold" className="mb-2 text-gray-500 mt-4">PEMBAYARAN</Typography>
            <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                <View className="flex-row justify-between items-center mb-4">
                    <Typography variant="body2">Status Pembayaran</Typography>
                    <View className="flex-row bg-white rounded-lg p-1 border border-gray-200">
                        <TouchableOpacity
                            onPress={() => updateField('status_bayar', 'BELUM_LUNAS')}
                            className={`px-4 py-1.5 rounded-md ${formData.status_bayar === 'BELUM_LUNAS' ? 'bg-orange-100' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight={formData.status_bayar === 'BELUM_LUNAS' ? 'bold' : 'medium'}
                                className={formData.status_bayar === 'BELUM_LUNAS' ? 'text-orange-700' : 'text-gray-500'}
                            >
                                BELUM_LUNAS
                            </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => updateField('status_bayar', 'LUNAS')}
                            className={`px-4 py-1.5 rounded-md ${formData.status_bayar === 'LUNAS' ? 'bg-green-100' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight={formData.status_bayar === 'LUNAS' ? 'bold' : 'medium'}
                                className={formData.status_bayar === 'LUNAS' ? 'text-green-700' : 'text-gray-500'}
                            >
                                Lunas
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                {formData.status_bayar === 'LUNAS' && (
                    <View>
                        <Typography variant="caption" className="mb-2 text-gray-500">Metode Pembayaran</Typography>
                        <View className="flex-row space-x-2">
                            {['TUNAI', 'TRANSFER'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => updateField('metode_bayar', m)}
                                    className={`flex-1 py-2 items-center rounded-lg border ${formData.metode_bayar === m ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}
                                >
                                    <Typography
                                        className={formData.metode_bayar === m ? 'text-green-700 uppercase' : 'text-gray-500 uppercase'}
                                        weight={formData.metode_bayar === m ? 'bold' : 'medium'}
                                        variant="caption"
                                    >
                                        {m}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            <View className="flex-row justify-between items-center mb-2">
                <Typography variant="caption" weight="bold" className="text-gray-500">BIAYA OPERASIONAL (DINAMIS)</Typography>
                <TouchableOpacity onPress={addCost}>
                    <Typography variant="caption" weight="bold" className="text-primary">+ Tambah Item</Typography>
                </TouchableOpacity>
            </View>

            <View className="space-y-2 mb-4">
                {operationalCosts.map((item, index) => (
                    <View key={index} className="flex-row space-x-2 items-center">
                        <View className="flex-[2]">
                            <Input
                                placeholder="Deskripsi (ex: BBM)"
                                value={item.deskripsi}
                                onChangeText={v => updateCost(index, 'deskripsi', v)}
                                containerClassName="mb-0"
                            />
                        </View>
                        <View className="flex-1">
                            <Input
                                placeholder="Rp 0"
                                keyboardType="numeric"
                                value={item.jumlah}
                                onChangeText={v => updateCost(index, 'jumlah', v)}
                                containerClassName="mb-0"
                            />
                        </View>
                        <TouchableOpacity onPress={() => removeCost(index)} className="p-2 bg-red-50 rounded-full">
                            <Text className="text-red-500 font-bold">X</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            <View className="h-[1px] bg-gray-200 my-6" />

            {/* Live Profit Split */}
            <ProfitSplitCard
                revenue={calculations.revenue}
                totalCosts={calculations.totalCosts}
            />

            <Button
                title={submitting ? (isEditMode ? "Memperbarui..." : "Menyimpan...") : (isEditMode ? "Update Muatan" : "Simpan Muatan")}
                onPress={handleSubmit}
                disabled={submitting}
                loading={submitting}
                className="mt-4"
            />

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig(p => ({ ...p, visible: false }))}
            />
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View style={styles.webContainer}>
                <ScrollView style={styles.flex1} showsVerticalScrollIndicator={true}>
                    {renderFormContent()}
                </ScrollView>
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
                <BottomSheetScrollView
                    style={styles.flex1}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                >
                    {renderFormContent()}
                </BottomSheetScrollView>
            </View>
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
