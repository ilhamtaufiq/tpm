import { generateReceiptHTML, PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';
import { prepareReceiptAssets, PreparedReceiptAssets } from './prepareReceiptAssets';

export interface PreparedReceiptPrint extends PreparedReceiptAssets {
    html: string;
}

export async function prepareReceiptHtml(
    data: PrintReceiptData,
    settings?: PrintSettings,
): Promise<PreparedReceiptPrint> {
    const assets = await prepareReceiptAssets(data, settings);
    const html = generateReceiptHTML(data, assets.settings, { qrImageDataUrl: assets.qrImageDataUrl });
    return { ...assets, html };
}

export { prepareReceiptAssets } from './prepareReceiptAssets';