import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, TextInput, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Printer, Image as ImageIcon, Save, RefreshCw } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { router } from 'expo-router';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import { settingsService } from '../../services/settings';
import * as ImagePicker from 'expo-image-picker';
import { Tabs } from '../../components/ui/Tabs';

export default function PrintSettingsScreen() {
    const [settings, setSettings] = useState<PrintSettings | null>(null);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            
            // Try to fetch from backend first for synchronization
            try {
                const systemSettings = await settingsService.getSettings();
                if (systemSettings && systemSettings.print) {
                    const mapped = printSettingsService.fromSystemSettings(systemSettings);
                    // Update local storage too so offline works with latest settings
                    await printSettingsService.saveSettings(mapped);
                }
            } catch (syncError) {
                console.warn('Could not sync with backend, using local settings:', syncError);
            }

            const data = await printSettingsService.getSettings();
            setSettings(data);
        } catch (error) {
            console.error('Error loading settings:', error);
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Gagal memuat pengaturan',
                variant: 'error',
                type: 'alert'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        try {
            setSaving(true);
            await printSettingsService.saveSettings(settings);
            
            // Sync to backend for public receipts and other users
            try {
                await settingsService.updateSettings({
                    print: {
                        company_name: settings.companyName,
                        company_address: settings.companyAddress,
                        company_phone: settings.companyPhone,
                        header: settings.header,
                        footer: settings.footer,
                        logo_uri: settings.logoUri || undefined,
                        show_qr_code: settings.showQRCode,
                        paper_size: settings.paperSize
                    }
                });
            } catch (syncError) {
                console.warn('Failed to sync settings to backend:', syncError);
                // We still show success for local save, but maybe log it
            }

            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Pengaturan berhasil disimpan',
                variant: 'success',
                type: 'alert'
            });
        } catch (error) {
            console.error('Error saving settings:', error);
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Gagal menyimpan pengaturan',
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
            title: 'Reset Pengaturan',
            message: 'Apakah Anda yakin ingin mengembalikan pengaturan ke default?',
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await printSettingsService.resetSettings();
                    await loadSettings();
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'Pengaturan berhasil direset',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (error) {
                    setDialogConfig({
                        visible: true,
                        title: 'Error',
                        message: 'Gagal mereset pengaturan',
                        variant: 'error',
                        type: 'alert'
                    });
                }
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
                    message: 'Izinkan akses ke galeri untuk memilih logo',
                    variant: 'warning',
                    type: 'alert'
                });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true
            });

            if (!result.canceled && result.assets[0]) {
                const base64Img = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
                setSettings(prev => prev ? { ...prev, logoUri: base64Img } : null);
            }
        } catch (error) {
            console.error('Error picking logo:', error);
        }
    };

    const removeLogo = () => {
        setSettings(prev => prev ? { ...prev, logoUri: null } : null);
    };

    const handleGoBack = () => {
        try {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)/profile');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            // Fallback: try direct navigation
            try {
                router.push('/(tabs)/profile');
            } catch (e) {
                console.error('Fallback navigation failed:', e);
            }
        }
    };

    if (loading || !settings) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <View className="flex-1 items-center justify-center">
                    <Typography>Memuat pengaturan...</Typography>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            {/* Header */}
            <View className="p-6 bg-surface pb-8 rounded-b-[32px] shadow-sm">
                <View className="flex-row items-center mb-6">
                    <Pressable
                        onPress={handleGoBack}
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center mr-4"
                    >
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View className="flex-1">
                        <Typography variant="h2" weight="bold">Pengaturan Cetak</Typography>
                        <Typography variant="caption" className="text-textGray mt-1">
                            Konfigurasi struk thermal printer
                        </Typography>
                    </View>
                    <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
                        <Printer size={24} color="#023C69" />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {/* Company Info */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Informasi Usaha
                    </Typography>

                    <View className="mb-4">
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Nama Usaha
                        </Typography>
                        <TextInput
                            value={settings.companyName}
                            onChangeText={(text) => setSettings({ ...settings, companyName: text })}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base"
                            placeholder="Nama usaha Anda"
                        />
                    </View>

                    <View className="mb-4">
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Alamat
                        </Typography>
                        <TextInput
                            value={settings.companyAddress}
                            onChangeText={(text) => setSettings({ ...settings, companyAddress: text })}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base"
                            placeholder="Alamat lengkap"
                            multiline
                            numberOfLines={2}
                        />
                    </View>

                    <View>
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Nomor Telepon
                        </Typography>
                        <TextInput
                            value={settings.companyPhone}
                            onChangeText={(text) => setSettings({ ...settings, companyPhone: text })}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base"
                            placeholder="(021) 1234-5678"
                            keyboardType="phone-pad"
                        />
                    </View>
                </Card>

                {/* Logo */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Logo Usaha
                    </Typography>

                    {settings.logoUri ? (
                        <View className="items-center mb-4">
                            <Image
                                source={settings.logoUri === 'tpm_default' 
                                    ? require('../../assets/logo_tpm.png') 
                                    : { uri: settings.logoUri }}
                                style={{ width: 120, height: 120, borderRadius: 16 }}
                                resizeMode="contain"
                            />
                            <Button
                                variant="outline-danger"
                                title="Hapus Logo"
                                onPress={removeLogo}
                                className="mt-4"
                            />
                        </View>
                    ) : (
                        <Pressable
                            onPress={pickLogo}
                            className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 items-center"
                        >
                            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                                <ImageIcon size={28} color="#9CA3AF" />
                            </View>
                            <Typography weight="medium" className="text-textGray">
                                Pilih Logo
                            </Typography>
                            <Typography variant="caption" className="text-textGray/60 mt-1">
                                Ukuran maksimal 1MB
                            </Typography>
                        </Pressable>
                    )}
                </Card>

                {/* Header & Footer */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Header & Footer
                    </Typography>

                    <View className="mb-4">
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Teks Header
                        </Typography>
                        <TextInput
                            value={settings.header}
                            onChangeText={(text) => setSettings({ ...settings, header: text })}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base"
                            placeholder="Contoh: STRUK PEMBELIAN"
                        />
                    </View>

                    <View>
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Teks Footer
                        </Typography>
                        <TextInput
                            value={settings.footer}
                            onChangeText={(text) => setSettings({ ...settings, footer: text })}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base"
                            placeholder="Contoh: Terima kasih atas kunjungan Anda"
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                </Card>

                {/* Paper Size */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Ukuran Kertas
                    </Typography>

                    <Tabs
                        items={[
                            { label: '80mm (Default)', value: '80mm' },
                            { label: '58mm (Compact)', value: '58mm' }
                        ]}
                        value={settings.paperSize}
                        onChange={(value: string) => setSettings({ ...settings, paperSize: value as '58mm' | '80mm' })}
                    />

                    <View className="mt-4 p-4 bg-blue-50 rounded-2xl">
                        <Typography variant="caption" className="text-blue-700">
                            ℹ️ Pilih ukuran sesuai dengan thermal printer Anda
                        </Typography>
                    </View>
                </Card>

                {/* Action Buttons */}
                <View style={{ gap: 12 }} className="mb-8">
                    <Button
                        title="Simpan Pengaturan"
                        onPress={handleSave}
                        loading={saving}
                        icon={<Save size={20} color="white" />}
                        className="h-14 rounded-2xl"
                    />

                    <Button
                        variant="outline-neutral"
                        title="Reset ke Default"
                        onPress={handleReset}
                        icon={<RefreshCw size={20} color="#6B7280" />}
                        className="h-14 rounded-2xl"
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
