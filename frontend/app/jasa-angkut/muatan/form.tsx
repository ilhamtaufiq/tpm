import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ProfitSplitCard } from '../../../components/jasa-angkut/ProfitSplitCard';
import { jasaAngkutService, Supir } from '../../../services/jasaAngkut';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { Typography } from '../../../components/ui/Typography';
import { getErrorMessage } from '../../../utils/error';
import { PaymentMethod } from '../../../services/keuangan';

interface MuatanFormState {
    tanggal: string;
    supir_id: string;
    asal: string;
    tujuan: string;
    jenis_muatan: string;
    pendapatan_kotor: string;
    metode_bayar: PaymentMethod;
    catatan: string;
}

export default function MuatanFormScreen() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    // Data State
    const [activeDrivers, setActiveDrivers] = useState<Supir[]>([]);
    const [loadingDrivers, setLoadingDrivers] = useState(true);

    // Form State
    const [formData, setFormData] = useState<MuatanFormState>({
        tanggal: new Date().toISOString().split('T')[0],
        supir_id: '',
        asal: '',
        tujuan: '',
        jenis_muatan: '',
        pendapatan_kotor: '',
        metode_bayar: 'TUNAI',
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
        return { revenue, totalCosts: 0 };
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
                biaya_operasional: []
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
                                <Pressable
                                    key={d.id}
                                    onPress={() => updateField('supir_id', d.id.toString())}
                                    className={`px-3 py-2 rounded-lg mr-2 mb-2 border ${formData.supir_id === d.id.toString() ? 'bg-sky-100 border-sky-500' : 'bg-white border-gray-200'}`}
                                >
                                    <Text className={`${formData.supir_id === d.id.toString() ? 'text-sky-700 font-bold' : 'text-gray-600'}`}>
                                        {d.nama}
                                    </Text>
                                </Pressable>
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

                    <View className="flex-row space-x-2">
                        {(['TUNAI', 'TRANSFER'] as PaymentMethod[]).map((m) => (
                            <Pressable
                                key={m}
                                onPress={() => updateField('metode_bayar', m)}
                                className={`flex-1 py-3 items-center rounded-xl border ${formData.metode_bayar === m ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'}`}
                            >
                                <Text className={formData.metode_bayar === m ? 'text-sky-700 font-bold' : 'text-gray-500'}>
                                    {m === 'TUNAI' ? 'Tunai' : 'Transfer'}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Typography variant="caption" className="text-gray-400 mt-4 italic">Biaya operasional sekarang diinput melalui menu Detail Armada.</Typography>
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
