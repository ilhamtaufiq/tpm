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

    const base64Logo = await ensureLogoBase64(normalizedSettings.logoUri ?? 'tpm_default');
    const processedSettings: PrintSettings = {
        ...normalizedSettings,
        logoUri: base64Logo,
    };

    let qrImageDataUrl: string | null = null;
    if (!options?.skipQrImage && Platform.OS === 'android' && processedSettings.showQRCode) {
        const doc = buildReceiptDocument(data, processedSettings);
        if (doc.showQr && doc.qrUrl) {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${paper.qrSizePx}x${paper.qrSizePx}&data=${encodeURIComponent(doc.qrUrl)}`;
            qrImageDataUrl = await fetchImageAsDataUrl(qrApiUrl);
        }
    }

    return { settings: processedSettings, qrImageDataUrl };
}