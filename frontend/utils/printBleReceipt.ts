import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { getBLEPrinter } from './blePrinter';
import { getPaperDimensions } from './paperSize';
import { buildReceiptDocument } from './receiptDocument';
import { generateBleReceiptText } from './generateBleReceiptText';
import {
    isBleImagePrintAvailable,
    isBleQrPrintAvailable,
    printBillTextFireAndForget,
    printImageDataFireAndForget,
    printQrCodeFireAndForget,
} from './blePrintTransport';
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

async function prepareLogoPayloadSafe(
    settings: PrintSettings,
    maxWidthPx: number,
): Promise<string | null> {
    if (!isBleImagePrintAvailable()) return null;
    try {
        return await withTimeout(
            prepareBleLogoPayload(settings.logoUri ?? 'tpm_default', maxWidthPx),
            4000,
            'logo-timeout',
        );
    } catch (error) {
        console.warn('[Print] logo prepare skipped:', error);
        return null;
    }
}

/**
 * Print QR: prefer native printQrCode (ZXing), fallback to offline PNG via printImageData.
 * Returns true if a graphics QR was sent.
 */
async function printQrGraphics(
    qrUrl: string,
    qrSizeDots: number,
): Promise<boolean> {
    // 1) Native ZXing bitmap (fast, no JS encode)
    if (isBleQrPrintAvailable()) {
        try {
            printQrCodeFireAndForget(qrUrl);
            await delay(500);
            return true;
        } catch (error) {
            console.warn('[Print] native printQrCode failed, try image fallback:', error);
        }
    }

    // 2) Offline PNG QR → same printImageData path as logo
    if (!isBleImagePrintAvailable()) {
        return false;
    }

    try {
        const dataUrl = await withTimeout(
            buildOfflineQrDataUrl(qrUrl, Math.min(200, Math.max(120, qrSizeDots))),
            3000,
            'qr-encode-timeout',
        );
        if (!dataUrl) return false;

        const base64 = stripDataUrlPrefix(dataUrl);
        if (!base64) return false;

        const payload = JSON.stringify({
            imageBase64: base64,
            mime: 'image/png',
            maxWidth: Math.max(120, Math.min(280, qrSizeDots)),
        });
        printImageDataFireAndForget(payload);
        await delay(500);
        return true;
    } catch (error) {
        console.warn('[Print] QR image fallback failed:', error);
        return false;
    }
}

/**
 * Android BLE thermal print — native ESC/POS + logo + QR (layout closer to QZ).
 *
 * Order:
 *  1. Logo (printImageData)
 *  2. Body text (same fields as buildReceiptDocument / QZ)
 *  3. QR graphics (printQrCode or offline PNG)
 *  4. Caption + footer + cut
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

    const doc = buildReceiptDocument(data, normalizedSettings);
    const wantQr = Boolean(doc.showQr && doc.qrUrl);
    // Assume we can try graphics QR; if both native paths fail we still print text caption.
    const tryQrGraphics = wantQr && (isBleQrPrintAvailable() || isBleImagePrintAvailable());

    const receiptText = generateBleReceiptText(data, normalizedSettings, {
        includeFooter: !tryQrGraphics,
        // Placeholder only if we cannot attempt graphics at all
        includeQrPlaceholder: wantQr && !tryQrGraphics,
    });
    if (!receiptText || receiptText.trim().length < 8) {
        throw new Error('Struk kosong. Periksa pengaturan cetak.');
    }

    // Logo ~40% of printable width (centered, not full roll).
    const logoMaxDots = Math.round(paper.bleImageWidthPx * 0.4);
    const logoPayload = await prepareLogoPayloadSafe(normalizedSettings, logoMaxDots);

    // QR size: ~ half of paper width in dots (readable, not huge).
    const qrSizeDots = Math.round(paper.bleImageWidthPx * 0.48);

    console.log('[Print] BLE native + logo/QR', {
        paper: paper.paperSize,
        txn: data.transactionNumber,
        logo: Boolean(logoPayload),
        wantQr,
        tryQrGraphics,
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

        // 1) Logo
        if (logoPayload) {
            try {
                printImageDataFireAndForget(logoPayload);
                await delay(550);
            } catch (logoErr) {
                console.warn('[Print] logo print skipped:', logoErr);
            }
        }

        // 2) Body (hold cut if QR graphics will follow)
        printBillTextFireAndForget(receiptText, {
            cut: !tryQrGraphics,
            beep: false,
            tailingLine: !tryQrGraphics,
            encoding: 'UTF8',
        });
        await delay(tryQrGraphics ? 550 : 750);

        // 3) QR + caption + footer + cut
        if (tryQrGraphics && doc.qrUrl) {
            const qrOk = await printQrGraphics(doc.qrUrl, qrSizeDots);

            const tailLines = [
                qrOk ? `<C>${doc.qrCaption}</C>` : `<C>${doc.qrCaption}</C>`,
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

        console.log('[Print] BLE native + logo/QR sent');
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
            footer: `Test ${paper.paperSize} • ${new Date().toLocaleString('id-ID')}`,
        },
        macAddress,
    );
}
