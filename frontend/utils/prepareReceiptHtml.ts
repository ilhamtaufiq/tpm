import { Platform } from 'react-native';
import { buildReceiptDocument } from './receiptDocument';
import { fetchImageAsDataUrl, ensureLogoBase64 } from './receiptLogo';
import { getPaperDimensions } from './paperSize';
import { generateReceiptHTML, PrintReceiptData } from './printReceipt';
import { PrintSettings, printSettingsService } from './printSettings';

export interface PreparedReceiptPrint {
    html: string;
    settings: PrintSettings;
}

export async function prepareReceiptHtml(
    data: PrintReceiptData,
    settings?: PrintSettings,
): Promise<PreparedReceiptPrint> {
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
    if (Platform.OS === 'android' && processedSettings.showQRCode) {
        const doc = buildReceiptDocument(data, processedSettings);
        if (doc.showQr && doc.qrUrl) {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${paper.qrSizePx}x${paper.qrSizePx}&data=${encodeURIComponent(doc.qrUrl)}`;
            qrImageDataUrl = await fetchImageAsDataUrl(qrApiUrl);
        }
    }

    const html = generateReceiptHTML(data, processedSettings, { qrImageDataUrl });
    return { html, settings: processedSettings };
}