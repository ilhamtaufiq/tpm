import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getBleNativeLayout, getPaperDimensions } from './paperSize';
import { buildReceiptDocument } from './receiptDocument';
import { generateBleReceiptText } from './generateBleReceiptText';
import {
    isBleImagePrintAvailable,
    isBleQrPrintAvailable,
    printBillTextFireAndForget,
    printImageDataAsync,
    printImageDataFireAndForget,
    printQrCodeAsync,
} from './blePrintTransport';
import { prepareBleLogoPayload, prepareDefaultBleLogoPayload } from './receiptLogo';
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
 * Logo is required on every thermal receipt.
 * Try settings logo → default asset → clear cache and retry default.
 */
async function prepareLogoPayloadRequired(
    settings: PrintSettings,
    maxWidthPx: number,
): Promise<string | null> {
    if (!isBleImagePrintAvailable()) {
        console.error('[Print] printImageData native missing — logo cannot print. Rebuild APK.');
        return null;
    }

    const tryPrepare = async (uri: string | null | undefined, forceDefault = false) => {
        try {
            if (forceDefault) {
                return await withTimeout(
                    prepareDefaultBleLogoPayload(maxWidthPx),
                    8000,
                    'logo-default-timeout',
                );
            }
            return await withTimeout(
                prepareBleLogoPayload(uri || 'tpm_default', maxWidthPx),
                8000,
                'logo-timeout',
            );
        } catch (error) {
            console.warn('[Print] logo prepare attempt failed:', error);
            return null;
        }
    };

    let payload = await tryPrepare(settings.logoUri ?? 'tpm_default');
    if (!payload) {
        payload = await tryPrepare('tpm_default', true);
    }
    if (!payload) {
        console.error('[Print] logo prepare failed completely');
    }
    return payload;
}

/** Print logo and wait until native finishes (or soft-timeout). */
async function printLogoRequired(logoPayload: string): Promise<boolean> {
    try {
        await printImageDataAsync(logoPayload, 10000);
        // Small settle so BLE buffer drains before text ESC/POS.
        await delay(200);
        return true;
    } catch (error) {
        console.warn('[Print] logo print failed, retry once:', error);
        try {
            printImageDataFireAndForget(logoPayload);
            await delay(1200);
            return true;
        } catch (retryErr) {
            console.error('[Print] logo print retry failed:', retryErr);
            return false;
        }
    }
}

/**
 * Print QR for thermal:
 * 1) Native ZXing (sharp modules, most reliable on BLE printers)
 * 2) Offline PNG via printImageData (sized to paper)
 */
async function printQrGraphics(
    qrUrl: string,
    qrSizeDots: number,
    qrEncodePx: number,
): Promise<boolean> {
    if (isBleQrPrintAvailable()) {
        try {
            await printQrCodeAsync(qrUrl, 8000);
            await delay(150);
            return true;
        } catch (error) {
            console.warn('[Print] native printQrCode failed, try image:', error);
        }
    }

    if (!isBleImagePrintAvailable()) {
        return false;
    }

    try {
        const dataUrl = await withTimeout(
            buildOfflineQrDataUrl(qrUrl, qrEncodePx),
            4000,
            'qr-encode-timeout',
        );
        if (!dataUrl) return false;

        const base64 = stripDataUrlPrefix(dataUrl);
        if (!base64) return false;

        const payload = JSON.stringify({
            imageBase64: base64,
            mime: 'image/png',
            maxWidth: Math.max(120, Math.min(320, qrSizeDots)),
        });
        await printImageDataAsync(payload, 8000);
        await delay(150);
        return true;
    } catch (error) {
        console.warn('[Print] QR image failed:', error);
        return false;
    }
}

/**
 * Android BLE thermal — native ESC/POS (sharp text).
 * Logo + body text + QR + short footer; no HTML raster (was blurry + huge blank tail).
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
    const layout = getBleNativeLayout(paper.paperSize);
    const normalizedSettings: PrintSettings = {
        ...settings,
        paperSize: paper.paperSize,
        showQRCode: settings.showQRCode !== false,
    };

    const doc = buildReceiptDocument(data, normalizedSettings);
    const wantQr = Boolean(normalizedSettings.showQRCode && doc.qrUrl);
    const canGraphics = isBleQrPrintAvailable() || isBleImagePrintAvailable();
    // Always try graphics when QR wanted; if hardware APIs missing, text placeholder.
    const tryQrGraphics = wantQr && canGraphics;

    const receiptText = generateBleReceiptText(data, normalizedSettings, {
        // Footer printed after QR so cut does not leave a long blank before QR.
        includeFooter: !tryQrGraphics,
        includeQrPlaceholder: wantQr && !tryQrGraphics,
        charWidth: layout.textCharWidth,
    });
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    // Prepare logo before connect so print path always has bytes ready.
    const logoPayload = await prepareLogoPayloadRequired(
        normalizedSettings,
        layout.logoMaxDots,
    );

    console.log('[Print] BLE native ESC/POS', {
        paper: layout.paperSize,
        textCols: layout.textCharWidth,
        logoDots: layout.logoMaxDots,
        qrDots: layout.qrSizeDots,
        logo: Boolean(logoPayload),
        imageApi: isBleImagePrintAvailable(),
        wantQr,
        tryQrGraphics,
        qrUrl: doc.qrUrl ? doc.qrUrl.slice(0, 48) : null,
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

        // 1) Logo — required; print before text and wait for native completion.
        if (logoPayload) {
            const logoOk = await printLogoRequired(logoPayload);
            if (!logoOk) {
                // Last resort: re-prepare default and fire once more.
                const fallback = await prepareLogoPayloadRequired(
                    { ...normalizedSettings, logoUri: 'tpm_default' },
                    layout.logoMaxDots,
                );
                if (fallback) {
                    await printLogoRequired(fallback);
                }
            }
        } else {
            console.error('[Print] printing without logo — prepare failed');
        }

        // 2) Body — no cut yet if QR follows; minimal tail feed (avoid long blank).
        printBillTextFireAndForget(receiptText, {
            cut: !tryQrGraphics,
            beep: false,
            tailingLine: false,
            encoding: 'UTF8',
        });
        await delay(tryQrGraphics ? 450 : 600);

        // 3) QR + caption + footer + cut
        if (tryQrGraphics && doc.qrUrl) {
            const qrOk = await printQrGraphics(
                doc.qrUrl,
                layout.qrSizeDots,
                layout.qrEncodePx,
            );

            const tailLines: string[] = [];
            if (qrOk) {
                tailLines.push(`<C>${doc.qrCaption}</C>`);
            } else {
                // QR graphics failed — still print caption so user knows digital receipt exists.
                tailLines.push(`<C>${doc.qrCaption}</C>`);
                tailLines.push('<C>Buka link struk digital di HP</C>');
            }
            if (doc.footer) {
                tailLines.push(`<C>${doc.footer}</C>`);
            }
            // One blank line only before cut (not a long feed).
            tailLines.push('');

            printBillTextFireAndForget(tailLines.join('\n'), {
                cut: true,
                beep: false,
                tailingLine: false,
                encoding: 'UTF8',
            });
            await delay(500);
        }

        console.log('[Print] BLE native sent');
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
            logoUri: settings.logoUri || 'tpm_default',
            footer: `Test ${paper.paperSize} • ${new Date().toLocaleString('id-ID')}`,
        },
        macAddress,
    );
}
