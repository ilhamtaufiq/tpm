import * as FileSystem from 'expo-file-system';
import { NativeModules, Platform } from 'react-native';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { captureReceiptForBle } from './receiptCapture';
import { prepareReceiptAssets } from './prepareReceiptAssets';
import { buildBleCacheOnlyPayload } from './bleReceiptImage';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

const NATIVE_PRINT_TIMEOUT_MS = 30000;

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

        setTimeout(() => {
            if (!settled) {
                finish('Printer tidak merespons. Periksa koneksi Bluetooth dan coba lagi.');
            }
        }, NATIVE_PRINT_TIMEOUT_MS);
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

function isImageNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('image not found');
}

async function buildBase64OnlyPayload(imagePayload: string): Promise<string | null> {
    try {
        const parsed = JSON.parse(imagePayload) as {
            imageBase64?: string;
            cacheFile?: string;
            mime?: string;
            maxWidth?: number;
            maxHeight?: number;
            paperSize?: string;
            url?: string;
            path?: string;
        };

        let base64 = parsed.imageBase64;
        if (!base64 && parsed.cacheFile && FileSystem.cacheDirectory) {
            const cachePath = `${FileSystem.cacheDirectory}${parsed.cacheFile}`;
            const info = await FileSystem.getInfoAsync(cachePath);
            if (info.exists) {
                base64 = await FileSystem.readAsStringAsync(cachePath, {
                    encoding: FileSystem.EncodingType.Base64,
                });
            }
        }

        if (!base64 || base64.length < 64) {
            return null;
        }

        return JSON.stringify({
            imageBase64: base64,
            mime: parsed.mime ?? 'image/jpeg',
            maxWidth: parsed.maxWidth,
            maxHeight: parsed.maxHeight,
            paperSize: parsed.paperSize,
            url: parsed.url,
            path: parsed.path,
        });
    } catch {
        return null;
    }
}

async function printImagePayload(imagePayload: string): Promise<void> {
    const attempts: string[] = [];
    const cacheOnlyPayload = buildBleCacheOnlyPayload(imagePayload);
    if (cacheOnlyPayload) {
        attempts.push(cacheOnlyPayload);
    }
    attempts.push(imagePayload);

    const base64OnlyPayload = await buildBase64OnlyPayload(imagePayload);
    if (base64OnlyPayload) {
        attempts.push(base64OnlyPayload);
    }

    let lastError: Error | null = null;
    for (const payload of attempts) {
        try {
            await invokeNative('printImageData', payload);
            return;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (!isImageNotFoundError(lastError)) {
                throw lastError;
            }
        }
    }

    throw lastError ?? new Error('Printer tidak dapat membaca gambar struk (image not found).');
}

/**
 * Android BLE: native thermal view → view-shot → printImageData.
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
        await printImagePayload(imagePayload);
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