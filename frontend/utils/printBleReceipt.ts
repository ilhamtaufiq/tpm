import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { generateBleReceiptText } from './generateBleReceiptText';
import { printBillTextFireAndForget } from './blePrintTransport';

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
 * Android BLE thermal print — fast text ESC/POS path only.
 *
 * Why text (not HTML raster):
 * - HTML/WebView/QR download made UI sit on "Printing..." for a long time
 * - Large raster payloads often buffer-stall on cheap BLE thermal printers
 * - Content still matches QZ via shared buildReceiptDocument / generateBleReceiptText
 *
 * Uses fire-and-forget printRawData (same pattern as Bluetooth pair test printText)
 * because many APK builds never invoke the native callback.
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
    // No logo/QR prepare — text path does not need network assets.
    const printSettings: PrintSettings = {
        ...settings,
        paperSize: paper.paperSize,
    };

    const receiptText = generateBleReceiptText(data, printSettings);
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

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

    // Sync encode + native handoff (no await on printer callback).
    printBillTextFireAndForget(receiptText, {
        cut: true,
        beep: false,
        tailingLine: true,
        encoding: 'UTF8',
    });

    // Short settle so BLE buffer can flush; keep UI responsive.
    await delay(900);
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
