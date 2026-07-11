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
 * Android BLE thermal print — native ESC/POS only.
 *
 * Same content model as QZ (buildReceiptDocument → generateBleReceiptText),
 * but rendered as thermal text commands (not WebView/HTML raster).
 * Fire-and-forget printRawData so UI never sticks on native callback.
 */
export async function printBleReceipt(
    data: PrintReceiptData,
    settings: PrintSettings,
    macAddress: string,
): Promise<void> {
    const printer = getBLEPrinter();
    if (!printer) {
        throw new Error('Modul printer Bluetooth tidak tersedia di perangkat ini.');
    }

    const paper = getPaperDimensions(settings.paperSize);
    const normalizedSettings: PrintSettings = {
        ...settings,
        paperSize: paper.paperSize,
    };

    // Build text first (sync, no network) so failures are immediate.
    const receiptText = generateBleReceiptText(data, normalizedSettings);
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    console.log('[Print] BLE path=native ESC/POS', {
        paper: paper.paperSize,
        txn: data.transactionNumber,
        chars: receiptText.length,
    });

    try {
        await withTimeout(
            printer.init(),
            5000,
            'Timeout inisialisasi printer Bluetooth.',
        );
        await withTimeout(
            printer.connectPrinter(macAddress),
            8000,
            'Timeout koneksi printer. Pastikan printer menyala, dekat, dan sudah dipair.',
        );

        // Proven path (same as Bluetooth pair test): encode + send, do not await native callback.
        printBillTextFireAndForget(receiptText, {
            cut: true,
            beep: false,
            tailingLine: true,
            encoding: 'UTF8',
        });

        // Short settle for BLE buffer — keep under 1s so UI unsticks quickly.
        await delay(700);
        console.log('[Print] BLE native ESC/POS sent');
    } catch (error) {
        const raw = error instanceof Error ? error.message : String(error || 'unknown');
        console.error('[Print] BLE native failed:', error);
        if (raw.toLowerCase().includes('timeout') || raw.toLowerCase().includes('connect')) {
            throw new Error(
                `${raw} Pastikan printer Bluetooth menyala dan sudah dipair di Pengaturan.`,
            );
        }
        throw new Error(`Gagal cetak thermal: ${raw}`);
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
