import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Typography } from '../../../components/ui/Typography';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { jasaAngkutService } from '../../../services/jasaAngkut';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { getErrorMessage } from '../../../utils/error';

export default function SupirFormScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        nama: '',
        nik: '',
        alamat: '',
        telepon: '',
        nomor_sim: '',
        jenis_sim: 'B1',
        tanggal_bergabung: new Date().toISOString().split('T')[0],
        armada_default_id: '',
        nopol_kendaraan: '',
        info_kendaraan: '',
        catatan: ''
    });

    const [activeArmada, setActiveArmada] = useState<any[]>([]);
    const [loadingArmada, setLoadingArmada] = useState(true);

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
        loadArmada();
        if (isEditing) {
            loadSupir();
        }
    }, [id]);

    const loadSupir = async () => {
        try {
            setLoading(true);
            const supir = await jasaAngkutService.getSupir(parseInt(id!));
            setFormData({
                nama: supir.nama || '',
                nik: supir.nik || '',
                alamat: supir.alamat || '',
                telepon: supir.telepon || '',
                nomor_sim: supir.nomor_sim || '',
                jenis_sim: supir.jenis_sim || 'B1',
                tanggal_bergabung: supir.tanggal_bergabung?.split('T')[0] || '',
                armada_default_id: supir.armada_default_id?.toString() || '',
                nopol_kendaraan: supir.nopol_kendaraan || '',
                info_kendaraan: supir.info_kendaraan || '',
                catatan: supir.catatan || ''
            });
        } catch (error) {
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal memuat data supir'), variant: 'error' });
            console.error(error);
        } finally {
            setLoading(false);
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
        if (key === 'armada_default_id') {
            const selected = activeArmada.find(a => a.id.toString() === value);
            setFormData(prev => ({
                ...prev,
                [key]: value,
                nopol_kendaraan: selected?.nopol || prev.nopol_kendaraan,
                info_kendaraan: selected?.nama || prev.info_kendaraan
            }));
        } else {
            setFormData(prev => ({ ...prev, [key]: value }));
        }
    };

    const handleSubmit = async () => {
        if (!formData.nama.trim()) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nama supir wajib diisi', variant: 'warning' });
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                armada_default_id: formData.armada_default_id ? parseInt(formData.armada_default_id) : undefined
            };
            if (isEditing) {
                await jasaAngkutService.updateSupir(parseInt(id!), payload);
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Data supir berhasil diperbarui',
                    variant: 'success',
                    onConfirm: () => router.back()
                });
            } else {
                await jasaAngkutService.createSupir(payload);
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Supir baru berhasil ditambahkan',
                    variant: 'success',
                    onConfirm: () => router.back()
                });
            }
        } catch (error) {
            setDialogConfig({ visible: true, title: 'Gagal', message: getErrorMessage(error, 'Terjadi kesalahan saat menyimpan data'), variant: 'error' });
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#0ea5e9" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerTitle: isEditing ? 'Edit Supir' : 'Tambah Supir Baru' }} />

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Section: Personal Info */}
                <Card className="mb-4">
                    <Text className="font-bold text-gray-900 mb-4">Informasi Pribadi</Text>

                    <Input
                        label="Nama Lengkap *"
                        placeholder="Nama supir"
                        value={formData.nama}
                        onChangeText={v => updateField('nama', v)}
                    />

                    <Input
                        label="NIK"
                        placeholder="Nomor Induk Kependudukan"
                        keyboardType="numeric"
                        value={formData.nik}
                        onChangeText={v => updateField('nik', v)}
                    />

                    <Input
                        label="Alamat"
                        placeholder="Alamat lengkap"
                        multiline
                        numberOfLines={2}
                        value={formData.alamat}
                        onChangeText={v => updateField('alamat', v)}
                    />

                    <Input
                        label="No. Telepon"
                        placeholder="08xxxxxxxxxx"
                        keyboardType="phone-pad"
                        value={formData.telepon}
                        onChangeText={v => updateField('telepon', v)}
                    />
                </Card>

                {/* Section: SIM Info */}
                <Card className="mb-4">
                    <Text className="font-bold text-gray-900 mb-4">Informasi SIM</Text>

                    <Input
                        label="Nomor SIM"
                        placeholder="Nomor Surat Izin Mengemudi"
                        value={formData.nomor_sim}
                        onChangeText={v => updateField('nomor_sim', v)}
                    />

                    <Text className="text-textGray text-sm mb-1 font-medium">Jenis SIM</Text>
                    <View className="flex-row flex-wrap mb-4">
                        {['A', 'B1', 'B2', 'C'].map(type => (
                            <Button
                                key={type}
                                title={`SIM ${type}`}
                                variant={formData.jenis_sim === type ? 'primary' : 'outline'}
                                size="sm"
                                onPress={() => updateField('jenis_sim', type)}
                                className="mr-2 mb-2"
                            />
                        ))}
                    </View>
                </Card>

                {/* Section: Vehicle Info */}
                <Card className="mb-4">
                    <Text className="font-bold text-gray-900 mb-4">Informasi Armada / Kendaraan Bawaan</Text>

                    <Text className="text-textGray text-sm mb-1 font-medium">Pilih Armada Terdaftar</Text>
                    {loadingArmada ? (
                        <ActivityIndicator className="my-2" />
                    ) : (
                        <View className="flex-row flex-wrap mb-4">
                            {activeArmada.map(a => (
                                <TouchableOpacity
                                    key={a.id}
                                    onPress={() => updateField('armada_default_id', a.id.toString())}
                                    className={`px-3 py-1.5 rounded-full mr-2 mb-2 border ${formData.armada_default_id === a.id.toString()
                                        ? 'bg-primary border-primary'
                                        : 'bg-white border-gray-200'
                                        }`}
                                >
                                    <View className="flex-row items-center">
                                        <Typography
                                            variant="caption"
                                            weight={formData.armada_default_id === a.id.toString() ? 'bold' : 'medium'}
                                            className={formData.armada_default_id === a.id.toString() ? 'text-white' : 'text-gray-600'}
                                        >
                                            {a.nama}
                                        </Typography>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                onPress={() => updateField('armada_default_id', '')}
                                className={`px-3 py-1.5 rounded-full mr-2 mb-2 border ${!formData.armada_default_id
                                    ? 'bg-gray-600 border-gray-600'
                                    : 'bg-white border-gray-200'
                                    }`}
                            >
                                <Typography
                                    variant="caption"
                                    weight={!formData.armada_default_id ? 'bold' : 'medium'}
                                    className={!formData.armada_default_id ? 'text-white' : 'text-gray-600'}
                                >
                                    Tidak Ada
                                </Typography>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Input
                        label="Plat Nomor (Input Manual/Auto)"
                        placeholder="Contoh: B 1234 ABC"
                        value={formData.nopol_kendaraan}
                        onChangeText={v => updateField('nopol_kendaraan', v)}
                    />

                    <Input
                        label="Informasi Kendaraan (Input Manual/Auto)"
                        placeholder="Contoh: Truck Isuzu Elf Giga Putih"
                        value={formData.info_kendaraan}
                        onChangeText={v => updateField('info_kendaraan', v)}
                    />
                </Card>

                {/* Section: Employment */}
                <Card className="mb-4">
                    <Text className="font-bold text-gray-900 mb-4">Kepegawaian</Text>

                    <Input
                        label="Tanggal Bergabung (YYYY-MM-DD)"
                        placeholder="2024-01-01"
                        value={formData.tanggal_bergabung}
                        onChangeText={v => updateField('tanggal_bergabung', v)}
                    />

                    <Input
                        label="Catatan"
                        placeholder="Catatan tambahan..."
                        multiline
                        numberOfLines={3}
                        value={formData.catatan}
                        onChangeText={v => updateField('catatan', v)}
                    />
                </Card>

                <Button
                    title={submitting ? "Menyimpan..." : (isEditing ? "Simpan Perubahan" : "Tambah Supir")}
                    onPress={handleSubmit}
                    disabled={submitting}
                    className="mt-2 mb-10"
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
