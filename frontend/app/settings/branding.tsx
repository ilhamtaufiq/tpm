import React, { useState } from 'react';
import { View, ScrollView, Pressable, TextInput, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Info, Image as ImageIcon, Save, RefreshCw, Type } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { router } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import * as ImagePicker from 'expo-image-picker';

export default function BrandingSettingsScreen() {
    const { appLogo, appName, setBranding } = useUIStore();
    const [name, setName] = useState(appName);
    const [logo, setLogo] = useState(appLogo);
    const [saving, setSaving] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const handleSave = async () => {
        try {
            setSaving(true);
            setBranding({ logo: logo, name: name });
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Pengaturan Branding berhasil disimpan. Perubahan akan terlihat di seluruh aplikasi.',
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Gagal menyimpan pengaturan branding',
                variant: 'error',
                type: 'alert'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setDialogConfig({
            visible: true,
            title: 'Reset Branding',
            message: 'Kembalikan logo dan nama aplikasi ke default TPM?',
            variant: 'warning',
            type: 'confirm',
            onConfirm: () => {
                setName('TPM');
                setLogo(null);
                setBranding({ logo: null, name: 'TPM' });
            }
        });
    };

    const pickLogo = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                setDialogConfig({
                    visible: true,
                    title: 'Izin Diperlukan',
                    message: 'Izinkan akses ke galeri untuk memilih logo aplikasi',
                    variant: 'warning',
                    type: 'alert'
                });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: true
            });

            if (!result.canceled && result.assets[0]) {
                const base64Img = `data:${result.assets[0].mimeType || 'image/png'};base64,${result.assets[0].base64}`;
                setLogo(base64Img);
            }
        } catch (error) {
            console.error('Error picking branding logo:', error);
        }
    };

    const removeLogo = () => setLogo(null);

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            {/* Header */}
            <View className="p-6 bg-surface pb-8 rounded-b-[32px] shadow-sm">
                <View className="flex-row items-center mb-6">
                    <Pressable
                        onPress={() => router.back()}
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center mr-4"
                    >
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View className="flex-1">
                        <Typography variant="h2" weight="bold">Branding App</Typography>
                        <Typography variant="caption" className="text-textGray mt-1">
                            Personalisasi identitas aplikasi
                        </Typography>
                    </View>
                    <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center text-primary">
                        <Type size={24} color="#023C69" />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {/* Notice */}
                <View className="p-4 bg-blue-50 rounded-2xl flex-row items-start mb-6 border border-blue-100">
                    <Info size={20} color="#1D4ED8" className="mr-3 mt-0.5" />
                    <Typography variant="caption" className="text-blue-700 flex-1 leading-5">
                        Logo dan Nama di sini akan muncul pada **Halaman Login**, **Dashboard Dashboard**, dan **Header Utama**. Ini adalah logo identitas aplikasi Anda (Branding).
                    </Typography>
                </View>

                {/* App Name */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">Nama Aplikasi</Typography>
                    <View>
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Nama Singkat (Maks 10 Karakter)
                        </Typography>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            maxLength={10}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-bold text-lg text-primary"
                            placeholder="Contoh: TPM / JPM / TOKO"
                        />
                    </View>
                </Card>

                {/* App Logo */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">Logo Branding</Typography>
                    <Typography variant="caption" className="text-textGray mb-4 leading-relaxed">
                        Logo ini akan menggantikan ikon default di Halaman Login.
                    </Typography>

                    {logo ? (
                        <View className="items-center">
                            <View className="p-4 bg-gray-50 rounded-[32px] mb-4 border border-gray-100 shadow-inner">
                                <Image
                                    source={{ uri: logo }}
                                    style={{ width: 100, height: 100 }}
                                    resizeMode="contain"
                                />
                            </View>
                            <Button
                                variant="outline-danger"
                                title="Ganti / Hapus Logo"
                                onPress={removeLogo}
                                className="h-10 rounded-xl"
                            />
                        </View>
                    ) : (
                        <Pressable
                            onPress={pickLogo}
                            className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-[32px] p-10 items-center"
                        >
                            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                                <ImageIcon size={32} color="#9CA3AF" />
                            </View>
                            <Typography weight="medium" className="text-textGray">Gunakan Logo Kustom</Typography>
                            <Typography variant="caption" className="text-textGray/40 mt-1">Format PNG/JPG transparan (Maks 1MB)</Typography>
                        </Pressable>
                    )}
                </Card>

                {/* Action Buttons */}
                <View style={{ gap: 12 }} className="mb-12">
                    <Button
                        title="Simpan Perubahan"
                        onPress={handleSave}
                        loading={saving}
                        icon={<Save size={20} color="white" />}
                        className="h-14 rounded-2xl shadow-lg shadow-primary/30"
                    />

                    <Button
                        variant="ghost"
                        title="Reset ke Default TPM"
                        onPress={handleReset}
                        icon={<RefreshCw size={18} color="#9CA3AF" />}
                        className="h-12"
                        disabled={saving}
                    />
                </View>
            </ScrollView>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
                loading={saving}
            />
        </SafeAreaView>
    );
}
