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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
    }) as Promise<T>;
}

/**
 * Same HTML as QZ Tray → WebView raster → ESC/POS.
 * Assets are offline (local logo + offline QR) so this stays fast.
 */
async function printBleReceiptHtml(
    data: PrintReceiptData,
    settings: PrintSettings,
): Promise<void> {
    const prepared = await withTimeout(
        prepareReceiptHtml(data, {
            ...settings,
            // prepareReceiptAssets inside uses offline QR + logo timeout
        }),
        8000,
        'Timeout siapkan struk HTML.',
    );

    const escPosBase64 = await withTimeout(
        captureReceiptHtmlToEscPos(prepared.html, prepared.settings),
        15000,
        'Timeout render struk (WebView).',
    );

    const payload = appendEscPosPaperCut(escPosBase64);
    // Fire-and-forget: native callback often never fires on some APK builds.
    printRawBase64(payload, 5000).catch((err) => {
        console.warn('[Print] printRawData settle:', err);
    });
    await delay(1200);
}

/**
 * Text fallback — same fields as QZ document model, no logo/QR image.
 */
async function printBleReceiptText(
    data: PrintReceiptData,
    settings: PrintSettings,
): Promise<void> {
    const receiptText = generateBleReceiptText(data, settings);
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    printBillTextFireAndForget(receiptText, {
        cut: true,
        beep: false,
        tailingLine: true,
        encoding: 'UTF8',
    });
    await delay(800);
}

/**
 * Android BLE thermal print.
 * Primary: HTML identical to QZ Tray (logo + layout + QR image).
 * Fallback: fast text ESC/POS if WebView/raster fails.
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

    await withTimeout(
        printer.init(),
        6000,
        'Timeout inisialisasi printer Bluetooth.',
    );
    await withTimeout(
        printer.connectPrinter(macAddress),
        10000,
        'Timeout koneksi printer. Pastikan printer menyala dan sudah dipair.',
    );

    try {
        await withTimeout(
            printBleReceiptHtml(data, normalizedSettings),
            22000,
            'Timeout cetak HTML struk.',
        );
        return;
    } catch (htmlError) {
        console.warn('[Print] HTML/QZ-matching path failed, text fallback:', htmlError);
    }

    await printBleReceiptText(data, normalizedSettings);
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
