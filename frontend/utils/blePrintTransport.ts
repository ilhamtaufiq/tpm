import { NativeModules, Platform } from 'react-native';
// Same ESC/POS encoder used by BLEPrinter.printBill / printText in the library.
import * as EPToolkit from 'react-native-thermal-receipt-printer/dist/utils/EPToolkit';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

export type BleBillOptions = {
    beep?: boolean;
    cut?: boolean;
    tailingLine?: boolean;
    encoding?: string;
};

const DEFAULT_BILL_OPTIONS: Required<BleBillOptions> = {
    beep: false,
    cut: true,
    tailingLine: true,
    encoding: 'UTF8',
};

export function billTextToBase64(text: string, opts?: BleBillOptions): string {
    const options = { ...DEFAULT_BILL_OPTIONS, ...opts };
    const buffer = EPToolkit.exchange_text(text, options);
    return buffer.toString('base64');
}

export function printRawBase64(base64: string, timeoutMs = 12000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!RNBLEPrinter?.printRawData) {
            reject(new Error('Native printRawData tidak tersedia. Rebuild APK setelah update printer.'));
            return;
        }

        if (!base64 || base64.length < 8) {
            reject(new Error('Data cetak kosong.'));
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

        RNBLEPrinter.printRawData(base64, (error: string) => {
            finish(error || undefined);
        });

        setTimeout(() => {
            if (!settled) {
                finish('Printer tidak merespons. Pastikan printer menyala dan sudah terhubung.');
            }
        }, timeoutMs);
    });
}

export async function printBillText(text: string, opts?: BleBillOptions): Promise<void> {
    const base64 = billTextToBase64(text, opts);
    await printRawBase64(base64);
}

/**
 * Same path as the working Bluetooth pairing test: fire printRawData without
 * waiting for the native callback (some APK builds never invoke it).
 */
export function printBillTextFireAndForget(text: string, opts?: BleBillOptions): void {
    if (!RNBLEPrinter?.printRawData) {
        throw new Error('Native printRawData tidak tersedia. Rebuild APK setelah update printer.');
    }

    const base64 = billTextToBase64(text, opts);
    if (!base64 || base64.length < 8) {
        throw new Error('Data cetak kosong.');
    }

    RNBLEPrinter.printRawData(base64, () => {});
}

/**
 * Print logo/image via patched native printImageData (JSON payload with imageBase64).
 * Fire-and-forget — callback often never fires.
 */
export function printImageDataFireAndForget(payloadJson: string): void {
    if (!RNBLEPrinter?.printImageData) {
        throw new Error('Native printImageData tidak tersedia. Rebuild APK setelah update printer.');
    }
    if (!payloadJson || payloadJson.length < 8) {
        throw new Error('Payload gambar kosong.');
    }
    RNBLEPrinter.printImageData(payloadJson, () => {});
}

/**
 * Print QR via native ZXing encode (BLEPrinterAdapter.printQrCode).
 * Content is usually the public receipt URL.
 */
export function printQrCodeFireAndForget(content: string): void {
    if (!RNBLEPrinter?.printQrCode) {
        throw new Error('Native printQrCode tidak tersedia. Rebuild APK setelah update printer.');
    }
    const value = (content || '').trim();
    if (!value) {
        throw new Error('Konten QR kosong.');
    }
    RNBLEPrinter.printQrCode(value, () => {});
}

export function isBleImagePrintAvailable(): boolean {
    return Boolean(RNBLEPrinter?.printImageData);
}

export function isBleQrPrintAvailable(): boolean {
    return Boolean(RNBLEPrinter?.printQrCode);
}