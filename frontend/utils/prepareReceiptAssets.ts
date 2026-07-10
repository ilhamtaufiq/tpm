import { Platform } from 'react-native';
import { buildReceiptDocument } from './receiptDocument';
import { fetchImageAsDataUrl, ensureLogoBase64 } from './receiptLogo';
import { getPaperDimensions } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings, printSettingsService } from './printSettings';

export interface PreparedReceiptAssets {
    settings: PrintSettings;
    qrImageDataUrl: string | null;
}

export interface PrepareReceiptAssetsOptions {
    /** Skip network QR download — use for fast BLE text receipts. */
    skipQrImage?: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(fallback);
            }
        }, ms);
        promise
            .then((value) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                }
            })
            .catch(() => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(fallback);
                }
            });
    });
}

export async function prepareReceiptAssets(
    data: PrintReceiptData,
    settings?: PrintSettings,
    options?: PrepareReceiptAssetsOptions,
): Promise<PreparedReceiptAssets> {
    const activeSettings = settings ?? await printSettingsService.getSettings();
    const paper = getPaperDimensions(activeSettings.paperSize);
    const normalizedSettings: PrintSettings = {
        ...activeSettings,
        paperSize: paper.paperSize,
    };

    // Cap logo conversion — never block BLE print on slow/remote logo fetch.
    const base64Logo = await withTimeout(
        ensureLogoBase64(normalizedSettings.logoUri ?? 'tpm_default'),
        5000,
        normalizedSettings.logoUri?.startsWith('data:') ? normalizedSettings.logoUri : null,
    );
    const processedSettings: PrintSettings = {
        ...normalizedSettings,
        logoUri: base64Logo,
    };

    let qrImageDataUrl: string | null = null;
    if (!options?.skipQrImage && Platform.OS === 'android' && processedSettings.showQRCode) {
        const doc = buildReceiptDocument(data, processedSettings);
        if (doc.showQr && doc.qrUrl) {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${paper.qrSizePx}x${paper.qrSizePx}&data=${encodeURIComponent(doc.qrUrl)}`;
            // Cap QR download — offline/slow network must not freeze the print button.
            qrImageDataUrl = await withTimeout(fetchImageAsDataUrl(qrApiUrl), 4000, null);
        }
    }

    return { settings: processedSettings, qrImageDataUrl };
}