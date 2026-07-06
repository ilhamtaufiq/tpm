import { NativeModules, Platform } from 'react-native';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { captureReceiptHtmlToImage } from './receiptHtmlCapture';
import { buildBleImagePayload } from './bleReceiptImage';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

const NATIVE_PRINT_SUCCESS_MS = 8000;

function invokeNative(method: 'printQrCode' | 'printImageData', value: string): Promise<void> {
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
                const message = error === 'image not found'
                    ? 'Printer tidak dapat membaca gambar struk. Pastikan APK sudah rebuild terbaru.'
                    : error;
                reject(new Error(message));
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
 * Print receipt on BLE thermal using the same HTML layout as web QZ Tray (rasterized to image).
 */
export async function printBleReceipt(
    _data: PrintReceiptData,
    settings: PrintSettings,
    macAddress: string,
    receiptHtml: string,
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

    const imageUri = await captureReceiptHtmlToImage(receiptHtml, normalizedSettings);
    const imagePayload = await buildBleImagePayload(imageUri, paper.paperSize);

    try {
        await printer.init();
        await printer.connectPrinter(macAddress);
        await invokeNative('printImageData', imagePayload);
        await delay(250);
        await cutBlePaper();
    } finally {
        try {
            await printer.closeConn();
        } catch {
            // ignore disconnect errors
        }
    }
}

export async function printBleTestReceipt(
    settings: PrintSettings,
    macAddress: string,
    receiptHtml: string,
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
        receiptHtml,
    );
}