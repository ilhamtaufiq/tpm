import { Linking, Platform } from 'react-native';
import { getErrorMessage } from './error';

export type BLEPrinterDevice = {
    device_name: string;
    inner_mac_address: string;
};

type BLEPrinterModule = {
    init: () => Promise<void>;
    getDeviceList: () => Promise<BLEPrinterDevice[]>;
    connectPrinter: (mac: string) => Promise<void>;
    closeConn: () => Promise<void>;
    printText: (text: string) => Promise<void>;
};

let rawBlePrinter: BLEPrinterModule | null | undefined;
let initPromise: Promise<void> | null = null;
let scanPromise: Promise<BLEPrinterDevice[]> | null = null;

function loadRawBlePrinter(): BLEPrinterModule | null {
    if (Platform.OS !== 'android') {
        return null;
    }

    if (rawBlePrinter !== undefined) {
        return rawBlePrinter;
    }

    try {
        rawBlePrinter = require('react-native-thermal-receipt-printer').BLEPrinter as BLEPrinterModule;
    } catch (error) {
        console.warn('[BLE] Thermal printer module not available', error);
        rawBlePrinter = null;
    }

    return rawBlePrinter;
}

export function isBluetoothDisabledError(error: unknown): boolean {
    const message = getErrorMessage(error, '').toLowerCase();
    return message.includes('bluetooth') && message.includes('not enabled');
}

export function formatBluetoothError(error: unknown, fallback = 'Gagal memindai perangkat'): string {
    if (isBluetoothDisabledError(error)) {
        return 'Bluetooth belum aktif. Aktifkan Bluetooth di pengaturan perangkat, lalu coba scan lagi.';
    }

    const message = getErrorMessage(error, fallback);
    if (message.toLowerCase().includes('no bluetooth adapter')) {
        return 'Perangkat ini tidak mendukung Bluetooth.';
    }

    return message;
}

export async function openBluetoothSettings(): Promise<void> {
    if (Platform.OS === 'android') {
        try {
            await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
            return;
        } catch (error) {
            console.warn('[BLE] Failed to open Bluetooth settings intent', error);
        }
    }

    await Linking.openSettings();
}

export function resetBLEPrinterState(): void {
    initPromise = null;
    scanPromise = null;
}

export async function ensureBLEPrinterReady(): Promise<BLEPrinterModule> {
    const printer = loadRawBlePrinter();
    if (!printer) {
        throw new Error('Modul printer Bluetooth tidak tersedia di perangkat ini');
    }

    if (!initPromise) {
        initPromise = printer.init().catch((error) => {
            initPromise = null;
            throw error;
        });
    }

    try {
        await initPromise;
    } catch (error) {
        if (isBluetoothDisabledError(error)) {
            resetBLEPrinterState();
        }
        throw error;
    }

    return printer;
}

export async function scanBLEPrinters(): Promise<BLEPrinterDevice[]> {
    if (scanPromise) {
        return scanPromise;
    }

    scanPromise = (async () => {
        const printer = await ensureBLEPrinterReady();
        const list = await printer.getDeviceList();
        return Array.isArray(list) ? list : [];
    })().finally(() => {
        scanPromise = null;
    });

    return scanPromise;
}

export function getBLEPrinter(): BLEPrinterModule | null {
    const printer = loadRawBlePrinter();
    if (!printer) {
        return null;
    }

    return {
        init: () => ensureBLEPrinterReady().then(() => undefined),
        getDeviceList: () => scanBLEPrinters(),
        connectPrinter: async (mac: string) => {
            const readyPrinter = await ensureBLEPrinterReady();
            await readyPrinter.connectPrinter(mac);
        },
        closeConn: async () => {
            const readyPrinter = loadRawBlePrinter();
            if (!readyPrinter) {
                return;
            }
            await readyPrinter.closeConn();
            initPromise = null;
        },
        printText: async (text: string) => {
            const readyPrinter = await ensureBLEPrinterReady();
            await readyPrinter.printText(text);
        },
    };
}