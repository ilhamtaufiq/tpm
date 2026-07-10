import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from './api';
import {
    ExportPublicReceiptOptions,
    PUBLIC_RECEIPT_CAPTURE_ROOT_ID,
    buildPublicReceiptPdfPath,
    sanitizeFileName,
} from './exportPublicReceipt.shared';

export { prepareReceiptCapture, PUBLIC_RECEIPT_CAPTURE_ROOT_ID } from './exportPublicReceipt.shared';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveWebCaptureElement(ref: { current: unknown }): HTMLElement | null {
    const byId = document.getElementById(PUBLIC_RECEIPT_CAPTURE_ROOT_ID);
    if (byId) return byId;

    const node = ref.current;
    if (node instanceof HTMLElement) return node;

    const maybeNode = node as { _nativeTag?: HTMLElement } | null;
    if (maybeNode?._nativeTag instanceof HTMLElement) {
        return maybeNode._nativeTag;
    }

    return null;
}

async function waitForCaptureReady(element: HTMLElement): Promise<void> {
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(images.map((img) => new Promise<void>((resolve) => {
        if (img.complete) {
            resolve();
            return;
        }
        img.onload = () => resolve();
        img.onerror = () => resolve();
    })));
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await delay(350);
}

async function captureCardWeb(ref: { current: unknown }): Promise<HTMLCanvasElement> {
    const element = resolveWebCaptureElement(ref);
    if (!element) {
        throw new Error('Elemen struk tidak ditemukan di halaman');
    }

    await waitForCaptureReady(element);

    return html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#f8fafc',
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => {
            const root = clonedDoc.getElementById(PUBLIC_RECEIPT_CAPTURE_ROOT_ID);
            if (!root) return;
            root.style.transform = 'none';
            root.style.opacity = '1';
            root.style.visibility = 'visible';
        },
    });
}

function saveCanvasAsPng(canvas: HTMLCanvasElement, fileName: string): void {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function saveCanvasAsPdf(canvas: HTMLCanvasElement, fileName: string): void {
    const margin = 16;
    // Avoid tainted-canvas SecurityError by using PNG from same-origin capture
    const imgData = canvas.toDataURL('image/png');
    const contentWidth = canvas.width / 2;
    const contentHeight = canvas.height / 2;
    const pageWidth = contentWidth + margin * 2;
    const pageHeight = contentHeight + margin * 2;

    const pdf = new jsPDF({
        unit: 'px',
        format: [pageWidth, pageHeight],
        compress: true,
        hotfixes: ['px_scaling'],
    });

    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
    pdf.save(`${fileName}.pdf`);
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Delay revoke so Safari finishes the download
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function parseFilenameFromContentDisposition(header?: string | null): string | null {
    if (!header) return null;
    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utfMatch?.[1]) {
        try {
            return decodeURIComponent(utfMatch[1].replace(/["']/g, ''));
        } catch {
            return utfMatch[1].replace(/["']/g, '');
        }
    }
    const plainMatch = /filename="?([^";]+)"?/i.exec(header);
    return plainMatch?.[1] || null;
}

async function readAxiosBlobError(error: unknown): Promise<string> {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
        try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            if (parsed?.detail) return String(parsed.detail);
        } catch {
            // ignore
        }
    }
    if (typeof data === 'object' && data && 'detail' in (data as object)) {
        return String((data as { detail: unknown }).detail);
    }
    return (error as Error)?.message || 'Gagal membuat PDF struk';
}

async function downloadServerPdf(options: ExportPublicReceiptOptions): Promise<void> {
    if (!options.receiptId) {
        throw new Error('ID struk tidak valid');
    }

    const path = buildPublicReceiptPdfPath(options.receiptType, options.receiptId);
    let response;
    try {
        response = await api.get(path, {
            responseType: 'blob',
            timeout: 30000,
        });
    } catch (error) {
        throw new Error(await readAxiosBlobError(error));
    }

    const contentType = String(response.headers?.['content-type'] || '');
    if (contentType.includes('application/json')) {
        // Server returned JSON error as blob
        const text = await (response.data as Blob).text();
        let detail = 'Gagal membuat PDF struk';
        try {
            const parsed = JSON.parse(text);
            if (parsed?.detail) detail = String(parsed.detail);
        } catch {
            // ignore
        }
        throw new Error(detail);
    }

    const fallbackName = `${sanitizeFileName(options.receipt.transactionNumber)}.pdf`;
    const fileName =
        parseFilenameFromContentDisposition(response.headers?.['content-disposition']) || fallbackName;

    const blob =
        response.data instanceof Blob
            ? response.data
            : new Blob([response.data], { type: 'application/pdf' });

    // Guard against empty PDF bodies
    if (blob.size < 50) {
        throw new Error('File PDF kosong dari server');
    }

    triggerBlobDownload(blob, fileName);
}

export async function exportPublicReceiptPdf(options: ExportPublicReceiptOptions): Promise<void> {
    const fileName = sanitizeFileName(options.receipt.transactionNumber);
    try {
        // Prefer server-generated PDF (reliable, no html2canvas quirks)
        await downloadServerPdf(options);
    } catch (serverError) {
        console.warn('[exportPublicReceiptPdf] server PDF failed, fallback to canvas:', serverError);
        try {
            const canvas = await captureCardWeb(options.cardRef);
            saveCanvasAsPdf(canvas, fileName);
        } catch (canvasError) {
            console.error('[exportPublicReceiptPdf] canvas fallback failed:', canvasError);
            const message =
                (serverError as Error)?.message ||
                (canvasError as Error)?.message ||
                'Gagal membuat PDF struk';
            throw new Error(message);
        }
    }
}

export async function exportPublicReceiptImage(options: ExportPublicReceiptOptions): Promise<void> {
    const fileName = sanitizeFileName(options.receipt.transactionNumber);
    const canvas = await captureCardWeb(options.cardRef);
    saveCanvasAsPng(canvas, fileName);
}
