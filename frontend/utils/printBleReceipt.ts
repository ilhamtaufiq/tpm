import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getBleNativeLayout, getPaperDimensions } from './paperSize';
import { buildReceiptDocument } from './receiptDocument';
import { generateBleReceiptText } from './generateBleReceiptText';
import {
    billCenterLinesToBase64,
    isBleImagePrintAvailable,
    isBleQrPrintAvailable,
    printBillText,
    printImageDataAsync,
    printImageDataFireAndForget,
    printQrCodeAsync,
    printRawBase64,
    printRawBase64FireAndForget,
} from './blePrintTransport';
import { buildLogoEscPosBase64 } from './bleLogoEscPos';
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
 * Print logo — primary path is ESC/POS via printRawData (works on all APKs that print text).
 * Secondary: native printImageData JSON payload (needs patched APK).
 */
async function printLogoRequired(
    settings: PrintSettings,
    logoMaxDots: number,
): Promise<boolean> {
    // 1) ESC/POS raster → printRawData (same transport as body text — most reliable)
    try {
        const escPos = await withTimeout(
            buildLogoEscPosBase64(settings.logoUri || 'tpm_default', logoMaxDots),
            10000,
            'logo-escpos-timeout',
        );
        if (escPos && escPos.length > 32) {
            try {
                await printRawBase64(escPos, 12000);
                await delay(250);
                console.log('[Print] logo sent via printRawData ESC/POS');
                return true;
            } catch (rawErr) {
                console.warn('[Print] logo raw await failed, fire-and-forget:', rawErr);
                printRawBase64FireAndForget(escPos);
                await delay(1500);
                console.log('[Print] logo sent via printRawData (fire-and-forget)');
                return true;
            }
        }
    } catch (e) {
        console.warn('[Print] logo ESC/POS path failed:', e);
    }

    // 2) Fallback native printImageData (patched JSON payload)
    if (!isBleImagePrintAvailable()) {
        console.error('[Print] logo failed: no ESC/POS and no printImageData');
        return false;
    }

    try {
        let payload = await withTimeout(
            prepareBleLogoPayload(settings.logoUri || 'tpm_default', logoMaxDots),
            8000,
            'logo-payload-timeout',
        );
        if (!payload) {
            payload = await withTimeout(
                prepareDefaultBleLogoPayload(logoMaxDots),
                8000,
                'logo-default-timeout',
            );
        }
        if (!payload) return false;

        try {
            await printImageDataAsync(payload, 10000);
            await delay(200);
            console.log('[Print] logo sent via printImageData');
            return true;
        } catch {
            printImageDataFireAndForget(payload);
            await delay(1200);
            console.log('[Print] logo sent via printImageData (fire-and-forget)');
            return true;
        }
    } catch (e) {
        console.error('[Print] logo printImageData path failed:', e);
        return false;
    }
}

/**
 * Print QR for thermal (prefer our ESC/POS path — tighter feed, no native "2" artifact):
 * 1) Offline PNG → ESC/POS raw (same raster path as logo)
 * 2) Offline PNG via printImageData
 * 3) Native ZXing last (has extra line-space feed + ASCII align byte)
 */
async function printQrGraphics(
    qrUrl: string,
    qrSizeDots: number,
    qrEncodePx: number,
): Promise<boolean> {
    try {
        const dataUrl = await withTimeout(
            buildOfflineQrDataUrl(qrUrl, qrEncodePx),
            4000,
            'qr-encode-timeout',
        );
        if (dataUrl) {
            // Prefer raw ESC/POS so QR works without printImageData patch
            // and avoids native SET_LINE_SPACE_32 gap after the bitmap.
            const escPos = await withTimeout(
                buildLogoEscPosBase64(dataUrl, qrSizeDots),
                6000,
                'qr-escpos-timeout',
            );
            if (escPos && escPos.length > 32) {
                try {
                    await printRawBase64(escPos, 10000);
                    await delay(120);
                    return true;
                } catch {
                    printRawBase64FireAndForget(escPos);
                    await delay(800);
                    return true;
                }
            }

            if (isBleImagePrintAvailable()) {
                const base64 = stripDataUrlPrefix(dataUrl);
                if (base64) {
                    const payload = JSON.stringify({
                        imageBase64: base64,
                        mime: 'image/png',
                        maxWidth: Math.max(120, Math.min(320, qrSizeDots)),
                    });
                    await printImageDataAsync(payload, 8000);
                    await delay(120);
                    return true;
                }
            }
        }
    } catch (error) {
        console.warn('[Print] QR image failed, try native:', error);
    }

    if (isBleQrPrintAvailable()) {
        try {
            await printQrCodeAsync(qrUrl, 8000);
            await delay(120);
            return true;
        } catch (error) {
            console.warn('[Print] native printQrCode failed:', error);
        }
    }

    return false;
}

/**
 * Android BLE thermal — native ESC/POS (sharp text) + logo via printRawData raster.
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
        logoUri: settings.logoUri || 'tpm_default',
    };

    const doc = buildReceiptDocument(data, normalizedSettings);
    const wantQr = Boolean(normalizedSettings.showQRCode && doc.qrUrl);
    // QR can use raw ESC/POS even without image APIs
    const tryQrGraphics = wantQr;

    const receiptText = generateBleReceiptText(data, normalizedSettings, {
        includeFooter: !tryQrGraphics,
        includeQrPlaceholder: wantQr && !tryQrGraphics,
        charWidth: layout.textCharWidth,
    });
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    console.log('[Print] BLE native ESC/POS', {
        paper: layout.paperSize,
        textCols: layout.textCharWidth,
        logoDots: layout.logoMaxDots,
        qrDots: layout.qrSizeDots,
        imageApi: isBleImagePrintAvailable(),
        wantQr,
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

        // 1) Logo — best-effort; never block body text if logo fails
        let logoOk = false;
        try {
            logoOk = await printLogoRequired(normalizedSettings, layout.logoMaxDots);
            if (!logoOk) {
                console.error('[Print] WARNING: logo did not print — retry default');
                const retryEsc = await withTimeout(
                    buildLogoEscPosBase64('tpm_default', layout.logoMaxDots),
                    8000,
                    'logo-retry-timeout',
                );
                if (retryEsc && retryEsc.length > 32) {
                    await printRawBase64(retryEsc, 10000);
                    await delay(300);
                    logoOk = true;
                    console.log('[Print] logo retry default OK');
                }
            }
        } catch (logoErr) {
            console.error('[Print] logo path failed, continue with text:', logoErr);
        }

        // Let bitmap drain before text (avoids BLE buffer overwrite on cheap printers)
        await delay(logoOk ? 450 : 150);

        // 2) Body text — await send (fire-and-forget was finishing UI while printer got nothing)
        try {
            await printBillText(receiptText, {
                cut: !tryQrGraphics,
                beep: false,
                tailingLine: false,
                encoding: 'UTF8',
            });
            await delay(tryQrGraphics ? 350 : 500);
        } catch (bodyErr) {
            console.error('[Print] body text failed:', bodyErr);
            throw bodyErr;
        }

        // 3) QR + caption + footer + cut
        if (tryQrGraphics && doc.qrUrl) {
            const qrOk = await printQrGraphics(
                doc.qrUrl,
                layout.qrSizeDots,
                layout.qrEncodePx,
            );

            const tailLines: string[] = [];
            if (qrOk) {
                tailLines.push(doc.qrCaption);
            } else {
                tailLines.push(doc.qrCaption);
                tailLines.push('Buka link struk digital di HP');
            }
            if (doc.footer) {
                tailLines.push(doc.footer);
            }

            const tailBase64 = billCenterLinesToBase64(tailLines, { cut: true });
            try {
                await printRawBase64(tailBase64, 8000);
            } catch {
                printRawBase64FireAndForget(tailBase64);
            }
            await delay(300);
        }

        console.log('[Print] BLE native sent', { logoOk, bodyChars: receiptText.length });
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
