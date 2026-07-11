import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getBleNativeLayout, getPaperDimensions } from './paperSize';
import { buildReceiptDocument } from './receiptDocument';
import { prepareReceiptHtml } from './prepareReceiptHtml';
import { generateBleReceiptText } from './generateBleReceiptText';
import {
    isBleImagePrintAvailable,
    isBleQrPrintAvailable,
    printBillTextFireAndForget,
    printImageDataFireAndForget,
    printQrCodeFireAndForget,
    printRawBase64,
} from './blePrintTransport';
import {
    captureReceiptHtmlToEscPos,
    waitForReceiptHtmlCaptureHost,
} from './receiptHtmlCapture';
import { appendEscPosPaperCut } from './receiptEscPos';
import { prepareBleLogoPayload } from './receiptLogo';
import { buildOfflineQrDataUrl } from './receiptQrOffline';

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

function stripDataUrlPrefix(dataUrl: string): string | null {
    const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    return match?.[1] ?? null;
}

function formatBlePrintError(error: unknown): Error {
    const raw = error instanceof Error ? error.message : String(error || 'unknown');
    if (raw.includes('belum siap') || raw.includes('WebView')) {
        return new Error(`Cetak struk (layout QZ) gagal: ${raw}`);
    }
    if (raw.toLowerCase().includes('timeout')) {
        return new Error(
            `Cetak struk timeout: ${raw} Pastikan printer Bluetooth menyala, dekat, dan sudah dipair.`,
        );
    }
    if (raw.toLowerCase().includes('bluetooth') || raw.toLowerCase().includes('connect')) {
        return new Error(`Koneksi printer gagal: ${raw}`);
    }
    return new Error(`Gagal cetak struk thermal: ${raw}`);
}

/**
 * Primary path: same HTML as QZ Tray → WebView html2canvas → ESC/POS raster.
 * Responsive 58mm/80mm + logo + QR embedded in one bitmap (visual match to QZ).
 */
async function printBleReceiptHtml(
    data: PrintReceiptData,
    settings: PrintSettings,
): Promise<void> {
    await withTimeout(
        waitForReceiptHtmlCaptureHost(12000),
        13000,
        'Timeout menunggu layanan render struk WebView.',
    );

    const prepared = await withTimeout(
        prepareReceiptHtml(data, settings),
        12000,
        'Timeout siapkan HTML struk (logo/QR).',
    );

    if (!prepared.html || prepared.html.length < 64) {
        throw new Error('HTML struk kosong. Periksa pengaturan cetak.');
    }

    if (!prepared.settings.logoUri) {
        console.warn('[Print] HTML path: logo empty after prepare — receipt will print without logo');
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
    printRawBase64(payload, 8000).catch((err) => {
        console.warn('[Print] printRawData settle (data already sent):', err);
    });
    await delay(1500);

    console.log('[Print] BLE HTML/QZ raster sent', {
        paper: settings.paperSize,
        logo: Boolean(prepared.settings.logoUri),
        bytesApprox: Math.round((payload.length * 3) / 4),
    });
}

async function prepareLogoPayloadSafe(
    settings: PrintSettings,
    maxWidthPx: number,
): Promise<string | null> {
    if (!isBleImagePrintAvailable()) return null;
    try {
        return await withTimeout(
            prepareBleLogoPayload(settings.logoUri ?? 'tpm_default', maxWidthPx),
            6000,
            'logo-timeout',
        );
    } catch (error) {
        console.warn('[Print] logo prepare skipped:', error);
        return null;
    }
}

/**
 * Prefer sized offline PNG QR (matches HTML qrSize after scale).
 * Native printQrCode size is printer-fixed and often too large on 58mm.
 */
async function printQrGraphics(
    qrUrl: string,
    qrSizeDots: number,
    qrEncodePx: number,
): Promise<boolean> {
    if (isBleImagePrintAvailable()) {
        try {
            const dataUrl = await withTimeout(
                buildOfflineQrDataUrl(qrUrl, qrEncodePx),
                3000,
                'qr-encode-timeout',
            );
            if (dataUrl) {
                const base64 = stripDataUrlPrefix(dataUrl);
                if (base64) {
                    const payload = JSON.stringify({
                        imageBase64: base64,
                        mime: 'image/png',
                        maxWidth: qrSizeDots,
                    });
                    printImageDataFireAndForget(payload);
                    // Larger QR on 80mm needs a bit more BLE buffer time.
                    await delay(qrSizeDots > 160 ? 700 : 500);
                    return true;
                }
            }
        } catch (error) {
            console.warn('[Print] sized QR image failed, try native:', error);
        }
    }

    if (isBleQrPrintAvailable()) {
        try {
            printQrCodeFireAndForget(qrUrl);
            await delay(500);
            return true;
        } catch (error) {
            console.warn('[Print] native printQrCode failed:', error);
        }
    }

    return false;
}

/**
 * Fallback path: native ESC/POS text + logo/QR sized from the same paper map as HTML/QZ.
 */
async function printBleReceiptNative(
    data: PrintReceiptData,
    settings: PrintSettings,
): Promise<void> {
    const layout = getBleNativeLayout(settings.paperSize);
    const doc = buildReceiptDocument(data, settings);
    const wantQr = Boolean(doc.showQr && doc.qrUrl);
    const tryQrGraphics = wantQr && (isBleQrPrintAvailable() || isBleImagePrintAvailable());

    const receiptText = generateBleReceiptText(data, settings, {
        includeFooter: !tryQrGraphics,
        includeQrPlaceholder: wantQr && !tryQrGraphics,
        charWidth: layout.textCharWidth,
    });
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    const logoPayload = await prepareLogoPayloadSafe(settings, layout.logoMaxDots);

    console.log('[Print] BLE native fallback (HTML-aligned sizes)', {
        paper: layout.paperSize,
        textCols: layout.textCharWidth,
        logoDots: layout.logoMaxDots,
        qrDots: layout.qrSizeDots,
        logo: Boolean(logoPayload),
        wantQr,
        tryQrGraphics,
        chars: receiptText.length,
    });

    if (logoPayload) {
        try {
            printImageDataFireAndForget(logoPayload);
            // Wait scales with logo size so text does not interleave mid-raster.
            await delay(layout.logoMaxDots > 200 ? 1000 : 800);
        } catch (logoErr) {
            console.warn('[Print] logo print skipped:', logoErr);
        }
    }

    printBillTextFireAndForget(receiptText, {
        cut: !tryQrGraphics,
        beep: false,
        tailingLine: !tryQrGraphics,
        encoding: 'UTF8',
    });
    await delay(tryQrGraphics ? 550 : 750);

    if (tryQrGraphics && doc.qrUrl) {
        const qrOk = await printQrGraphics(
            doc.qrUrl,
            layout.qrSizeDots,
            layout.qrEncodePx,
        );
        const tailLines = [
            `<C>${doc.qrCaption}</C>`,
            qrOk ? '' : '<C>Buka link struk digital di HP</C>',
            `<C>${doc.footer}</C>`,
            '',
            '',
        ].filter((line, i, arr) => !(line === '' && arr[i - 1] === ''));

        printBillTextFireAndForget(tailLines.join('\n'), {
            cut: true,
            beep: false,
            tailingLine: true,
            encoding: 'UTF8',
        });
        await delay(550);
    }
}

/**
 * Android BLE thermal print.
 *
 * 1) Primary: HTML identical to QZ Tray (logo + 58/80mm layout + QR) via WebView raster
 * 2) Fallback: native ESC/POS text + printImageData logo + QR
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

        try {
            await withTimeout(
                printBleReceiptHtml(data, normalizedSettings),
                28000,
                'Timeout cetak HTML struk (mode QZ).',
            );
            return;
        } catch (htmlError) {
            console.warn('[Print] HTML/QZ path failed, native fallback:', htmlError);
        }

        await printBleReceiptNative(data, normalizedSettings);
        console.log('[Print] BLE native fallback sent');
    } catch (error) {
        console.error('[Print] BLE print failed:', error);
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
            publicReceiptToken: 'test-receipt-token',
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
        {
            ...settings,
            showQRCode: true,
            // Force default logo on test if unset so logo path is exercised.
            logoUri: settings.logoUri || 'tpm_default',
            footer: `Test ${paper.paperSize} • ${new Date().toLocaleString('id-ID')}`,
        },
        macAddress,
    );
}
