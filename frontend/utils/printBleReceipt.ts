import { NativeModules, Platform } from 'react-native';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { generateBleReceiptText } from './generateBleReceiptText';
import { buildPublicReceiptUrl } from './publicReceiptUrl';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { prepareBleLogoPayload } from './receiptLogo';

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

    const paper = getPaperDimensions(settings.paperSize);
    const normalizedSettings: PrintSettings = {
        ...settings,
        paperSize: paper.paperSize,
    };

    await printer.init();
    await printer.connectPrinter(macAddress);

    const logoPayload = await prepareBleLogoPayload(
        normalizedSettings.logoUri,
        paper.bleImageWidthPx,
    );
    if (logoPayload) {
        try {
            await invokeNative('printImageData', logoPayload);
            await delay(300);
        } catch (error) {
            console.warn('[BLE] Logo print skipped', error);
        }
    }

    const receiptText = generateBleReceiptText(data, normalizedSettings);
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

    if (normalizedSettings.showQRCode) {
        const qrType = data.type === 'mobil' ? 'mobil' : data.type;
        const receiptId = data.publicReceiptToken || data.transactionNumber;
        const receiptUrl = buildPublicReceiptUrl(qrType, receiptId, normalizedSettings.qrCodeBaseURL);

        try {
            await invokeNative('printQrCode', receiptUrl);
            await printer.printText('<C>Scan untuk lihat struk online</C>\n');
        } catch (error) {
            console.warn('[BLE] QR print skipped', error);
        }
    }
}

export async function printBleTestReceipt(settings: PrintSettings, macAddress: string): Promise<void> {
    const paper = getPaperDimensions(settings.paperSize);
    const sample: PrintReceiptData = {
        type: 'bengkel',
        transactionNumber: 'TEST-001',
        date: new Date(),
        customerName: 'Pelanggan Test',
        vehiclePlate: 'B 1234 TPM',
        services: [
            {
                description: 'Service Test',
                quantity: 1,
                unitPrice: 50000,
                subtotal: 50000,
            },
        ],
        subtotal: 50000,
        total: 50000,
        paid: 50000,
        paymentMethod: 'TUNAI',
    };

    await printBleReceipt(sample, { ...settings, footer: `Test ${paper.paperSize} • ${new Date().toLocaleString('id-ID')}` }, macAddress);
}