import { PrintReceiptData } from './printReceipt';
import { PrintSettings } from './printSettings';

export interface ReceiptCaptureJob {
    data: PrintReceiptData;
    settings: PrintSettings;
    qrImageDataUrl: string | null;
    resolve: (imagePayload: string) => void;
    reject: (error: Error) => void;
}

type ReceiptCaptureRunner = ((job: ReceiptCaptureJob) => void) | null;

let captureRunner: ReceiptCaptureRunner = null;
let pendingJobs: ReceiptCaptureJob[] = [];
let activeJob: ReceiptCaptureJob | null = null;

function pumpCaptureQueue(): void {
    if (activeJob || pendingJobs.length === 0 || !captureRunner) {
        return;
    }

    const job = pendingJobs.shift()!;
    activeJob = job;

    captureRunner({
        data: job.data,
        settings: job.settings,
        qrImageDataUrl: job.qrImageDataUrl,
        resolve: (imagePayload: string) => {
            job.resolve(imagePayload);
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

export function registerReceiptCaptureHost(runner: ReceiptCaptureRunner): void {
    captureRunner = runner;
    pumpCaptureQueue();
}

export function captureReceiptForBle(
    data: PrintReceiptData,
    settings: PrintSettings,
    qrImageDataUrl: string | null,
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!captureRunner) {
            reject(new Error('Layanan render struk belum siap. Tunggu beberapa detik lalu coba cetak lagi.'));
            return;
        }

        pendingJobs.push({
            data,
            settings,
            qrImageDataUrl,
            resolve,
            reject,
        });
        pumpCaptureQueue();
    });
}