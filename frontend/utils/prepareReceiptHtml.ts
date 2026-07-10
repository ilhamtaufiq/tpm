import { Platform } from 'react-native';
import { generateReceiptHTML, PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import {
    prepareReceiptAssets,
    PreparedReceiptAssets,
    PrepareReceiptAssetsOptions,
} from './prepareReceiptAssets';

export interface PreparedReceiptPrint extends PreparedReceiptAssets {
    html: string;
}

export async function prepareReceiptHtml(
    data: PrintReceiptData,
    settings?: PrintSettings,
    options?: PrepareReceiptAssetsOptions,
): Promise<PreparedReceiptPrint> {
    // Android thermal WebView: local logo + offline QR (no network hang).
    const assetOptions: PrepareReceiptAssetsOptions = {
        ...options,
        localLogoOnly: options?.localLogoOnly ?? Platform.OS === 'android',
    };

    const assets = await prepareReceiptAssets(data, settings, assetOptions);
    const html = generateReceiptHTML(data, assets.settings, {
        qrImageDataUrl: assets.qrImageDataUrl,
    });
    return { ...assets, html };
}

export { prepareReceiptAssets } from './prepareReceiptAssets';
