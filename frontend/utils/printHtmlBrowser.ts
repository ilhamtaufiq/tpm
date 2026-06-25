import { getPaperDimensions, PaperSize } from './paperSize';

function ensurePageSize(html: string, paperSize?: PaperSize): string {
    if (!paperSize) return html;
    const { widthMm } = getPaperDimensions(paperSize);
    const pageRule = `@page { size: ${widthMm}mm auto; margin: 0; }`;
    if (html.includes('@page')) return html;
    if (/<style[^>]*>/i.test(html)) {
        return html.replace(/<style([^>]*)>/i, `<style$1>${pageRule}`);
    }
    return html.replace(/<head([^>]*)>/i, `<head$1><style>${pageRule}</style>`);
}

export async function printHtmlInBrowser(html: string, paperSize?: PaperSize): Promise<void> {
    const printableHtml = ensurePageSize(html, paperSize);
    if (typeof document === 'undefined') {
        throw new Error('Browser print tidak tersedia di platform ini');
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    let printed = false;
    const cleanup = () => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    };

    const triggerPrint = () => {
        if (printed) return;
        printed = true;
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(cleanup, 2000);
    };

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
        cleanup();
        throw new Error('Gagal menyiapkan frame print browser');
    }

    iframe.onload = triggerPrint;
    iframeDoc.open();
    iframeDoc.write(printableHtml);
    iframeDoc.close();

    setTimeout(() => {
        if (document.body.contains(iframe)) {
            triggerPrint();
        }
    }, 800);
}
