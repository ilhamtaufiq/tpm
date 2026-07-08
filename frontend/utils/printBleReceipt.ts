import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { prepareReceiptAssets } from './prepareReceiptAssets';
import { prepareReceiptHtml } from './prepareReceiptHtml';
import { generateBleReceiptText } from './generateBleReceiptText';
import { printBillTextFireAndForget, printRawBase64 } from './blePrintTransport';
import { captureReceiptHtmlToEscPos } from './receiptHtmlCapture';
import { appendEscPosPaperCut } from './receiptEscPos';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function printBleReceiptText(
    data: PrintReceiptData,
    settings: PrintSettings,
): Promise<string> {
    const { settings: preparedSettings } = await prepareReceiptAssets(data, settings, {
        skipQrImage: true,
    });

    const receiptText = generateBleReceiptText(data, preparedSettings);
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    return receiptText;
}

/**
 * Android BLE thermal print — primary path uses the same HTML as QZ Tray (rasterized
 * in a hidden WebView), with plain-text ESC/POS as fallback.
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

    await printer.init();
    await printer.connectPrinter(macAddress);

    try {
        const { html, settings: preparedSettings } = await prepareReceiptHtml(data, normalizedSettings);
        const escPosBase64 = await captureReceiptHtmlToEscPos(html, preparedSettings);
        const payload = appendEscPosPaperCut(escPosBase64);
        await printRawBase64(payload, 30000);
        await delay(1500);
        return;
    } catch (htmlError) {
        console.warn('[Print] HTML raster BLE failed, fallback to text:', htmlError);
    }

    const receiptText = await printBleReceiptText(data, normalizedSettings);
    printBillTextFireAndForget(receiptText, {
        cut: true,
        beep: false,
        tailingLine: true,
        encoding: 'UTF8',
    });
    await delay(2500);
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