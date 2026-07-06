import { PrintSettings } from './printSettings';
import { getPaperDimensions, receiptDivider } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import { buildReceiptDocument } from './receiptDocument';
import {
    formatReceiptCurrency,
    padReceiptColumns,
    wrapCenteredLines,
} from './receiptFormatters';

function appendCenter(lines: string[], text: string, width: number, bold = false): void {
    const tag = bold ? 'CB' : 'C';
    for (const line of wrapCenteredLines(text, width)) {
        lines.push(`<${tag}>${line}</${tag}>`);
    }
}

function appendRow(lines: string[], left: string, right: string, width: number, bold = false): void {
    const row = padReceiptColumns(left, right, width);
    lines.push(bold ? `<B>${row}</B>` : row);
}

/**
 * Plain-text thermal receipt generated from the same document model as generateReceiptHTML.
 */
export function generateBleReceiptText(data: PrintReceiptData, settings: PrintSettings): string {
    const paper = getPaperDimensions(settings.paperSize);
    const width = paper.charWidth;
    const divider = receiptDivider(width);
    const doc = buildReceiptDocument(data, settings);
    const lines: string[] = [];

    appendCenter(lines, doc.companyName, width, true);

    if (doc.headerText) {
        appendCenter(lines, doc.headerText, width);
    }
    if (doc.address) {
        appendCenter(lines, doc.address, width);
    }
    if (doc.phone) {
        appendCenter(lines, `Telp: ${doc.phone}`, width);
    }

    lines.push(divider);

    for (const row of doc.infoRows) {
        appendRow(lines, row.label, row.value, width);
    }

    lines.push(divider);

    doc.sections.forEach((section, index) => {
        if (index > 0) {
            lines.push(divider);
        }
        appendCenter(lines, `--- ${section.title} ---`, width, true);
        for (const item of section.items) {
            lines.push(String(item.description || '-').toUpperCase());
            appendRow(
                lines,
                `${item.quantity} x ${formatReceiptCurrency(item.unitPrice)}`,
                formatReceiptCurrency(item.subtotal),
                width,
            );
        }
    });

    lines.push(divider);
    appendRow(lines, 'SUBTOTAL', doc.subtotal, width, true);
    lines.push(divider);
    appendRow(lines, 'TOTAL', doc.total, width, true);

    if (doc.discount) {
        appendRow(lines, 'Diskon', `-${doc.discount}`, width);
    }

    if (doc.paid) {
        appendRow(lines, 'Dibayar', doc.paid, width);
    }

    if (doc.sisa) {
        appendRow(lines, 'SISA', doc.sisa, width, true);
    } else {
        appendCenter(lines, 'LUNAS', width, true);
    }

    if (doc.paymentMethod) {
        appendRow(lines, 'Metode Bayar:', doc.paymentMethod, width);
    }

    lines.push(divider);

    if (doc.showQr && doc.qrUrl) {
        appendCenter(lines, doc.qrCaption, width);
        appendCenter(lines, doc.qrUrl, width);
        lines.push(divider);
    }

    appendCenter(lines, doc.footer, width);

    return `${lines.join('\n')}\n`;
}