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

function rejectJob(job: ReceiptHtmlCaptureJob, message: string): void {
    job.reject(new Error(message));
}

function clearActiveJob(message?: string): void {
    if (activeJob && message) {
        rejectJob(activeJob, message);
    }
    activeJob = null;
}

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
    if (!runner) {
        clearActiveJob('Layanan render struk WebView dihentikan. Coba cetak lagi.');
        pendingJobs.splice(0).forEach((job) => {
            rejectJob(job, 'Layanan render struk WebView dihentikan. Coba cetak lagi.');
        });
        captureRunner = null;
        return;
    }

    if (activeJob) {
        clearActiveJob('Render struk WebView sebelumnya dibatalkan. Coba cetak lagi.');
    }

    captureRunner = runner;
    pumpCaptureQueue();
}

/** Returns ESC/POS raster bytes as base64 (produced inside WebView via html2canvas). */
export function captureReceiptHtmlToEscPos(
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

/** @deprecated Use captureReceiptHtmlToEscPos */
export const captureReceiptHtmlToImage = captureReceiptHtmlToEscPos;