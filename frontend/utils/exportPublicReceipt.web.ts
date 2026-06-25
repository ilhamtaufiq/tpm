import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    ExportPublicReceiptOptions,
    PUBLIC_RECEIPT_CAPTURE_ROOT_ID,
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
        allowTaint: true,
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

export async function exportPublicReceiptPdf(options: ExportPublicReceiptOptions): Promise<void> {
    const fileName = sanitizeFileName(options.receipt.transactionNumber);
    const canvas = await captureCardWeb(options.cardRef);
    saveCanvasAsPdf(canvas, fileName);
}

export async function exportPublicReceiptImage(options: ExportPublicReceiptOptions): Promise<void> {
    const fileName = sanitizeFileName(options.receipt.transactionNumber);
    const canvas = await captureCardWeb(options.cardRef);
    saveCanvasAsPng(canvas, fileName);
}