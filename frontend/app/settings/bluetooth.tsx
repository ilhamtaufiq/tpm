import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bluetooth, RefreshCw, Printer, Search, CheckCircle, XCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { Typography } from '../../components/ui/Typography';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import {
    ensureBLEPrinterReady,
    formatBluetoothError,
    getBLEPrinter,
    isBluetoothDisabledError,
    openBluetoothSettings,
    resetBLEPrinterState,
    scanBLEPrinters,
} from '../../utils/blePrinter';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BluetoothDevice {
    device_name: string;
    inner_mac_address: string;
}

export default function BluetoothSettingsScreen() {
    const [devices, setDevices] = useState<BluetoothDevice[]>([]);
    const [scanning, setScanning] = useState(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type?: 'alert' | 'confirm';
        confirmText?: string;
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert',
    });

    useEffect(() => {
        loadSavedPrinter();
        ensureBLEPrinterReady().catch(err => console.warn('[BLE] init failed', err));
    }, []);

    const loadSavedPrinter = async () => {
        try {
            const savedPrinter = await AsyncStorage.getItem('bluetooth_printer');
            if (savedPrinter) {
                const parsed = JSON.parse(savedPrinter);
                setConnectedDevice(parsed);
                // Attempt auto-connect? Maybe not, user might want to scan.
                // But usually we want to know what is saved.
            }
        } catch (error) {
            console.error('Failed to load printer settings', error);
        }
    };

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);

                return (
                    granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED ||
                    granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
                );
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    const handleScan = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            setDialogConfig({
                visible: true,
                title: 'Izin Ditolak',
                message: 'Aplikasi membutuhkan izin Bluetooth dan Lokasi untuk memindai printer.',
                variant: 'error'
            });
            return;
        }

        setScanning(true);
        setDevices([]);

        try {
            const list = await scanBLEPrinters();
            setDevices(list);

            if (list.length === 0) {
                setDialogConfig({
                    visible: true,
                    title: 'Tidak Ada Perangkat',
                    message: 'Tidak ada printer Bluetooth yang sudah dipasangkan. Pasangkan printer di Pengaturan Bluetooth perangkat, lalu scan lagi.',
                    variant: 'warning'
                });
            }
        } catch (error) {
            resetBLEPrinterState();

            if (isBluetoothDisabledError(error)) {
                setDialogConfig({
                    visible: true,
                    title: 'Bluetooth Nonaktif',
                    message: formatBluetoothError(error),
                    variant: 'warning',
                    type: 'confirm',
                    confirmText: 'Buka Pengaturan',
                    onConfirm: () => {
                        setDialogConfig(prev => ({ ...prev, visible: false }));
                        openBluetoothSettings().catch(console.warn);
                    },
                });
                return;
            }

            setDialogConfig({
                visible: true,
                title: 'Gagal Memindai',
                message: formatBluetoothError(error),
                variant: 'error',
                type: 'alert',
            });
        } finally {
            setScanning(false);
        }
    };

    const handleConnect = async (device: BluetoothDevice) => {
        setConnecting(device.inner_mac_address);
        try {
            const printer = getBLEPrinter();
            if (!printer) {
                throw new Error('Modul printer Bluetooth tidak tersedia');
            }
            await printer.connectPrinter(device.inner_mac_address);
            setConnectedDevice(device);
            await AsyncStorage.setItem('bluetooth_printer', JSON.stringify(device));

            setDialogConfig({
                visible: true,
                title: 'Terhubung',
                message: `Berhasil terhubung ke ${device.device_name || 'Printer'}`,
                variant: 'success'
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Koneksi Gagal',
                message: getErrorMessage(error, 'Gagal terhubung ke printer'),
                variant: 'error'
            });
        } finally {
            setConnecting(null);
        }
    };

    const handleDisconnect = async () => {
        try {
            if (connectedDevice) {
                await getBLEPrinter()?.closeConn();
                await AsyncStorage.removeItem('bluetooth_printer');
                setConnectedDevice(null);
                setDialogConfig({
                    visible: true,
                    title: 'Terputus',
                    message: 'Koneksi printer diputuskan',
                    variant: 'info'
                });
            }
        } catch (error) {
            console.warn(error);
        }
    }

    const handleTestPrint = async () => {
        if (!connectedDevice) return;
        try {
            const printer = getBLEPrinter();
            if (!printer) {
                throw new Error('Modul printer Bluetooth tidak tersedia');
            }
            await printer.printText("<C>TEST PRINT\n</C>");
            await printer.printText("<C>Tiga Putra Motor\n</C>");
            await printer.printText("<C>----------------\n</C>\n");
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Print Error',
                message: 'Gagal mencetak test receipt',
                variant: 'error'
            });
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center border-b border-gray-100 bg-white">
                <Pressable
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-4"
                >
                    <ChevronLeft size={24} color="#374151" />
                </Pressable>
                <View className="flex-1">
                    <Typography variant="h3" weight="bold">Printer Bluetooth</Typography>
                    <Typography variant="caption" className="text-textGray">Scan dan hubungkan printer thermal</Typography>
                </View>
                <Pressable
                    onPress={handleScan}
                    disabled={scanning}
                    className={`w-10 h-10 ${scanning ? 'bg-gray-100' : 'bg-blue-50'} rounded-full items-center justify-center`}
                >
                    {scanning ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                        <RefreshCw size={20} color="#3B82F6" />
                    )}
                </Pressable>
            </View>

            <ScrollView className="flex-1 p-6">

                {/* Connected Device Card */}
                {connectedDevice && (
                    <View className="mb-8">
                        <Typography variant="h4" weight="bold" className="mb-3">Printer Terhubung</Typography>
                        <View className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mr-3">
                                    <Printer size={20} color="#10B981" />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-emerald-900">{connectedDevice.device_name}</Typography>
                                    <Typography variant="caption" className="text-emerald-700">{connectedDevice.inner_mac_address}</Typography>
                                </View>
                            </View>
                            <Pressable onPress={handleDisconnect}>
                                <XCircle size={24} color="#EF4444" />
                            </Pressable>
                        </View>
                        <Pressable
                            onPress={handleTestPrint}
                            className="mt-3 bg-white border border-gray-200 py-3 rounded-xl items-center"
                        >
                            <Typography weight="semibold" className="text-text">Test Print</Typography>
                        </Pressable>
                    </View>
                )}

                <Typography variant="h4" weight="bold" className="mb-3">Perangkat Tersedia</Typography>

                {devices.length === 0 && !scanning ? (
                    <View className="items-center justify-center py-12 opacity-50">
                        <Bluetooth size={48} color="#9CA3AF" />
                        <Typography className="text-textGray mt-4 text-center">
                            Belum ada perangkat ditemukan.{'\n'}Pastikan printer menyala dan bluetooth aktif.
                        </Typography>
                    </View>
                ) : (
                    <View className="space-y-3">
                        {devices.map((device, index) => (
                            <Pressable
                                key={device.inner_mac_address || index}
                                onPress={() => handleConnect(device)}
                                disabled={connecting === device.inner_mac_address}
                                className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between active:bg-gray-50"
                            >
                                <View className="flex-row items-center">
                                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
                                        <Bluetooth size={20} color="#6B7280" />
                                    </View>
                                    <View>
                                        <Typography weight="semibold" className="text-text">{device.device_name || 'Unknown Device'}</Typography>
                                        <Typography variant="caption" className="text-textGray">{device.inner_mac_address}</Typography>
                                    </View>
                                </View>
                                {connecting === device.inner_mac_address && (
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                )}
                            </Pressable>
                        ))}
                    </View>
                )}
            </ScrollView>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type || 'alert'}
                confirmText={dialogConfig.confirmText}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}
