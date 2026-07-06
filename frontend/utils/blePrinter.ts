import { Platform } from 'react-native';

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

    await initPromise;
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