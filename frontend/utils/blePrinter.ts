import { Platform } from 'react-native';

type BLEPrinterModule = {
    init: () => Promise<void>;
    getDeviceList: () => Promise<Array<{ device_name: string; inner_mac_address: string }>>;
    connectPrinter: (mac: string) => Promise<void>;
    closeConn: () => Promise<void>;
    printText: (text: string) => Promise<void>;
};

let blePrinter: BLEPrinterModule | null | undefined;

export function getBLEPrinter(): BLEPrinterModule | null {
    if (Platform.OS !== 'android') {
        return null;
    }

    if (blePrinter !== undefined) {
        return blePrinter;
    }

    try {
        blePrinter = require('react-native-thermal-receipt-printer').BLEPrinter as BLEPrinterModule;
    } catch (error) {
        console.warn('[BLE] Thermal printer module not available', error);
        blePrinter = null;
    }

    return blePrinter;
}