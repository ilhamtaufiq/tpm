import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ProfitSplitCard } from '../../../components/jasa-angkut/ProfitSplitCard';
import { jasaAngkutService, Supir } from '../../../services/jasaAngkut';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { getErrorMessage } from '../../../utils/error';

export default function MuatanFormScreen() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    // Data State
    const [activeDrivers, setActiveDrivers] = useState<Supir[]>([]);
    const [loadingDrivers, setLoadingDrivers] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        supir_id: '',
        asal: '',
        tujuan: '',
        jenis_muatan: '',
        pendapatan_kotor: '',
        biaya_bbm: '',
        biaya_tol: '',
        biaya_makan: '',
        biaya_parkir: '',
        biaya_lainnya: '',
        metode_bayar: 'tunai',
        catatan: ''
    });

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    useEffect(() => {
        loadDrivers();
    }, []);

    const loadDrivers = async () => {
        try {
            const drivers = await jasaAngkutService.getActiveSupir();
            setActiveDrivers(drivers);
        } catch (e) {
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(e, 'Gagal memuat data supir'), variant: 'error' });
        } finally {
            setLoadingDrivers(false);
        }
    };

    const updateField = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    // Calculations
    const calculations = useMemo(() => {
        const revenue = parseFloat(formData.pendapatan_kotor) || 0;
        const bbm = parseFloat(formData.biaya_bbm) || 0;
        const tol = parseFloat(formData.biaya_tol) || 0;
        const makan = parseFloat(formData.biaya_makan) || 0;
        const parkir = parseFloat(formData.biaya_parkir) || 0;
        const lain = parseFloat(formData.biaya_lainnya) || 0;

        const totalCosts = bbm + tol + makan + parkir + lain;
        return { revenue, totalCosts };
    }, [formData]);

    const handleSubmit = async () => {
        if (!formData.supir_id || !formData.asal || !formData.tujuan || !formData.pendapatan_kotor) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Mohon lengkapi field wajib (*)', variant: 'warning' });
            return;
        }

        try {
            setSubmitting(true);
            await jasaAngkutService.createMuatan({
                ...formData,
                supir_id: parseInt(formData.supir_id),
                pendapatan_kotor: parseFloat(formData.pendapatan_kotor),
                biaya_bbm: parseFloat(formData.biaya_bbm) || 0,
                biaya_tol: parseFloat(formData.biaya_tol) || 0,
                biaya_makan: parseFloat(formData.biaya_makan) || 0,
                biaya_parkir: parseFloat(formData.biaya_parkir) || 0,
                biaya_lainnya: parseFloat(formData.biaya_lainnya) || 0,
            });

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Data muatan berhasil disimpan',
                variant: 'success',
                onConfirm: () => router.back()
            });
        } catch (error) {
            setDialogConfig({ visible: true, title: 'Gagal', message: getErrorMessage(error, 'Terjadi kesalahan saat menyimpan data'), variant: 'error' });
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerTitle: 'Input Muatan Baru' }} />

            <ScrollView contentContainerStyle={{ padding: 16 }}>

                {/* Section: Rute & Driver */}
                <Card className="mb-4">
                    <Text className="font-bold text-gray-900 mb-4">Informasi Rute</Text>

                    {/* Driver Selection (Simplified as Horizontal Scroll or Custom List for now) */}
                    <Text className="text-gray-500 text-xs mb-1">Supir *</Text>
                    {loadingDrivers ? (
                        <ActivityIndicator />
                    ) : (
                        <View className="flex-row flex-wrap mb-3">
                            {activeDrivers.map(d => (
                                <TouchableOpacity
                                    key={d.id}
                                    onPress={() => updateField('supir_id', d.id.toString())}
                                    className={`px-3 py-2 rounded-lg mr-2 mb-2 border ${formData.supir_id === d.id.toString() ? 'bg-sky-100 border-sky-500' : 'bg-white border-gray-200'}`}
                                >
                                    <Text className={`${formData.supir_id === d.id.toString() ? 'text-sky-700 font-bold' : 'text-gray-600'}`}>
                                        {d.nama}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Input
                        label="Tanggal (YYYY-MM-DD)"
                        value={formData.tanggal}
                        onChangeText={v => updateField('tanggal', v)}
                    />

                    <View className="flex-row space-x-2">
                        <View className="flex-1">
                            <Input
                                label="Asal *"
                                value={formData.asal}
                                onChangeText={v => updateField('asal', v)}
                            />
                        </View>
                        <View className="flex-1">
                            <Input
                                label="Tujuan *"
                                value={formData.tujuan}
                                onChangeText={v => updateField('tujuan', v)}
                            />
                        </View>
                    </View>

                    <Input
                        label="Jenis Muatan"
                        placeholder="Contoh: Pasir, Batu"
                        value={formData.jenis_muatan}
                        onChangeText={v => updateField('jenis_muatan', v)}
                    />
                </Card>

                {/* Section: Keuangan */}
                <Card className="mb-4">
                    <Text className="font-bold text-gray-900 mb-4">Keuangan</Text>

                    <Input
                        label="Total Pendapatan (Rp) *"
                        keyboardType="numeric"
                        value={formData.pendapatan_kotor}
                        onChangeText={v => updateField('pendapatan_kotor', v)}
                        className="bg-green-50 border-green-200 text-green-800 font-bold"
                    />

                    <Text className="text-gray-500 text-xs font-medium mt-4 mb-2">Metode Pembayaran</Text>
                    <View className="flex-row space-x-2">
                        {['tunai', 'transfer'].map((m) => (
                            <TouchableOpacity
                                key={m}
                                onPress={() => updateField('metode_bayar', m)}
                                className={`flex-1 py-3 items-center rounded-xl border ${formData.metode_bayar === m ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'}`}
                            >
                                <Text className={formData.metode_bayar === m ? 'text-sky-700 font-bold' : 'text-gray-500'}>
                                    {m.charAt(0).toUpperCase() + m.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text className="text-gray-500 text-sm font-medium mt-2 mb-2">Biaya Operasional</Text>
                    <View className="flex-row space-x-2">
                        <View className="flex-1">
                            <Input label="BBM" keyboardType="numeric" value={formData.biaya_bbm} onChangeText={v => updateField('biaya_bbm', v)} />
                        </View>
                        <View className="flex-1">
                            <Input label="Tol" keyboardType="numeric" value={formData.biaya_tol} onChangeText={v => updateField('biaya_tol', v)} />
                        </View>
                    </View>
                    <View className="flex-row space-x-2">
                        <View className="flex-1">
                            <Input label="Uang Makan" keyboardType="numeric" value={formData.biaya_makan} onChangeText={v => updateField('biaya_makan', v)} />
                        </View>
                        <View className="flex-1">
                            <Input label="Parkir/Lainnya" keyboardType="numeric" value={formData.biaya_parkir} onChangeText={v => updateField('biaya_parkir', v)} />
                        </View>
                    </View>
                </Card>

                {/* Live Simulation */}
                <ProfitSplitCard
                    revenue={calculations.revenue}
                    totalCosts={calculations.totalCosts}
                />

                <Button
                    title={submitting ? "Menyimpan..." : "Simpan Data Muatan"}
                    onPress={handleSubmit}
                    disabled={submitting}
                    className="mt-6 mb-10"
                />

            </ScrollView>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => {
                    setDialogConfig(prev => ({ ...prev, visible: false }));
                    if (dialogConfig.onConfirm) dialogConfig.onConfirm();
                }}
            />
        </View>
    );
}
