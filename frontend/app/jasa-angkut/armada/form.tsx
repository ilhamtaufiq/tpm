import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, Switch, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Save, Trash2 } from 'lucide-react-native';
import { Typography } from '../../../components/ui/Typography';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useCreateArmada, useUpdateArmada, useDeleteArmada, useArmadaList } from '../../../hooks/useJasaAngkut';
import { jasaAngkutService } from '../../../services/jasaAngkut';
import { getErrorMessage } from '../../../utils/error';
import { onlineManager } from '@tanstack/react-query';

export default function ArmadaFormScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const isEdit = !!id;

    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        nama: '',
        nopol: '',
        jenis: '',
        is_active: true,
        catatan: ''
    });

    const createArmada = useCreateArmada();
    const updateArmada = useUpdateArmada();
    const deleteArmada = useDeleteArmada();

    useEffect(() => {
        if (isEdit) {
            loadArmada();
        }
    }, [id]);

    const loadArmada = async () => {
        try {
            const data = await jasaAngkutService.getArmada(parseInt(id));
            setFormData({
                nama: data.nama,
                nopol: data.nopol,
                jenis: data.jenis || '',
                is_active: data.is_active,
                catatan: data.catatan || ''
            });
        } catch (error) {
            Alert.alert('Error', 'Gagal memuat data armada');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.nama || !formData.nopol) {
            Alert.alert('Peringatan', 'Nama dan No. Polisi wajib diisi');
            return;
        }

        try {
            setSubmitting(true);

            if (!onlineManager.isOnline()) {
                if (isEdit) {
                    updateArmada.mutate({ id: parseInt(id), data: formData });
                } else {
                    createArmada.mutate(formData);
                }
                Alert.alert('Offline Mode', 'Data armada telah disimpan di antrean offline.');
                router.back();
                return;
            }

            if (isEdit) {
                await updateArmada.mutateAsync({ id: parseInt(id), data: formData });
            } else {
                await createArmada.mutateAsync(formData);
            }
            router.back();
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error, 'Gagal menyimpan data armada'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Hapus Armada',
            'Apakah Anda yakin ingin menghapus armada ini?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSubmitting(true);

                            if (!onlineManager.isOnline()) {
                                deleteArmada.mutate(parseInt(id));
                                Alert.alert('Offline Mode', 'Data armada telah dijadwalkan untuk dihapus saat online.');
                                router.back();
                                return;
                            }

                            await deleteArmada.mutateAsync(parseInt(id));
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', getErrorMessage(error, 'Gagal menghapus armada'));
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-surface">
                <ActivityIndicator size="large" color="#023C69" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <Typography variant="h2" weight="bold">{isEdit ? 'Edit Armada' : 'Armada Baru'}</Typography>
                </View>
                {isEdit && (
                    <Pressable onPress={handleDelete} className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
                        <Trash2 size={20} color="#EF4444" />
                    </Pressable>
                )}
            </View>

            <ScrollView className="flex-1 p-6">
                <Card className="p-6 mb-6">
                    <Typography variant="caption" weight="bold" className="text-gray-400 mb-6 uppercase tracking-widest">Informasi Kendaraan</Typography>

                    <Input
                        label="Nama Kendaraan / Panggilan *"
                        placeholder="Contoh: Truk 01 atau Si Biru"
                        value={formData.nama}
                        onChangeText={(v) => updateField('nama', v)}
                    />

                    <Input
                        label="Nomor Polisi (Plat) *"
                        placeholder="Contoh: B 1234 ABC"
                        value={formData.nopol}
                        onChangeText={(v) => updateField('nopol', v.toUpperCase())}
                        autoCapitalize="characters"
                    />

                    <Input
                        label="Jenis / Tipe"
                        placeholder="Contoh: Dump Truck, Colt Diesel, Fuso"
                        value={formData.jenis}
                        onChangeText={(v) => updateField('jenis', v)}
                    />

                    <Input
                        label="Catatan Internal"
                        placeholder="Keterangan tambahan..."
                        value={formData.catatan}
                        onChangeText={(v) => updateField('catatan', v)}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    <View className="flex-row items-center justify-between mt-2 py-4 border-t border-gray-50">
                        <View>
                            <Typography weight="bold">Status Aktif</Typography>
                            <Typography variant="caption" className="text-gray-500">Armada dapat dipilih di form muatan</Typography>
                        </View>
                        <Switch
                            value={formData.is_active}
                            onValueChange={(v) => updateField('is_active', v)}
                            trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                        />
                    </View>
                </Card>

                <Button
                    title={submitting ? 'Menyimpan...' : 'Simpan Data Armada'}
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting}
                    icon={<Save size={20} color="white" />}
                    className="mb-10"
                />
            </ScrollView>
        </SafeAreaView>
    );
}
