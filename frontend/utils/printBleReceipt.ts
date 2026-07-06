import { NativeModules, Platform } from 'react-native';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { captureReceiptHtmlToImage } from './receiptHtmlCapture';
import { generateBleReceiptText } from './generateBleReceiptText';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

const NATIVE_PRINT_SUCCESS_MS = 10000;

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

async function printBleTextReceipt(
    data: PrintReceiptData,
    settings: PrintSettings,
    macAddress: string,
): Promise<void> {
    const printer = getBLEPrinter();
    if (!printer) {
        throw new Error('Modul printer Bluetooth tidak tersedia');
    }

    const receiptText = generateBleReceiptText(data, settings);
    await printer.init();
    await printer.connectPrinter(macAddress);

    const rawPrinter = require('react-native-thermal-receipt-printer').BLEPrinter;
    await new Promise<void>((resolve, reject) => {
        try {
            rawPrinter.printBill(`${receiptText}\n\n`, {
                beep: false,
                cut: false,
                tailingLine: false,
                encoding: 'UTF8',
            });
            setTimeout(resolve, 600);
        } catch (error) {
            reject(error);
        }
    });

    await cutBlePaper();
    try {
        await printer.closeConn();
    } catch {
        // ignore
    }
}

/**
 * Print receipt on BLE thermal: HTML → ESC/POS raster via WebView → printRawData.
 * Falls back to plain-text receipt if raster capture fails.
 */
export async function printBleReceipt(
    data: PrintReceiptData,
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

    let escPosBase64: string | null = null;

    try {
        escPosBase64 = await captureReceiptHtmlToImage(receiptHtml, normalizedSettings);
    } catch (captureError) {
        console.warn('[BLE] Raster capture failed, using text fallback:', captureError);
    }

    let rasterPrinted = false;

    try {
        await printer.init();
        await printer.connectPrinter(macAddress);

        if (escPosBase64) {
            await invokeNative('printRawData', escPosBase64);
            await delay(300);
            await cutBlePaper();
            rasterPrinted = true;
            return;
        }
    } catch (printError) {
        console.warn('[BLE] ESC/POS print failed, using text fallback:', printError);
    } finally {
        try {
            await printer.closeConn();
        } catch {
            // ignore
        }
    }

    if (!rasterPrinted) {
        await printBleTextReceipt(data, normalizedSettings, macAddress);
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