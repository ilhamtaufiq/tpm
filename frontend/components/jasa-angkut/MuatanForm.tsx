import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Alert, Text, ScrollView, Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { TouchableOpacity as Pressable } from 'react-native-gesture-handler';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProfitSplitCard } from './ProfitSplitCard';
import { jasaAngkutService, Supir, Armada } from '../../services/jasaAngkut';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import { Plus, Trash2, Truck, PlusCircle, MapPin, ArrowRight } from 'lucide-react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AlertDialog } from '../ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { onlineManager } from '@tanstack/react-query';
import {
    useActiveArmada,
    useActiveSupir,
    usePayMuatanSplit,
    useRouteSuggestions
} from '../../hooks/useJasaAngkut';

interface MuatanFormProps {
    onSuccess?: () => void;
    initialData?: any; // Data for edit mode
}

const MAX_SUGGESTIONS = 5;

export const MuatanForm = ({ onSuccess, initialData }: MuatanFormProps) => {
    const isEditMode = !!initialData;
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        supir_id: '',
        supir_nama: '', // Manual name
        armada_id: '',
        nopol: '',
        info_kendaraan: '',
        jenis_muatan_list: [{ jenis: '', ritase: '1', harga_beli: '', harga_jual: '', asal: '', tujuan: '' }], // Multiple load types with individual prices
        ritase: '1',
        harga_beli: '',
        harga_jual: '',
        status_bayar: 'BELUM_LUNAS',
        status: 'PROSES',
        metode_bayar: 'TUNAI',
        catatan: ''
    });

    // Hooks for data fetching
    const { data: activeArmada = [], isLoading: loadingArmada } = useActiveArmada(formData.tanggal);
    const { data: activeDrivers = [], isLoading: loadingDrivers } = useActiveSupir();
    const [activeSuggestionField, setActiveSuggestionField] = useState<{ index: number; field: 'asal' | 'tujuan' } | null>(null);
    const suggestionQuery = useMemo(() => {
        if (!activeSuggestionField) return '';
        return formData.jenis_muatan_list[activeSuggestionField.index][activeSuggestionField.field] || '';
    }, [activeSuggestionField, formData.jenis_muatan_list]);

    const { data: suggestions = [] } = useRouteSuggestions(activeSuggestionField?.field || 'asal', suggestionQuery);

    const [driverSearch, setDriverSearch] = useState('');
    const [armadaSearch, setArmadaSearch] = useState('');

    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; jumlah: string }[]>([]);

    const readyArmada = useMemo(() => {
        return (activeArmada as Armada[]).filter(a => a.is_ready || a.id.toString() === formData.armada_id).slice(0, 5);
    }, [activeArmada, formData.armada_id]);

    const readyDrivers = useMemo(() => {
        return (activeDrivers as Supir[]).filter(d => d.is_ready || d.id.toString() === formData.supir_id).slice(0, 5);
    }, [activeDrivers, formData.supir_id]);

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
                jenis_muatan_list: initialData.jenis_muatan ?
                    initialData.jenis_muatan.split(', ').map((item: string) => {
                        // Match format: [Asal -> Tujuan] Jenis (1 Rit) @ Rp 1.000 / Rp 1.500
                        const match = item.match(/\[(.*?) -> (.*?)\]\s+(.*?)\s\((\d+)\sRit\)(?:\s@\sRp\s([\d.,]+)(?:\s\/\sRp\s([\d.,]+))?)?/);
                        if (match) return {
                            asal: match[1]?.trim(),
                            tujuan: match[2]?.trim(),
                            jenis: match[3]?.trim(),
                            ritase: match[4],
                            harga_beli: match[5] || '',
                            harga_jual: match[6] || ''
                        };

                        // Fallback for old format
                        const oldMatch = item.match(/(.+?)\s\((\d+)\sRit\)(?:\s@\sRp\s([\d.,]+)(?:\s\/\sRp\s([\d.,]+))?)?/);
                        if (oldMatch) return {
                            asal: initialData.asal || '',
                            tujuan: initialData.tujuan || '',
                            jenis: oldMatch[1]?.trim(),
                            ritase: oldMatch[2],
                            harga_beli: oldMatch[3] || '',
                            harga_jual: oldMatch[4] || ''
                        };

                        return {
                            jenis: item,
                            ritase: '1',
                            harga_beli: '',
                            harga_jual: '',
                            asal: initialData.asal || '',
                            tujuan: initialData.tujuan || ''
                        };
                    }) : [{ jenis: '', ritase: '1', harga_beli: '', harga_jual: '', asal: '', tujuan: '' }],
                ritase: initialData.ritase?.toString() || '1',
                harga_beli: formatNumber(initialData.harga_beli?.toString() || ''),
                harga_jual: formatNumber(initialData.harga_jual?.toString() || ''),
                status_bayar: initialData.status_bayar === 'LUNAS' ? 'LUNAS' : 'BELUM_LUNAS',
                status: initialData.status || 'PROSES',
                metode_bayar: initialData.metode_bayar?.toUpperCase() || 'TUNAI',
                catatan: initialData.catatan || ''
            });

        }
    }, [initialData]);

    // Sync total ritase, harga_beli, and harga_jual
    useEffect(() => {
        const totalRitase = formData.jenis_muatan_list.reduce((acc, item) => acc + (parseInt(item.ritase) || 0), 0);
        const totalHargaBeli = formData.jenis_muatan_list.reduce((acc, item) =>
            acc + (parseNumber(item.ritase) || 0) * (parseNumber(item.harga_beli) || 0), 0);
        const totalHargaJual = formData.jenis_muatan_list.reduce((acc, item) =>
            acc + (parseNumber(item.ritase) || 0) * (parseNumber(item.harga_jual) || 0), 0);

        let updates: any = {};

        if (totalRitase > 0 && totalRitase.toString() !== formData.ritase) {
            updates.ritase = totalRitase.toString();
        }

        const formattedBeli = formatNumber(totalHargaBeli.toString());
        if (formattedBeli !== formData.harga_beli) {
            updates.harga_beli = formattedBeli;
        }

        const formattedJual = formatNumber(totalHargaJual.toString());
        if (formattedJual !== formData.harga_jual) {
            updates.harga_jual = formattedJual;
        }

        if (Object.keys(updates).length > 0) {
            setFormData(prev => ({ ...prev, ...updates }));
        }
    }, [formData.jenis_muatan_list]);

    const updateField = (key: string, value: string) => {
        if (['harga_beli', 'harga_jual'].includes(key)) {
            setFormData(prev => ({ ...prev, [key]: formatNumber(value) }));
        } else if (key === 'supir_id') {
            const selectedSupir = (activeDrivers as Supir[]).find((d: Supir) => d.id.toString() === value);
            setFormData(prev => ({
                ...prev,
                [key]: value,
                // Only auto-fill if not already edited or if supir has default armada
                armada_id: selectedSupir?.armada_default_id?.toString() || prev.armada_id,
                nopol: selectedSupir?.nopol_kendaraan || prev.nopol,
                info_kendaraan: selectedSupir?.info_kendaraan || prev.info_kendaraan
            }));
        } else if (key === 'armada_id') {
            const selectedArmada = (activeArmada as Armada[]).find((a: Armada) => a.id.toString() === value);
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
        setPayments([...payments, { id: Date.now(), metode: '', jumlah: '' }]);
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
            setPayments([{ id: Date.now(), metode: formData.metode_bayar || '', jumlah: targetAmount }]);
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
        if (!driverSearch) return activeDrivers as Supir[];
        const query = driverSearch.toLowerCase();
        return (activeDrivers as Supir[]).filter((d: Supir) =>
            d.nama.toLowerCase().includes(query) ||
            (d.kode && d.kode.toLowerCase().includes(query))
        );
    }, [activeDrivers, driverSearch]);

    const filteredArmada = useMemo(() => {
        // Filter only ready armadas, but include the one currently selected in this form
        const armadas = (activeArmada as Armada[]).filter((a: Armada) => a.is_ready || a.id.toString() === formData.armada_id);

        if (!armadaSearch) return armadas;
        const query = armadaSearch.toLowerCase();
        return armadas.filter((a: Armada) =>
            a.nama.toLowerCase().includes(query) ||
            a.nopol.toLowerCase().includes(query)
        );
    }, [activeArmada, armadaSearch, formData.armada_id]);

    const updateJenisMuatan = (index: number, field: 'jenis' | 'ritase' | 'harga_beli' | 'harga_jual' | 'asal' | 'tujuan', value: string) => {
        const newList = [...formData.jenis_muatan_list];
        newList[index] = {
            ...newList[index],
            [field]: (field === 'harga_beli' || field === 'harga_jual') ? formatNumber(value) : value
        };
        setFormData(prev => ({ ...prev, jenis_muatan_list: newList }));

        if (field === 'asal' || field === 'tujuan') {
            setActiveSuggestionField({ index, field });
        }
    };

    const addJenisMuatan = () => {
        const lastItem = formData.jenis_muatan_list[formData.jenis_muatan_list.length - 1];
        setFormData(prev => ({
            ...prev,
            jenis_muatan_list: [...prev.jenis_muatan_list, {
                jenis: '',
                ritase: '1',
                harga_beli: '',
                harga_jual: '',
                asal: lastItem?.asal || '',
                tujuan: lastItem?.tujuan || ''
            }]
        }));
    };

    const removeJenisMuatan = (index: number) => {
        const newList = [...formData.jenis_muatan_list];
        newList.splice(index, 1);
        setFormData(prev => ({ ...prev, jenis_muatan_list: newList.length > 0 ? newList : [{ jenis: '', ritase: '1', harga_beli: '', harga_jual: '', asal: '', tujuan: '' }] }));
    };

    const handleSubmit = async () => {
        if (!formData.armada_id) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih armada terlebih dahulu', variant: 'warning' });
            return;
        }
        if (!formData.supir_id) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih supir terlebih dahulu', variant: 'warning' });
            return;
        }
        const hasInvalidRoute = formData.jenis_muatan_list.some(item => !item.asal || !item.tujuan);
        if (hasInvalidRoute) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Setiap muatan wajib memiliki Asal dan Tujuan', variant: 'warning' });
            return;
        }

        if (formData.status_bayar === 'LUNAS') {
            if (!isSplitPayment && !formData.metode_bayar) {
                setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih metode pembayaran', variant: 'warning' });
                return;
            }
            if (isSplitPayment) {
                const hasEmptyMethod = payments.some(p => !p.metode || parseNumber(p.jumlah) <= 0);
                if (hasEmptyMethod) {
                    setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih metode pembayaran untuk semua nominal', variant: 'warning' });
                    return;
                }
            }
        }

        if (!formData.harga_jual || !formData.harga_beli) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Harga Beli dan Jual wajib diisi', variant: 'warning' });
            return;
        }

        try {
            setSubmitting(true);

            const payload: any = {
                tanggal: formData.tanggal,
                supir_id: parseInt(formData.supir_id),
                armada_id: parseInt(formData.armada_id),
                nopol: formData.nopol,
                info_kendaraan: formData.info_kendaraan,
                catatan: formData.catatan,
                status: formData.status,
                status_bayar: formData.status_bayar?.toUpperCase(),
                metode_bayar: isSplitPayment ? 'SPLIT' : (formData.metode_bayar?.toUpperCase() || 'TUNAI'),
                asal: formData.jenis_muatan_list[0]?.asal || '',
                tujuan: formData.jenis_muatan_list[0]?.tujuan || '',
                jenis_muatan: formData.jenis_muatan_list
                    .filter(item => item.jenis.trim() !== '')
                    .map(item => {
                        const hargaBeliStr = item.harga_beli ? `@ Rp ${item.harga_beli}` : '';
                        const hargaJualStr = item.harga_jual ? ` / Rp ${item.harga_jual}` : '';
                        return `[${item.asal} -> ${item.tujuan}] ${item.jenis} (${item.ritase} Rit) ${hargaBeliStr}${hargaJualStr}`.replace(/\s+/g, ' ').trim();
                    })
                    .join(', '),
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

            if (!onlineManager.isOnline()) {
                if (isEditMode) {
                    jasaAngkutService.updateMuatan(initialData.id, payload);
                } else {
                    jasaAngkutService.createMuatan(payload);
                }

                setDialogConfig({
                    visible: true,
                    title: 'Offline Mode',
                    message: isEditMode ? 'Update muatan telah disimpan di antrean offline.' : 'Muatan baru telah disimpan di antrean offline.',
                    variant: 'info'
                });

                setTimeout(() => {
                    onSuccess?.();
                }, 1500);
                return;
            }

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

            {/* Armada Section */}
            <Typography variant="caption" weight="medium" className="mb-2 mt-4">Identitas Armada *</Typography>

            {
                loadingArmada ? (
                    <ActivityIndicator className="my-4" />
                ) : (
                    <View>
                        {formData.armada_id ? (
                            <View className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                                <View className="flex-row justify-between items-center mb-3">
                                    <View>
                                        <Typography weight="bold" className="text-blue-900">
                                            {(activeArmada as Armada[]).find((a: Armada) => a.id.toString() === formData.armada_id)?.nama}
                                        </Typography>
                                        <Typography variant="caption" className="text-blue-700 font-bold">
                                            {(() => {
                                                const a = (activeArmada as Armada[]).find((x: Armada) => x.id.toString() === formData.armada_id);
                                                return a ? `${a.nopol} ${a.jenis ? `• ${a.jenis}` : ''}` : '';
                                            })()}
                                        </Typography>
                                    </View>
                                    <Pressable
                                        onPress={() => {
                                            updateField('armada_id', '');
                                            setArmadaSearch('');
                                        }}
                                        className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-100"
                                    >
                                        <Typography variant="caption" weight="bold" className="text-blue-600">Ganti Armada</Typography>
                                    </Pressable>
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
                                                <Pressable
                                                    key={a.id}
                                                    onPress={() => {
                                                        updateField('armada_id', a.id.toString());
                                                        setArmadaSearch('');
                                                    }}
                                                    className="px-4 py-2.5 rounded-xl mr-2 mb-2 border border-gray-100 bg-gray-50"
                                                >
                                                    <View>
                                                        <Typography
                                                            variant="caption"
                                                            weight="bold"
                                                            className="text-gray-700"
                                                        >
                                                            {a.nama}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            className="text-gray-400 font-bold text-[10px]"
                                                        >
                                                            {a.nopol} {a.jenis ? `• ${a.jenis}` : ''}
                                                        </Typography>
                                                    </View>
                                                </Pressable>
                                            ))
                                        ) : (
                                            <Typography variant="caption" className="text-red-400 italic mb-4 ml-1">Armada '{armadaSearch}' tidak ditemukan</Typography>
                                        )}
                                    </View>
                                )}
                                {armadaSearch.length === 0 && (
                                    <View>
                                        <Typography variant="caption" className="text-gray-400 font-bold mb-2 ml-1">Rekomendasi (Ready)</Typography>
                                        <View className="flex-row flex-wrap mb-2">
                                            {readyArmada.length > 0 ? (
                                                readyArmada.map(a => (
                                                    <Pressable
                                                        key={a.id}
                                                        onPress={() => {
                                                            updateField('armada_id', a.id.toString());
                                                            updateField('nopol', a.nopol);
                                                            updateField('info_kendaraan', a.jenis || '');
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg mr-2 mb-2 bg-blue-50"
                                                    >
                                                        <Typography variant="caption" weight="bold" className="text-blue-700">{a.nama}</Typography>
                                                        <Typography variant="caption" className="text-blue-500 font-bold text-[10px]">
                                                            {a.nopol} {a.jenis ? `• ${a.jenis}` : ''}
                                                        </Typography>
                                                    </Pressable>
                                                ))
                                            ) : (
                                                <Typography variant="caption" className="text-gray-400 italic mb-2 ml-1">Semua armada sedang bertugas</Typography>
                                            )}
                                        </View>
                                        <Typography variant="caption" className="text-gray-400 italic ml-1">Atau cari armada lain di atas...</Typography>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )
            }

            {/* Driver Section (Moved to Second) */}
            <Typography variant="caption" weight="medium" className="mb-2 mt-4">Pilih Supir Handal *</Typography>

            {
                loadingDrivers ? (
                    <ActivityIndicator className="my-4" />
                ) : (
                    <View>
                        {formData.supir_id ? (
                            <View className="flex-row items-center justify-between bg-primary/5 p-3 rounded-xl">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center mr-3">
                                        <Typography weight="bold" className="text-primary">{(activeDrivers as Supir[]).find((d: Supir) => d.id.toString() === formData.supir_id)?.nama.charAt(0)}</Typography>
                                    </View>
                                    <View>
                                        <Typography weight="bold" className="text-textMain">
                                            {(activeDrivers as Supir[]).find((d: Supir) => d.id.toString() === formData.supir_id)?.nama}
                                        </Typography>
                                        <Typography variant="caption" className="text-textGray">Supir Terdaftar</Typography>
                                    </View>
                                </View>
                                <Pressable
                                    onPress={() => {
                                        updateField('supir_id', '');
                                        setDriverSearch('');
                                    }}
                                    className="bg-white px-3 py-1.5 rounded-lg shadow-sm"
                                >
                                    <Typography variant="caption" weight="bold" className="text-primary">Ganti</Typography>
                                </Pressable>
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
                                            filteredDrivers.map((d: Supir) => (
                                                <Pressable
                                                    key={d.id}
                                                    onPress={() => {
                                                        updateField('supir_id', d.id.toString());
                                                        setDriverSearch('');
                                                    }}
                                                    className="px-4 py-2.5 rounded-xl mr-2 mb-2 bg-gray-50 flex-row items-center"
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        weight="bold"
                                                        className="text-gray-700"
                                                    >
                                                        {d.nama}
                                                    </Typography>
                                                </Pressable>
                                            ))
                                        ) : (
                                            <Typography variant="caption" className="text-red-400 italic mb-4 ml-1">Supir '{driverSearch}' tidak ditemukan</Typography>
                                        )}
                                    </View>
                                )}
                                {driverSearch.length === 0 && (
                                    <View>
                                        <Typography variant="caption" className="text-gray-400 font-bold mb-2 ml-1">Rekomendasi Supir (Ready)</Typography>
                                        <View className="flex-row flex-wrap mb-2">
                                            {readyDrivers.length > 0 ? (
                                                readyDrivers.map((d: Supir) => (
                                                    <Pressable
                                                        key={d.id}
                                                        onPress={() => {
                                                            updateField('supir_id', d.id.toString());
                                                            setDriverSearch('');
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg mr-2 mb-2 bg-emerald-50"
                                                    >
                                                        <Typography variant="caption" weight="bold" className="text-emerald-700">{d.nama}</Typography>
                                                    </Pressable>
                                                ))
                                            ) : (
                                                <Typography variant="caption" className="text-gray-400 italic mb-2 ml-1">Semua supir sedang bertugas</Typography>
                                            )}
                                        </View>
                                        <Typography variant="caption" className="text-gray-400 italic ml-1 text-[10px]">Atau cari supir lain di atas...</Typography>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )
            }

            <View className="mb-2">
                <Input
                    label="Tanggal Transaksi"
                    value={formData.tanggal}
                    onChangeText={v => updateField('tanggal', v)}
                />
            </View>

            {/* Multiple Load Types UI */}
            <View className="flex-row items-center justify-between mb-2 mt-4">
                <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-widest">Daftar Muatan (Rit & Harga)</Typography>
                <Pressable onPress={addJenisMuatan} className="flex-row items-center bg-primary/5 px-2 py-1 rounded-lg">
                    <Plus size={14} color="#023C69" />
                    <Typography variant="caption" weight="bold" className="text-primary ml-1">Tambah</Typography>
                </Pressable>
            </View>

            <View className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 mb-4">
                {formData.jenis_muatan_list.map((item, index) => (
                    <View key={index} className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 bg-primary/10 rounded-xl items-center justify-center mr-3">
                                    <Typography weight="bold" className="text-primary text-xs">{index + 1}</Typography>
                                </View>
                                <Typography variant="body1" weight="bold" className="text-gray-800">Detail Muatan</Typography>
                            </View>
                            {formData.jenis_muatan_list.length > 1 && (
                                <Pressable
                                    onPress={() => removeJenisMuatan(index)}
                                    className="w-8 h-8 items-center justify-center bg-red-50 rounded-full"
                                >
                                    <Trash2 size={14} color="#EF4444" />
                                </Pressable>
                            )}
                        </View>

                        <View className="flex-row gap-3 mb-4">
                            <View className="flex-[3]">
                                <Typography variant="caption" weight="bold" className="text-gray-400 mb-1.5 uppercase text-[10px] tracking-widest">Jenis Muatan</Typography>
                                <Input
                                    placeholder="Contoh: Pasir, Batu"
                                    value={item.jenis}
                                    onChangeText={v => updateJenisMuatan(index, 'jenis', v)}
                                    containerClassName="mb-0"
                                    className="h-12 bg-gray-50/50 border-gray-100"
                                />
                            </View>
                            <View className="flex-1">
                                <Typography variant="caption" weight="bold" className="text-gray-400 mb-1.5 uppercase text-[10px] tracking-widest text-center">Rit</Typography>
                                <Input
                                    placeholder="1"
                                    keyboardType="numeric"
                                    value={item.ritase}
                                    onChangeText={v => updateJenisMuatan(index, 'ritase', v)}
                                    containerClassName="mb-0"
                                    className="h-12 bg-gray-50/50 border-gray-100 text-left font-bold text-primary"
                                    style={{ textAlign: 'left' }}
                                />
                            </View>
                        </View>

                        <View className="mb-4 p-4 bg-gray-50 rounded-[24px]">
                            <Typography variant="caption" weight="bold" className="text-gray-400 mb-2 uppercase text-[10px] tracking-widest">Rute Pengiriman</Typography>
                            <View className="flex-row items-center gap-2">
                                <View className="flex-1">
                                    <Input
                                        placeholder="Asal"
                                        value={item.asal}
                                        onChangeText={v => updateJenisMuatan(index, 'asal', v)}
                                        containerClassName="mb-0"
                                        className="h-10 text-[12px] border-transparent"
                                        startIcon={<MapPin size={14} color="#023C69" />}
                                    />
                                </View>
                                <ArrowRight size={16} color="#CBD5E1" />
                                <View className="flex-1">
                                    <Input
                                        placeholder="Tujuan"
                                        value={item.tujuan}
                                        onChangeText={v => updateJenisMuatan(index, 'tujuan', v)}
                                        containerClassName="mb-0"
                                        className="h-10 text-[12px] border-transparent"
                                        startIcon={<MapPin size={14} color="#10B981" />}
                                    />
                                </View>
                            </View>

                            {activeSuggestionField?.index === index && suggestions.length > 0 && suggestions[0] !== item[activeSuggestionField.field] && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                                    {suggestions.map((suggestion, idx) => (
                                        <Pressable
                                            key={`${activeSuggestionField.field}-${idx}`}
                                            onPress={() => {
                                                updateJenisMuatan(index, activeSuggestionField.field, suggestion);
                                                setActiveSuggestionField(null);
                                            }}
                                            className="px-3 py-1.5 rounded-full mr-2 bg-white border border-gray-100 flex-row items-center shadow-sm"
                                        >
                                            <Typography variant="caption" weight="bold" className="text-primary text-[10px]">{suggestion}</Typography>
                                        </Pressable>
                                    ))}
                                    <Pressable
                                        onPress={() => setActiveSuggestionField(null)}
                                        className="px-2 py-1.5 rounded-lg bg-gray-100"
                                    >
                                        <Typography variant="caption" className="text-gray-400 text-[10px]">Tutup</Typography>
                                    </Pressable>
                                </ScrollView>
                            )}
                        </View>

                        <View className="flex-row gap-3 pt-4 border-t border-gray-50">
                            <View className="flex-1">
                                <Typography variant="caption" weight="bold" className="text-emerald-600 mb-1.5 uppercase text-[10px] tracking-widest">Harga Beli</Typography>
                                <Input
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={item.harga_beli}
                                    onChangeText={v => updateJenisMuatan(index, 'harga_beli', v)}
                                    containerClassName="mb-0"
                                    className="h-11 bg-emerald-50/30 border-emerald-50 text-emerald-700"
                                    startIcon={<Typography weight="bold" className="text-emerald-500 text-[10px]">Rp</Typography>}
                                />
                            </View>
                            <View className="flex-1">
                                <Typography variant="caption" weight="bold" className="text-primary mb-1.5 uppercase text-[10px] tracking-widest">Harga Jual</Typography>
                                <Input
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={item.harga_jual}
                                    onChangeText={v => updateJenisMuatan(index, 'harga_jual', v)}
                                    containerClassName="mb-0"
                                    className="h-11 bg-primary/5 border-primary/5 text-primary"
                                    startIcon={<Typography weight="bold" className="text-primary/40 text-[10px]">Rp</Typography>}
                                />
                            </View>
                        </View>
                    </View>
                ))}
            </View>

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
                            className="bg-white outline-none"
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
                            className="bg-white outline-none"
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

            {/* Status Ritase */}
            <View className="flex-row items-center justify-between mb-2 mt-4">
                <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-widest">Status Ritase (Trip Status)</Typography>
            </View>

            <View className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                <View className="flex-row justify-between items-center">
                    <Typography variant="body2">Status Perjalanan</Typography>
                    <View className="flex-row bg-white rounded-lg p-1 border border-blue-100">
                        <Pressable
                            onPress={() => updateField('status', 'PROSES')}
                            className={`px-4 py-1.5 rounded-md ${formData.status === 'PROSES' ? 'bg-blue-100' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight={formData.status === 'PROSES' ? 'bold' : 'medium'}
                                className={formData.status === 'PROSES' ? 'text-blue-700' : 'text-gray-500'}
                            >
                                PROSES
                            </Typography>
                        </Pressable>
                        <Pressable
                            onPress={() => updateField('status', 'SELESAI')}
                            className={`px-4 py-1.5 rounded-md ${formData.status === 'SELESAI' ? 'bg-green-100' : ''}`}
                        >
                            <Typography
                                variant="caption"
                                weight={formData.status === 'SELESAI' ? 'bold' : 'medium'}
                                className={formData.status === 'SELESAI' ? 'text-green-700' : 'text-gray-500'}
                            >
                                SELESAI
                            </Typography>
                        </Pressable>
                    </View>
                </View>
                <Typography variant="caption" className="text-gray-400 mt-2 italic text-[10px]">
                    * Armada tidak dapat digunakan di ritase lain selama status masih 'PROSES'
                </Typography>
            </View>

            {/* Status & Metode Pembayaran */}
            <View className="flex-row items-center justify-between mb-2 mt-4">
                <Typography variant="caption" weight="bold" className="text-gray-500 uppercase tracking-widest">PEMBAYARAN Muatan</Typography>
                <Pressable
                    onPress={toggleSplitPayment}
                    className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                >
                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                        {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                    </Typography>
                </Pressable>
            </View>

            <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                <View className="flex-row justify-between items-center mb-4">
                    <Typography variant="body2">Status Pembayaran</Typography>
                    <View className="flex-row bg-white rounded-lg p-1 border border-gray-200">
                        <Pressable
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
                        </Pressable>
                        <Pressable
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
                        </Pressable>
                    </View>
                </View>

                {formData.status_bayar === 'LUNAS' && (
                    <View>
                        {isSplitPayment ? (
                            <View className="mb-2">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Typography variant="caption" weight="bold" className="text-gray-400 font-bold">ALOKASI PEMBAYARAN</Typography>
                                    <Pressable onPress={addPaymentRow} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl">
                                        <PlusCircle size={14} color="#023C69" />
                                        <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                                    </Pressable>
                                </View>

                                {payments.map((p, idx) => (
                                    <View key={p.id} className="mb-3 p-3 border border-gray-100 rounded-2xl bg-white shadow-sm">
                                        <View className="flex-row justify-between items-center mb-3">
                                            <Typography variant="caption" weight="bold" className="text-primary">Metode #{idx + 1}</Typography>
                                            <Pressable onPress={() => removePaymentRow(p.id)} className="w-6 h-6 items-center justify-center bg-red-50 rounded-full">
                                                <Trash2 size={12} color="#EF4444" />
                                            </Pressable>
                                        </View>

                                        <View className="flex-row flex-wrap gap-2 mb-3">
                                            {['TUNAI', 'TRANSFER'].map((m) => (
                                                <Pressable
                                                    key={m}
                                                    onPress={() => updatePaymentRow(p.id, 'metode', m)}
                                                    className={`px-3 py-1.5 rounded-xl border ${p.metode === m ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                                >
                                                    <Typography variant="caption" weight={p.metode === m ? 'bold' : 'medium'} className={p.metode === m ? 'text-primary' : 'text-gray-500'}>{m}</Typography>
                                                </Pressable>
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
                                        <Pressable
                                            key={m}
                                            onPress={() => updateField('metode_bayar', m)}
                                            className={`flex-1 py-2 items-center rounded-lg border ${formData.metode_bayar === m ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                        >
                                            <Typography
                                                className={formData.metode_bayar === m ? 'text-primary uppercase' : 'text-gray-500 uppercase'}
                                                weight={formData.metode_bayar === m ? 'bold' : 'medium'}
                                                variant="caption"
                                            >
                                                {m}
                                            </Typography>
                                        </Pressable>
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
