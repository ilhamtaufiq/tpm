import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { prepareReceiptAssets } from './prepareReceiptAssets';
import { generateBleReceiptText } from './generateBleReceiptText';
import { printBillText } from './blePrintTransport';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Android BLE thermal print using the same printBill/printRawData path as the
 * working Bluetooth pairing test (EPToolkit tagged text → ESC/POS bytes).
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

    const { settings: preparedSettings } = await prepareReceiptAssets(data, normalizedSettings, {
        skipQrImage: true,
    });

    const receiptText = generateBleReceiptText(data, preparedSettings);
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    await printer.init();
    await printer.connectPrinter(macAddress);

    try {
        await printBillText(receiptText, {
            cut: true,
            beep: false,
            tailingLine: true,
            encoding: 'UTF8',
        });
        await delay(600);
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