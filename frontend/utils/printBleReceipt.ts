import { NativeModules, Platform } from 'react-native';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { captureReceiptForBle } from './receiptCapture';
import { prepareReceiptAssets } from './prepareReceiptAssets';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

const NATIVE_PRINT_SUCCESS_MS = 15000;

function invokeNative(method: 'printRawData' | 'printQrCode' | 'printImageData', value: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const native = RNBLEPrinter?.[method];
        if (!native) {
            reject(new Error(`Native printer method "${method}" tidak tersedia. Rebuild aplikasi setelah update printer.`));
            return;
        }

        let settled = false;
        const finish = (error?: string) => {
            if (settled) return;
            settled = true;
            if (error) {
                reject(new Error(error));
                return;
            }
            resolve();
        };

        native(value, (error: string) => {
            finish(error || undefined);
        });

        setTimeout(() => finish(), NATIVE_PRINT_SUCCESS_MS);
    });
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cutBlePaper(): Promise<void> {
    const rawPrinter = Platform.OS === 'android'
        ? require('react-native-thermal-receipt-printer').BLEPrinter
        : null;

    if (!rawPrinter?.printBill) {
        return;
    }

    await new Promise<void>((resolve) => {
        rawPrinter.printBill('\n\n', {
            beep: false,
            cut: true,
            tailingLine: false,
            encoding: 'UTF8',
        });
        setTimeout(resolve, 400);
    });
}

/**
 * Android BLE: native thermal view → view-shot → cache file → printImageData.
 */
export async function printBleReceipt(
    data: PrintReceiptData,
    settings: PrintSettings,
    macAddress: string,
): Promise<void> {
    const printer = getBLEPrinter();
    if (!printer) {
        throw new Error('Modul printer Bluetooth tidak tersedia');
    }

    const paper = getPaperDimensions(settings.paperSize);
    const normalizedSettings: PrintSettings = {
        ...settings,
        paperSize: paper.paperSize,
    };

    const { settings: preparedSettings, qrImageDataUrl } = await prepareReceiptAssets(data, normalizedSettings);
    const imagePayload = await captureReceiptForBle(data, preparedSettings, qrImageDataUrl);

    if (!imagePayload || imagePayload.length < 32) {
        throw new Error('Gagal render struk visual untuk printer thermal.');
    }

    try {
        await printer.init();
        await printer.connectPrinter(macAddress);
        await invokeNative('printImageData', imagePayload);
        await delay(400);
        await cutBlePaper();
    } finally {
        try {
            await printer.closeConn();
        } catch {
            // ignore
        }
    }
}

export async function printBleTestReceipt(
    settings: PrintSettings,
    macAddress: string,
): Promise<void> {
    const paper = getPaperDimensions(settings.paperSize);
    await printBleReceipt(
        {
            type: 'bengkel',
            transactionNumber: 'TEST-001',
            date: new Date(),
            customerName: 'Pelanggan Test',
            vehiclePlate: 'B 1234 TPM',
            services: [{
                description: 'Service Test',
                quantity: 1,
                unitPrice: 50000,
                subtotal: 50000,
            }],
            subtotal: 50000,
            total: 50000,
            paid: 50000,
            paymentMethod: 'TUNAI',
        },
        { ...settings, footer: `Test ${paper.paperSize} • ${new Date().toLocaleString('id-ID')}` },
        macAddress,
    );
}