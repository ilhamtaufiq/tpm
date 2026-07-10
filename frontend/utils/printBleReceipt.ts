import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { prepareReceiptHtml } from './prepareReceiptHtml';
import { generateBleReceiptText } from './generateBleReceiptText';
import { printBillTextFireAndForget, printRawBase64 } from './blePrintTransport';
import { captureReceiptHtmlToEscPos } from './receiptHtmlCapture';
import { appendEscPosPaperCut } from './receiptEscPos';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function printBleReceiptText(
    data: PrintReceiptData,
    settings: PrintSettings,
): string {
    // settings already prepared (same pipeline as QZ HTML) when called from printBleReceipt
    const receiptText = generateBleReceiptText(data, settings);
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    return receiptText;
}

/**
 * Android BLE thermal print.
 * Primary: same HTML as QZ Tray (prepareReceiptHtml → generateReceiptHTML),
 * rasterized in WebView to ESC/POS so layout matches desktop thermal.
 * Fallback: plain-text from the same receiptDocument model.
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

    // Prepare HTML first (same pipeline as web/QZ) before connecting printer.
    const prepared = await prepareReceiptHtml(data, normalizedSettings);

    await printer.init();
    await printer.connectPrinter(macAddress);

    try {
        const escPosBase64 = await captureReceiptHtmlToEscPos(prepared.html, prepared.settings);
        const payload = appendEscPosPaperCut(escPosBase64);
        await printRawBase64(payload, 30000);
        await delay(1500);
        return;
    } catch (htmlError) {
        console.warn('[Print] HTML raster BLE failed, fallback to text:', htmlError);
    }

    // Same document model as HTML/QZ — content parity even without logo/QR image.
    const receiptText = printBleReceiptText(data, prepared.settings);
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