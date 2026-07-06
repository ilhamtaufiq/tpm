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