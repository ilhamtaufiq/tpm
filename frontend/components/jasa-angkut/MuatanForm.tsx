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
import { Plus, Trash2, Truck, PlusCircle } from 'lucide-react-native';
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
        armada_id: '',
        nopol: '',
        info_kendaraan: '',
        asal: '',
        tujuan: '',
        jenis_muatan_list: [''], // Multiple load types
        ritase: '1',
        harga_beli: '',
        harga_jual: '',
        status_bayar: 'BELUM_LUNAS',
        metode_bayar: 'TUNAI',
        catatan: ''
    });

    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; jumlah: string }[]>([]);

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

    const [activeArmada, setActiveArmada] = useState<any[]>([]);
    const [loadingArmada, setLoadingArmada] = useState(true);
    const [armadaMode, setArmadaMode] = useState<'registered' | 'manual'>('registered');

    const [driverSearch, setDriverSearch] = useState('');
    const [armadaSearch, setArmadaSearch] = useState('');

    useEffect(() => {
        loadDrivers();
        loadArmada();
    }, []);

    // Initialize form with edit data
    useEffect(() => {
        if (initialData) {
            setFormData({
                tanggal: initialData.tanggal?.split('T')[0] || new Date().toISOString().split('T')[0],
                supir_id: initialData.supir_id?.toString() || '',
                supir_nama: initialData.supir_nama || initialData.supir_nama_manual || '',
                armada_id: initialData.armada_id?.toString() || '',
                nopol: initialData.nopol || '',
                info_kendaraan: initialData.info_kendaraan || '',
                asal: initialData.asal || '',
                tujuan: initialData.tujuan || '',
                jenis_muatan_list: initialData.jenis_muatan ? initialData.jenis_muatan.split(', ') : [''],
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
            } else {
                setDriverMode('manual');
            }

            if (initialData.armada_id) {
                setArmadaMode('registered');
            } else {
                setArmadaMode('manual');
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

    const loadArmada = async () => {
        try {
            const data = await jasaAngkutService.getActiveArmada();
            setActiveArmada(data);
        } catch (e) {
            console.error('Failed to load armada:', e);
        } finally {
            setLoadingArmada(false);
        }
    };

    const updateField = (key: string, value: string) => {
        if (['harga_beli', 'harga_jual'].includes(key)) {
            setFormData(prev => ({ ...prev, [key]: formatNumber(value) }));
        } else if (key === 'supir_id') {
            const selectedSupir = activeDrivers.find(d => d.id.toString() === value);
            setFormData(prev => ({
                ...prev,
                [key]: value,
                // Only auto-fill if not already edited or if supir has default armada
                armada_id: selectedSupir?.armada_default_id?.toString() || prev.armada_id,
                nopol: selectedSupir?.nopol_kendaraan || prev.nopol,
                info_kendaraan: selectedSupir?.info_kendaraan || prev.info_kendaraan
            }));
        } else if (key === 'armada_id') {
            const selectedArmada = activeArmada.find(a => a.id.toString() === value);
            setFormData(prev => ({
                ...prev,
                [key]: value,
                nopol: selectedArmada?.nopol || prev.nopol,
                info_kendaraan: selectedArmada?.nama || prev.info_kendaraan
            }));
        } else {
            setFormData(prev => ({ ...prev, [key]: value }));
        }
    };

    const addPaymentRow = () => {
        setPayments([...payments, { id: Date.now(), metode: 'TUNAI', jumlah: '' }]);
    };

    const removePaymentRow = (id: number) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const updatePaymentRow = (id: number, field: string, value: string) => {
        setPayments(payments.map(p => {
            if (p.id === id) {
                return { ...p, [field]: field === 'jumlah' ? formatNumber(value) : value };
            }
            return p;
        }));
    };

    const totalSplitAmount = payments.reduce((acc, p) => acc + parseNumber(p.jumlah), 0);

    const toggleSplitPayment = () => {
        if (!isSplitPayment) {
            // Auto-fill with TPM Share for convenience
            const targetAmount = calculations.tpmShare > 0 ? formatNumber(calculations.tpmShare.toString()) : '';
            setPayments([{ id: Date.now(), metode: formData.metode_bayar, jumlah: targetAmount }]);
        } else {
            setPayments([]);
        }
        setIsSplitPayment(!isSplitPayment);
    };

    const calculations = useMemo((): { revenue: number; tpmShare: number; totalCosts: number; beli: number; jual: number; bengkelTotal: number } => {
        const beli = parseNumber(formData.harga_beli) || 0;
        const jual = parseNumber(formData.harga_jual) || 0;
        const revenue = jual - beli;
        const tpmShare = revenue * 0.5; // TPM share is 50% of the profit

        return { revenue, tpmShare, totalCosts: 0, beli, jual, bengkelTotal: 0 };
    }, [formData.harga_beli, formData.harga_jual]);

    const filteredDrivers = useMemo(() => {
        if (!driverSearch) return activeDrivers;
        const query = driverSearch.toLowerCase();
        return activeDrivers.filter(d =>
            d.nama.toLowerCase().includes(query) ||
            (d.kode && d.kode.toLowerCase().includes(query))
        );
    }, [activeDrivers, driverSearch]);

    const filteredArmada = useMemo(() => {
        if (!armadaSearch) return activeArmada;
        const query = armadaSearch.toLowerCase();
        return activeArmada.filter(a =>
            a.nama.toLowerCase().includes(query) ||
            a.nopol.toLowerCase().includes(query)
        );
    }, [activeArmada, armadaSearch]);

    const updateJenisMuatan = (index: number, value: string) => {
        const newList = [...formData.jenis_muatan_list];
        newList[index] = value;
        setFormData(prev => ({ ...prev, jenis_muatan_list: newList }));
    };

    const addJenisMuatan = () => {
        setFormData(prev => ({ ...prev, jenis_muatan_list: [...prev.jenis_muatan_list, ''] }));
    };

    const removeJenisMuatan = (index: number) => {
        const newList = [...formData.jenis_muatan_list];
        newList.splice(index, 1);
        setFormData(prev => ({ ...prev, jenis_muatan_list: newList.length > 0 ? newList : [''] }));
    };

    const handleSubmit = async () => {
        if (armadaMode === 'registered' && !formData.armada_id) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih armada terlebih dahulu', variant: 'warning' });
            return;
        }
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
                jenis_muatan: formData.jenis_muatan_list.filter(item => item.trim() !== '').join(', '),
                status_bayar: formData.status_bayar?.toUpperCase(),
                metode_bayar: isSplitPayment ? 'SPLIT' : formData.metode_bayar?.toUpperCase(),
                supir_id: driverMode === 'registered' ? parseInt(formData.supir_id) : undefined,
                supir_nama: driverMode === 'manual' ? formData.supir_nama : undefined,
                armada_id: armadaMode === 'registered' ? parseInt(formData.armada_id) : undefined,
                ritase: parseInt(formData.ritase) || 1,
                harga_beli: parseNumber(formData.harga_beli),
                harga_jual: parseNumber(formData.harga_jual),
                pendapatan_kotor: calculations.revenue,
                biaya_operasional: [],
                payments: isSplitPayment ? payments.map(p => ({
                    metode: p.metode,
                    nominal: parseNumber(p.jumlah)
                })).filter(p => p.nominal > 0) : [],
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

            {/* Armada Section (Moved to First) */}
            <View className="flex-row items-center justify-between mb-2 mt-4">
                <Typography variant="caption" weight="medium">Identitas Armada *</Typography>
                <View className="flex-row bg-gray-100 rounded-lg p-1">
                    <TouchableOpacity
                        onPress={() => setArmadaMode('registered')}
                        className={`px-3 py-1 rounded-md ${armadaMode === 'registered' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Typography variant="caption" weight={armadaMode === 'registered' ? 'bold' : 'normal'}>Terdaftar</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setArmadaMode('manual')}
                        className={`px-3 py-1 rounded-md ${armadaMode === 'manual' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Typography variant="caption" weight={armadaMode === 'manual' ? 'bold' : 'normal'}>Manual</Typography>
                    </TouchableOpacity>
                </View>
            </View>

            {armadaMode === 'registered' ? (
                loadingArmada ? (
                    <ActivityIndicator className="my-4" />
                ) : (
                    <View>
                        {formData.armada_id ? (
                            <View className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                                <View className="flex-row justify-between items-center mb-3">
                                    <View>
                                        <Typography weight="bold" className="text-blue-900">
                                            {activeArmada.find(a => a.id.toString() === formData.armada_id)?.nama}
                                        </Typography>
                                        <Typography variant="caption" className="text-blue-700 font-bold">
                                            {activeArmada.find(a => a.id.toString() === formData.armada_id)?.nopol}
                                        </Typography>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => {
                                            updateField('armada_id', '');
                                            setArmadaSearch('');
                                        }}
                                        className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-100"
                                    >
                                        <Typography variant="caption" weight="bold" className="text-blue-600">Ganti Armada</Typography>
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row space-x-2">
                                    <View className="flex-1">
                                        <Typography variant="caption" className="text-gray-400 uppercase font-bold mb-1 text-[9px]">Nopol</Typography>
                                        <Typography variant="caption" weight="bold">{formData.nopol}</Typography>
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="caption" className="text-gray-400 uppercase font-bold mb-1 text-[9px]">Info</Typography>
                                        <Typography variant="caption" weight="bold">{formData.info_kendaraan}</Typography>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Input
                                    placeholder="Cari armada (nama atau nopol)..."
                                    value={armadaSearch}
                                    onChangeText={setArmadaSearch}
                                    containerClassName="mb-3"
                                    className="h-11 shadow-sm"
                                    startIcon={<Truck size={18} color="#94A3B8" />}
                                />
                                {armadaSearch.length > 0 && (
                                    <View className="flex-row flex-wrap mb-4">
                                        {filteredArmada.length > 0 ? (
                                            filteredArmada.map(a => (
                                                <TouchableOpacity
                                                    key={a.id}
                                                    onPress={() => {
                                                        updateField('armada_id', a.id.toString());
                                                        setArmadaSearch('');
                                                    }}
                                                    className="px-4 py-2.5 rounded-xl mr-2 mb-2 border border-gray-100 bg-gray-50"
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        weight="bold"
                                                        className="text-gray-700"
                                                    >
                                                        {a.nama} ({a.nopol})
                                                    </Typography>
                                                </TouchableOpacity>
                                            ))
                                        ) : (
                                            <Typography variant="caption" className="text-red-400 italic mb-4 ml-1">Armada '{armadaSearch}' tidak ditemukan</Typography>
                                        )}
                                    </View>
                                )}
                                {armadaSearch.length === 0 && (
                                    <Typography variant="caption" className="text-gray-400 mb-4 italic ml-1">Cari armada dari database...</Typography>
                                )}
                            </View>
                        )}
                    </View>
                )
            ) : (
                <View className="flex-row space-x-2">
                    <View className="flex-1">
                        <Input
                            label="Nomor Polisi"
                            placeholder="Plat nomor"
                            value={formData.nopol}
                            onChangeText={v => updateField('nopol', v)}
                        />
                    </View>
                    <View className="flex-[2]">
                        <Input
                            label="Info Armada"
                            placeholder="Contoh: CD Biru"
                            value={formData.info_kendaraan}
                            onChangeText={v => updateField('info_kendaraan', v)}
                        />
                    </View>
                </View>
            )}

            {/* Driver Section (Moved to Second) */}
            <View className="flex-row items-center justify-between mb-2 mt-4">
                <Typography variant="caption" weight="medium">Pilih Supir Handal *</Typography>
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
                    <View>
                        {formData.supir_id ? (
                            <View className="flex-row items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/10 mb-4">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center mr-3">
                                        <Typography weight="bold" className="text-primary">{activeDrivers.find(d => d.id.toString() === formData.supir_id)?.nama.charAt(0)}</Typography>
                                    </View>
                                    <View>
                                        <Typography weight="bold" className="text-textMain">
                                            {activeDrivers.find(d => d.id.toString() === formData.supir_id)?.nama}
                                        </Typography>
                                        <Typography variant="caption" className="text-textGray">Supir Terdaftar</Typography>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        updateField('supir_id', '');
                                        setDriverSearch('');
                                    }}
                                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100"
                                >
                                    <Typography variant="caption" weight="bold" className="text-primary">Ganti</Typography>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Input
                                    placeholder="Ketik nama supir..."
                                    value={driverSearch}
                                    onChangeText={setDriverSearch}
                                    containerClassName="mb-3"
                                    className="h-11 shadow-sm"
                                    startIcon={<Truck size={18} color="#94A3B8" />}
                                />
                                {driverSearch.length > 0 && (
                                    <View className="flex-row flex-wrap mb-4">
                                        {filteredDrivers.length > 0 ? (
                                            filteredDrivers.map(d => (
                                                <TouchableOpacity
                                                    key={d.id}
                                                    onPress={() => {
                                                        updateField('supir_id', d.id.toString());
                                                        setDriverSearch('');
                                                    }}
                                                    className="px-4 py-2.5 rounded-xl mr-2 mb-2 border border-gray-100 bg-gray-50 flex-row items-center"
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        weight="bold"
                                                        className="text-gray-700"
                                                    >
                                                        {d.nama}
                                                    </Typography>
                                                </TouchableOpacity>
                                            ))
                                        ) : (
                                            <Typography variant="caption" className="text-red-400 italic mb-4 ml-1">Supir '{driverSearch}' tidak ditemukan</Typography>
                                        )}
                                    </View>
                                )}
                                {driverSearch.length === 0 && (
                                    <Typography variant="caption" className="text-gray-400 mb-4 italic ml-1">Cari supir dari database...</Typography>
                                )}
                            </View>
                        )}
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

            <View className="h-[1px] bg-gray-100 my-4" />

            <Input
                label="Tanggal Transaksi"
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

            {/* Multiple Load Types UI */}
            <View className="flex-row justify-between items-center mb-2 mt-2">
                <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-widest">Jenis Muatan (Load Types)</Typography>
                <TouchableOpacity onPress={addJenisMuatan}>
                    <Typography variant="caption" weight="bold" className="text-primary">+ Tambah</Typography>
                </TouchableOpacity>
            </View>

            <View className="space-y-3 mb-4">
                {formData.jenis_muatan_list.map((item, index) => (
                    <View key={index} className="flex-row items-center space-x-2">
                        <View className="flex-1">
                            <Input
                                placeholder="Contoh: Pasir, Semen, Besi"
                                value={item}
                                onChangeText={v => updateJenisMuatan(index, v)}
                                containerClassName="mb-0"
                                className="h-11"
                            />
                        </View>
                        {formData.jenis_muatan_list.length > 1 && (
                            <TouchableOpacity
                                onPress={() => removeJenisMuatan(index)}
                                className="w-11 h-11 items-center justify-center bg-red-50 rounded-xl"
                            >
                                <Trash2 size={18} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>

            <View className="flex-row space-x-2">
                <View className="flex-1">
                    <Input
                        label="Ritase"
                        keyboardType="numeric"
                        value={formData.ritase}
                        onChangeText={v => updateField('ritase', v)}
                    />
                </View>
                <View className="flex-1">
                    {/* Empty placeholder or other field */}
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
                    <Typography variant="caption">Total Margin</Typography>
                    <Typography weight="bold" className={calculations.revenue >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(calculations.revenue)}
                    </Typography>
                </View>
                <View className="flex-row justify-between items-center mt-1">
                    <Typography variant="caption" className="text-blue-600 font-bold italic">Share TPM (50%)</Typography>
                    <Typography weight="bold" className="text-blue-700">
                        {formatCurrency(calculations.tpmShare)}
                    </Typography>
                </View>
            </View>

            {/* Status & Metode Pembayaran */}
            <View className="flex-row items-center justify-between mb-2 mt-4">
                <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-widest">PEMBAYARAN Muatan</Typography>
                <TouchableOpacity
                    onPress={toggleSplitPayment}
                    className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                >
                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                        {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                    </Typography>
                </TouchableOpacity>
            </View>

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
                        {isSplitPayment ? (
                            <View className="mb-2">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Typography variant="caption" weight="bold" className="text-gray-400 font-bold">ALOKASI PEMBAYARAN</Typography>
                                    <TouchableOpacity onPress={addPaymentRow} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl">
                                        <PlusCircle size={14} color="#023C69" />
                                        <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                                    </TouchableOpacity>
                                </View>

                                {payments.map((p, idx) => (
                                    <View key={p.id} className="mb-3 p-3 border border-gray-100 rounded-2xl bg-white shadow-sm">
                                        <View className="flex-row justify-between items-center mb-3">
                                            <Typography variant="caption" weight="bold" className="text-primary">Metode #{idx + 1}</Typography>
                                            <TouchableOpacity onPress={() => removePaymentRow(p.id)} className="w-6 h-6 items-center justify-center bg-red-50 rounded-full">
                                                <Trash2 size={12} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>

                                        <View className="flex-row flex-wrap gap-2 mb-3">
                                            {['TUNAI', 'TRANSFER'].map((m) => (
                                                <TouchableOpacity
                                                    key={m}
                                                    onPress={() => updatePaymentRow(p.id, 'metode', m)}
                                                    className={`px-3 py-1.5 rounded-xl border ${p.metode === m ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                                >
                                                    <Typography variant="caption" weight={p.metode === m ? 'bold' : 'medium'} className={p.metode === m ? 'text-primary' : 'text-gray-500'}>{m}</Typography>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Input
                                            placeholder="Nominal Rp"
                                            keyboardType="numeric"
                                            value={p.jumlah}
                                            containerClassName="mb-0"
                                            className="h-10"
                                            onChangeText={(t) => updatePaymentRow(p.id, 'jumlah', t)}
                                        />
                                    </View>
                                ))}

                                <View className="flex-row justify-between items-center p-3 bg-primary/5 rounded-xl mt-2 border border-primary/10">
                                    <View>
                                        <Typography variant="caption" weight="bold" className="text-primary">TOTAL BAYAR</Typography>
                                        <Typography variant="caption" className="text-primary/70 text-[8px] font-bold">(TARGET: SHARE TPM 50%)</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography weight="bold" className="text-primary">{formatCurrency(totalSplitAmount)}</Typography>
                                        {totalSplitAmount !== calculations.tpmShare && (
                                            <Typography variant="caption" className="text-red-500 font-bold" style={{ fontSize: 9 }}>
                                                {totalSplitAmount < calculations.tpmShare ? `Kurang: ${formatCurrency(calculations.tpmShare - totalSplitAmount)}` : `Lebih: ${formatCurrency(totalSplitAmount - calculations.tpmShare)}`}
                                            </Typography>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ) : (
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
                )}
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
