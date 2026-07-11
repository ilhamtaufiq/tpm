import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, TextInput, Image, Platform, Modal, PermissionsAndroid, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { ChevronLeft, Printer, Image as ImageIcon, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { router, useFocusEffect } from 'expo-router';
import { printSettingsService, PrintSettings } from '../../utils/printSettings';
import { testQzTrayConnection, QzConnectionTestResult, getQzPrinters, printHtmlViaQz } from '../../utils/qzTray';
import { getPaperDimensions } from '../../utils/paperSize';
import { settingsService } from '../../services/settings';
import * as ImagePicker from 'expo-image-picker';
import { Tabs } from '../../components/ui/Tabs';
import { printBleTestReceipt } from '../../utils/printBleReceipt';
import { getSavedBlePrinterMac } from '../../utils/androidThermalPrint';

export default function PrintSettingsScreen() {
    const insets = useSafeAreaInsets();
    const [settings, setSettings] = useState<PrintSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [checkingQz, setCheckingQz] = useState(false);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [printerPickerVisible, setPrinterPickerVisible] = useState(false);
    const [qzPrinters, setQzPrinters] = useState<string[]>([]);
    const [qzResult, setQzResult] = useState<QzConnectionTestResult | null>(null);
    const [testingPrint, setTestingPrint] = useState(false);
    const [testingBlePrint, setTestingBlePrint] = useState(false);
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

    useFocusEffect(
        useCallback(() => {
            setTestingBlePrint(false);
        }, []),
    );

    const requestBlePermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') {
            return true;
        }

        try {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);

            return (
                granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED ||
                granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED ||
                granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
            );
        } catch (error) {
            console.warn('[BLE] permission request failed', error);
            return false;
        }
    };

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
                        paper_size: settings.paperSize,
                        print_method: settings.printMethod,
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

    const loadQzPrinters = async () => {
        if (Platform.OS !== 'web') return;
        try {
            setLoadingPrinters(true);
            const printers = await getQzPrinters();
            setQzPrinters(printers);
        } catch (error) {
            console.error('Error loading QZ printers:', error);
        } finally {
            setLoadingPrinters(false);
        }
    };

    const handleCheckQz = async () => {
        if (Platform.OS !== 'web') {
            setDialogConfig({
                visible: true,
                title: 'Info',
                message: 'Cek koneksi QZ Tray hanya tersedia di web.',
                variant: 'info',
                type: 'alert'
            });
            return;
        }

        try {
            setCheckingQz(true);
            const result = await testQzTrayConnection();
            setQzResult(result);
            setQzPrinters(result.printers || []);
            setDialogConfig({
                visible: true,
                title: result.ok ? 'QZ Tray Tersambung' : 'QZ Tray Belum Tersambung',
                message: result.ok
                    ? `${result.message}${result.defaultPrinter ? `\nDefault printer: ${result.defaultPrinter}` : ''}`
                    : `${result.message}\nPastikan QZ Tray sedang aktif di host dan site ini sudah dipercaya.`,
                variant: result.ok ? 'success' : 'warning',
                type: 'alert'
            });
        } catch (error) {
            console.error('Error checking QZ:', error);
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Gagal mengecek koneksi QZ Tray',
                variant: 'error',
                type: 'alert'
            });
        } finally {
            setCheckingQz(false);
        }
    };

    const handleMobileBleTestPrint = async () => {
        if (!settings || Platform.OS !== 'android') {
            return;
        }

        setTestingBlePrint(true);

        // Hard UI unstick: never leave loading on if something hangs under the hood.
        const stuckTimer = setTimeout(() => {
            setTestingBlePrint(false);
        }, 20000);

        try {
            const hasPermission = await requestBlePermissions();
            if (!hasPermission) {
                setDialogConfig({
                    visible: true,
                    title: 'Izin Diperlukan',
                    message: 'Izinkan akses Bluetooth agar test cetak bisa dijalankan.',
                    variant: 'warning',
                    type: 'alert',
                });
                return;
            }

            const macAddress = await getSavedBlePrinterMac();
            const paper = getPaperDimensions(settings.paperSize);
            await printBleTestReceipt(
                {
                    ...settings,
                    paperSize: paper.paperSize,
                    footer: `Test ${paper.paperSize} • ${new Date().toLocaleString('id-ID')}`,
                },
                macAddress,
            );

            setDialogConfig({
                visible: true,
                title: 'Test Print Berhasil',
                message: `Struk test ${paper.paperSize} dikirim ke printer Bluetooth (native ESC/POS).`,
                variant: 'success',
                type: 'alert',
            });
        } catch (err: any) {
            setDialogConfig({
                visible: true,
                title: 'Test Print Gagal',
                message: err?.message || 'Gagal mencetak struk test ke printer Bluetooth.',
                variant: 'error',
                type: 'alert',
            });
        } finally {
            clearTimeout(stuckTimer);
            setTestingBlePrint(false);
        }
    };

    const handleTestPrint = async () => {
        if (Platform.OS !== 'web') return;
        try {
            setTestingPrint(true);
            const paper = getPaperDimensions(settings?.paperSize);
            const testHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page { size: ${paper.widthMm}mm auto; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Courier New', monospace; font-size: ${paper.fontBase}px; padding: ${paper.padding}; text-align: center; width: ${paper.widthPx}px; max-width: ${paper.widthMm}mm; }
h1 { font-size: ${paper.fontTitle}px; margin-bottom: 12px; font-weight: bold; }
p { font-size: ${paper.fontBase}px; margin: 4px 0; }
.success { margin-top: 24px; font-size: ${paper.fontTitle}px; font-weight: bold; }
.small { font-size: ${paper.fontSmall}px; color: #666; }
</style></head><body>
<h1>TPM</h1>
<p>Test Print QZ Tray</p>
<p>${new Date().toLocaleString('id-ID')}</p>
<p class="success">BERHASIL</p>
<p class="small">Kertas: ${paper.paperSize}</p>
<p class="small">Printer: ${settings?.webPrinterName || 'Default'}</p>
</body></html>`;
            const ok = await printHtmlViaQz(testHtml, {
                printerName: settings?.webPrinterName || undefined,
                paperSize: paper.paperSize,
                pageWidthPx: paper.widthPx,
            });
            setDialogConfig({
                visible: true,
                title: ok ? 'Test Print Berhasil' : 'Test Print Gagal',
                message: ok
                    ? 'Struk test berhasil dikirim ke printer.'
                    : 'Gagal mencetak. Periksa koneksi QZ Tray dan nama printer.',
                variant: ok ? 'success' : 'error',
                type: 'alert',
            });
        } catch (err: any) {
            setDialogConfig({
                visible: true, title: 'Error',
                message: err.message || 'Gagal test print.',
                variant: 'error', type: 'alert',
            });
        } finally {
            setTestingPrint(false);
        }
    };

    const openPrinterPicker = async () => {
        setPrinterPickerVisible(true);
        if (qzPrinters.length === 0) {
            await loadQzPrinters();
        }
    };

    const selectPrinter = (printerName: string) => {
        if (!settings) return;
        setSettings({ ...settings, webPrinterName: printerName });
        setPrinterPickerVisible(false);
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

            <ScrollView
                className="flex-1 p-6"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 48) }}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                removeClippedSubviews={false}
            >
                {Platform.OS === 'android' ? (
                    <Card
                        className="p-5 mb-6 rounded-[24px] border border-blue-100 bg-blue-50/40"
                        style={{ zIndex: 2, elevation: 2 }}
                    >
                        <Typography variant="h4" weight="bold" className="mb-2">
                            Test Printer Bluetooth
                        </Typography>
                        <Typography variant="caption" className="text-textGray mb-4">
                            Pastikan printer sudah dipair di Pengaturan Pairing Bluetooth sebelum test cetak.
                        </Typography>
                        <Button
                            title={testingBlePrint ? 'Mencetak...' : 'Test Print Bluetooth'}
                            onPress={handleMobileBleTestPrint}
                            loading={testingBlePrint}
                            variant="outline-neutral"
                            className="h-14 rounded-2xl"
                        />
                    </Card>
                ) : null}

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

                {/* Web Printing */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Web Printing
                    </Typography>

                    <View className="mb-4">
                        <Typography variant="caption" weight="medium" className="mb-2 text-textGray">
                            Nama Printer QZ Tray
                        </Typography>
                        <TextInput
                            value={settings.webPrinterName ?? ''}
                            onChangeText={(text) => setSettings({ ...settings, webPrinterName: text })}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base"
                            placeholder="Kosongkan untuk printer default host"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Typography variant="caption" className="text-textGray mt-2">
                            {settings.webPrinterName
                                ? `Printer terpilih: ${settings.webPrinterName}`
                                : 'Printer default host yang akan dipakai.'}
                        </Typography>
                    </View>

                    <View className="p-4 bg-blue-50 rounded-2xl">
                        <Typography variant="caption" className="text-blue-700">
                            Dipakai saat mencetak dari web via QZ Tray. Jika kosong, sistem memakai printer default pada host.
                        </Typography>
                    </View>

                    <View className="mt-4 gap-3">
                        <Button
                            title="Pilih Printer dari QZ Tray"
                            onPress={openPrinterPicker}
                            variant="outline-neutral"
                            className="h-14 rounded-2xl"
                        />
                        <Button
                            title={checkingQz ? 'Mengecek QZ Tray...' : 'Cek Koneksi QZ Tray'}
                            onPress={handleCheckQz}
                            loading={checkingQz}
                            variant="outline"
                            className="h-14 rounded-2xl"
                        />
                        <Button
                            title={testingPrint ? 'Mencetak...' : 'Test Print QZ Tray'}
                            onPress={handleTestPrint}
                            loading={testingPrint}
                            variant="outline-neutral"
                            className="h-14 rounded-2xl"
                        />

                        {qzResult ? (
                            <View className={`p-4 rounded-2xl ${qzResult.ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                <View className="flex-row items-center mb-2">
                                    {qzResult.ok ? (
                                        <CheckCircle2 size={18} color="#059669" />
                                    ) : (
                                        <AlertCircle size={18} color="#D97706" />
                                    )}
                                    <Typography variant="caption" weight="medium" className="ml-2">
                                        {qzResult.ok ? 'Koneksi aktif' : 'Koneksi belum aktif'}
                                    </Typography>
                                </View>
                                <Typography variant="caption" className={qzResult.ok ? 'text-emerald-700' : 'text-amber-700'}>
                                    {qzResult.message}
                                </Typography>
                                {qzResult.defaultPrinter ? (
                                    <Typography variant="caption" className="text-textGray mt-2">
                                        Default printer: {qzResult.defaultPrinter}
                                    </Typography>
                                ) : null}
                                {qzResult.printers.length > 0 ? (
                                    <Typography variant="caption" className="text-textGray mt-1">
                                        Printer terdeteksi: {qzResult.printers.slice(0, 5).join(', ')}
                                        {qzResult.printers.length > 5 ? ` +${qzResult.printers.length - 5} lainnya` : ''}
                                    </Typography>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                </Card>

                {/* Print Method */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Metode Cetak
                    </Typography>

                    <Tabs
                        items={[
                            { label: 'Browser Native', value: 'browser' },
                            { label: 'QZ Tray Direct', value: 'qz' }
                        ]}
                        value={settings.printMethod}
                        onChange={(value: string) => setSettings({ ...settings, printMethod: value as 'browser' | 'qz' })}
                    />

                    <View className="mt-4 p-4 bg-blue-50 rounded-2xl">
                        <Typography variant="caption" className="text-blue-700">
                            {settings.printMethod === 'qz'
                                ? 'Mencetak langsung ke thermal printer via QZ Tray. Pastikan QZ Tray aktif.'
                                : 'Menggunakan dialog print bawaan browser. Cocok untuk printernon-thermal.'}
                        </Typography>
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
                            Pilih lebar kertas fisik printer (58 mm atau 80 mm), lalu simpan sebelum mencetak. Diameter gulungan (30/37/40 mm) hanya memengaruhi panjang roll — tidak mengubah layout struk.
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

            <Modal
                visible={printerPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPrinterPickerVisible(false)}
            >
                <View className="flex-1 justify-center items-center p-6">
                    <Pressable
                        className="absolute inset-0 bg-black/60"
                        onPress={() => setPrinterPickerVisible(false)}
                    />
                    <View className="w-full max-w-[520px] bg-white rounded-[28px] p-5">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-1 pr-3">
                                <Typography variant="h4" weight="bold">
                                    Pilih Printer QZ Tray
                                </Typography>
                                <Typography variant="caption" className="text-textGray mt-1">
                                    {qzResult?.connected
                                        ? 'Pilih printer yang akan dipakai saat print dari web.'
                                        : 'Daftar printer akan diambil dari QZ Tray saat koneksi aktif.'}
                                </Typography>
                            </View>
                            <Pressable
                                onPress={() => setPrinterPickerVisible(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                            >
                                <Typography weight="bold">×</Typography>
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => selectPrinter('')}
                            className={`p-4 rounded-2xl border mb-3 ${settings.webPrinterName ? 'border-gray-200 bg-white' : 'border-primary bg-primary/5'}`}
                        >
                            <Typography weight="semibold">
                                Printer default host
                            </Typography>
                            <Typography variant="caption" className="text-textGray mt-1">
                                Dipakai jika field printer dikosongkan.
                            </Typography>
                        </Pressable>

                        <View className="flex-row items-center justify-between mb-3">
                            <Typography variant="caption" className="text-textGray">
                                Printer terdeteksi: {qzPrinters.length}
                            </Typography>
                            <Button
                                title="Refresh"
                                onPress={loadQzPrinters}
                                loading={loadingPrinters}
                                variant="ghost"
                                size="sm"
                                className="px-2 py-1"
                            />
                        </View>

                        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                            {loadingPrinters ? (
                                <View className="py-8 items-center justify-center">
                                    <ActivityIndicator color="#023C69" />
                                    <Typography variant="caption" className="text-textGray mt-3">
                                        Memuat daftar printer...
                                    </Typography>
                                </View>
                            ) : qzPrinters.length > 0 ? (
                                qzPrinters.map((printer) => {
                                    const selected = settings.webPrinterName === printer;
                                    return (
                                        <Pressable
                                            key={printer}
                                            onPress={() => selectPrinter(printer)}
                                            className={`p-4 rounded-2xl border mb-3 ${selected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'}`}
                                        >
                                            <View className="flex-row items-center justify-between">
                                                <View className="flex-1 pr-3">
                                                    <Typography weight={selected ? 'bold' : 'semibold'}>
                                                        {printer}
                                                    </Typography>
                                                    <Typography variant="caption" className="text-textGray mt-1">
                                                        {selected ? 'Sedang dipilih' : 'Tap untuk memilih printer ini'}
                                                    </Typography>
                                                </View>
                                                {selected ? (
                                                    <View className="w-3 h-3 rounded-full bg-primary" />
                                                ) : null}
                                            </View>
                                        </Pressable>
                                    );
                                })
                            ) : (
                                <View className="py-8 items-center justify-center">
                                    <Typography weight="semibold">Tidak ada printer terdeteksi</Typography>
                                    <Typography variant="caption" className="text-textGray mt-2 text-center">
                                        Jalankan cek koneksi QZ Tray dulu, lalu refresh daftar printer.
                                    </Typography>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
