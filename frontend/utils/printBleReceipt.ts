import { NativeModules, Platform } from 'react-native';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { generateBleReceiptText } from './generateBleReceiptText';
import { buildPublicReceiptUrl } from './publicReceiptUrl';
import { getBLEPrinter } from './blePrinter';
import { FILE_URL } from './api';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

function invokeNative(method: 'printQrCode' | 'printImageData', value: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const native = RNBLEPrinter?.[method];
        if (!native) {
            resolve();
            return;
        }

        native(value, (error: string) => {
            if (error) {
                reject(new Error(error));
                return;
            }
            resolve();
        });
    });
}

function resolveBleLogoUrl(logoUri: string | null | undefined): string | null {
    if (!logoUri || logoUri === 'tpm_default') return null;
    if (logoUri.startsWith('http://') || logoUri.startsWith('https://')) {
        return logoUri;
    }
    if (logoUri.startsWith('/') && FILE_URL) {
        return `${FILE_URL.replace(/\/$/, '')}${logoUri}`;
    }
    return null;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function printBleReceipt(
    data: PrintReceiptData,
    settings: PrintSettings,
    macAddress: string,
): Promise<void> {
    const printer = getBLEPrinter();
    if (!printer) {
        throw new Error('Modul printer Bluetooth tidak tersedia');
    }

    await printer.init();
    await printer.connectPrinter(macAddress);

    const logoUrl = resolveBleLogoUrl(settings.logoUri);
    if (logoUrl) {
        try {
            await invokeNative('printImageData', logoUrl);
            await delay(300);
        } catch (error) {
            console.warn('[BLE] Logo print skipped', error);
        }
    }

    const receiptText = generateBleReceiptText(data, settings);
    const rawPrinter = Platform.OS === 'android'
        ? require('react-native-thermal-receipt-printer').BLEPrinter
        : null;

    if (rawPrinter?.printBill) {
        await new Promise<void>((resolve) => {
            rawPrinter.printBill(receiptText, {
                beep: false,
                cut: true,
                tailingLine: true,
                encoding: 'UTF8',
            });
            setTimeout(resolve, 400);
        });
    } else {
        await printer.printText(receiptText);
    }

    if (settings.showQRCode) {
        const qrType = data.type === 'mobil' ? 'mobil' : data.type;
        const receiptId = data.publicReceiptToken || data.transactionNumber;
        const receiptUrl = buildPublicReceiptUrl(qrType, receiptId, settings.qrCodeBaseURL);

        try {
            await invokeNative('printQrCode', receiptUrl);
            await printer.printText('<C>Scan untuk lihat struk online</C>\n');
        } catch (error) {
            console.warn('[BLE] QR print skipped', error);
        }
    }
}