import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { prepareReceiptHtml } from './prepareReceiptHtml';
import { printRawBase64 } from './blePrintTransport';
import {
    captureReceiptHtmlToEscPos,
    waitForReceiptHtmlCaptureHost,
} from './receiptHtmlCapture';
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

function formatBlePrintError(error: unknown): Error {
    const raw = error instanceof Error ? error.message : String(error || 'unknown');
    // Surface a single clear message — no silent text fallback.
    if (raw.includes('belum siap') || raw.includes('WebView')) {
        return new Error(
            `Cetak struk (layout QZ) gagal: ${raw}`,
        );
    }
    if (raw.toLowerCase().includes('timeout')) {
        return new Error(
            `Cetak struk timeout: ${raw} Pastikan printer Bluetooth menyala, dekat, dan sudah dipair.`,
        );
    }
    if (raw.toLowerCase().includes('bluetooth') || raw.toLowerCase().includes('connect')) {
        return new Error(
            `Koneksi printer gagal: ${raw}`,
        );
    }
    return new Error(
        `Gagal cetak struk thermal (mode HTML sama QZ Tray): ${raw}`,
    );
}

/**
 * Android BLE thermal print — HTML-only path matching QZ Tray layout.
 *
 * Uses the same generateReceiptHTML as web/QZ, rasterized in an offscreen WebView,
 * then sent as ESC/POS. No silent text fallback (text looks different from QZ).
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

    console.log('[Print] BLE path=HTML/QZ (no text fallback)', {
        paper: paper.paperSize,
        txn: data.transactionNumber,
    });

    try {
        // Ensure capture host is up before connect so we fail fast with a clear message.
        await withTimeout(
            waitForReceiptHtmlCaptureHost(12000),
            13000,
            'Timeout menunggu layanan render struk WebView.',
        );

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

        const prepared = await withTimeout(
            prepareReceiptHtml(data, normalizedSettings),
            10000,
            'Timeout siapkan HTML struk (logo/QR).',
        );

        if (!prepared.html || prepared.html.length < 64) {
            throw new Error('HTML struk kosong. Periksa pengaturan cetak.');
        }

        const escPosBase64 = await withTimeout(
            captureReceiptHtmlToEscPos(prepared.html, prepared.settings),
            20000,
            'Timeout render struk WebView (html2canvas).',
        );

        if (!escPosBase64 || escPosBase64.length < 32) {
            throw new Error('Data raster struk kosong setelah render.');
        }

        const payload = appendEscPosPaperCut(escPosBase64);

        // Fire-and-forget: some APK builds never invoke the native callback.
        printRawBase64(payload, 8000).catch((err) => {
            console.warn('[Print] printRawData settle (data already sent):', err);
        });

        // Let BLE buffer flush before returning UI success.
        await delay(1500);
        console.log('[Print] BLE HTML/QZ raster sent', {
            bytesApprox: Math.round((payload.length * 3) / 4),
        });
    } catch (error) {
        console.error('[Print] BLE HTML/QZ failed (no text fallback):', error);
        throw formatBlePrintError(error);
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
