import { PrintSettings } from './printSettings';

export interface ReceiptHtmlCaptureJob {
    receiptHtml: string;
    settings: PrintSettings;
    resolve: (fileUri: string) => void;
    reject: (error: Error) => void;
}

type ReceiptHtmlCaptureHandler = ((job: ReceiptHtmlCaptureJob) => void) | null;

let captureHandler: ReceiptHtmlCaptureHandler = null;

export function registerReceiptHtmlCaptureHost(handler: ReceiptHtmlCaptureHandler): void {
    captureHandler = handler;
}

export function captureReceiptHtmlToImage(
    receiptHtml: string,
    settings: PrintSettings,
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!captureHandler) {
            reject(new Error('Layanan render struk belum siap. Tutup dan buka ulang aplikasi.'));
            return;
        }

        captureHandler({
            receiptHtml,
            settings,
            resolve,
            reject,
        });
    });
}