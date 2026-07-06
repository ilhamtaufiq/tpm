import { PrintSettings } from './printSettings';

export interface ReceiptHtmlCaptureJob {
    receiptHtml: string;
    settings: PrintSettings;
    resolve: (escPosBase64: string) => void;
    reject: (error: Error) => void;
}

type ReceiptHtmlCaptureRunner = ((job: ReceiptHtmlCaptureJob) => void) | null;

let captureRunner: ReceiptHtmlCaptureRunner = null;
let pendingJobs: ReceiptHtmlCaptureJob[] = [];
let activeJob: ReceiptHtmlCaptureJob | null = null;

function pumpCaptureQueue(): void {
    if (activeJob || pendingJobs.length === 0 || !captureRunner) {
        return;
    }

    const job = pendingJobs.shift()!;
    activeJob = job;

    captureRunner({
        receiptHtml: job.receiptHtml,
        settings: job.settings,
        resolve: (escPosBase64: string) => {
            job.resolve(escPosBase64);
            activeJob = null;
            pumpCaptureQueue();
        },
        reject: (error: Error) => {
            job.reject(error);
            activeJob = null;
            pumpCaptureQueue();
        },
    });
}

export function registerReceiptHtmlCaptureHost(runner: ReceiptHtmlCaptureRunner): void {
    captureRunner = runner;
    pumpCaptureQueue();
}

export function captureReceiptHtmlToImage(
    receiptHtml: string,
    settings: PrintSettings,
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!captureRunner) {
            reject(new Error('Layanan render struk belum siap. Tunggu beberapa detik lalu coba cetak lagi.'));
            return;
        }

        pendingJobs.push({
            receiptHtml,
            settings,
            resolve,
            reject,
        });
        pumpCaptureQueue();
    });
}