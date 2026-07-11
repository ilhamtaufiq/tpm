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

/** True when ReceiptHtmlCaptureHost has registered its WebView runner. */
export function isReceiptHtmlCaptureReady(): boolean {
    return captureRunner != null;
}

/**
 * Wait until the offscreen WebView capture host is mounted (html2canvas cache ready).
 * Prevents race on cold start when user taps Print before host registers.
 */
export function waitForReceiptHtmlCaptureHost(
    timeoutMs = 12000,
    pollMs = 200,
): Promise<void> {
    if (captureRunner) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
            if (captureRunner) {
                clearInterval(timer);
                resolve();
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                clearInterval(timer);
                reject(
                    new Error(
                        'Layanan render struk (WebView) belum siap. Tutup app lalu buka lagi, tunggu beberapa detik, lalu cetak ulang.',
                    ),
                );
            }
        }, pollMs);
    });
}

/** Returns ESC/POS raster bytes as base64 (produced inside WebView via html2canvas). */
export async function captureReceiptHtmlToEscPos(
    receiptHtml: string,
    settings: PrintSettings,
): Promise<string> {
    await waitForReceiptHtmlCaptureHost();

    return new Promise((resolve, reject) => {
        if (!captureRunner) {
            reject(
                new Error(
                    'Layanan render struk belum siap. Tunggu beberapa detik lalu coba cetak lagi.',
                ),
            );
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