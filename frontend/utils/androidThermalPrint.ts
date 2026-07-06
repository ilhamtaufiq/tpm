import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { printBleReceipt } from './printBleReceipt';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';

const BLUETOOTH_PRINTER_KEY = 'bluetooth_printer';

export async function getSavedBlePrinterMac(): Promise<string> {
    const savedPrinter = await AsyncStorage.getItem(BLUETOOTH_PRINTER_KEY);
    if (!savedPrinter) {
        throw new Error(
            'Printer Bluetooth belum terhubung. Buka Pengaturan > Pairing Bluetooth, pilih printer thermal, lalu coba cetak lagi.',
        );
    }

    const device = JSON.parse(savedPrinter) as { inner_mac_address?: string };
    if (!device?.inner_mac_address) {
        throw new Error('Data printer Bluetooth tidak valid. Pair ulang printer di Pengaturan.');
    }

    return device.inner_mac_address;
}

/**
 * Single Android BLE print entry used by transaction print and settings test print.
 */
export async function executeAndroidThermalPrint(
    data: PrintReceiptData,
    settings: PrintSettings,
    receiptHtml: string,
): Promise<void> {
    if (Platform.OS !== 'android') {
        throw new Error('Cetak thermal Bluetooth hanya tersedia di Android.');
    }

    const macAddress = await getSavedBlePrinterMac();
    await printBleReceipt(data, settings, macAddress, receiptHtml);
}