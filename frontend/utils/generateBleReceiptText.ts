import { PrintSettings } from './printSettings';
import { getPaperDimensions, receiptDivider } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import { buildReceiptDocument } from './receiptDocument';
import {
    formatReceiptCurrency,
    padReceiptColumns,
    wrapCenteredLines,
} from './receiptFormatters';

function appendCenter(lines: string[], text: string, width: number, _bold = false): void {
    // Avoid <CB>/<B>: many BLE printers treat bold as double-width and wrap columns.
    for (const line of wrapCenteredLines(text, width)) {
        lines.push(`<C>${line}</C>`);
    }
}

/**
 * Left/right columns without bold tags on the full line.
 * Bold on full padded rows often doubles glyph width → value jumps to next line.
 */
function appendRow(lines: string[], left: string, right: string, width: number): void {
    lines.push(padReceiptColumns(left, right, width));
}

/**
 * Plain-text thermal receipt from the same document model as generateReceiptHTML / QZ Tray.
 * Fallback only — visual parity (logo + QR image) needs HTML raster path.
 */
export function generateBleReceiptText(data: PrintReceiptData, settings: PrintSettings): string {
    const paper = getPaperDimensions(settings.paperSize);
    // Slightly narrower than nominal so physical printers with margins don't wrap columns.
    const width = Math.max(24, paper.charWidth - 2);
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
    appendRow(lines, 'SUBTOTAL', doc.subtotal, width);

    if (doc.discount) {
        appendRow(lines, 'Diskon', `-${doc.discount}`, width);
    }

    appendRow(lines, 'TOTAL', doc.total, width);

    if (doc.paid) {
        appendRow(lines, 'Dibayar', doc.paid, width);
    }

    if (doc.sisa) {
        appendRow(lines, 'SISA', doc.sisa, width);
    } else {
        appendCenter(lines, 'LUNAS', width, true);
    }

    if (doc.change) {
        appendRow(lines, 'Kembalian', doc.change, width);
    }

    if (doc.paymentMethod) {
        appendRow(lines, 'Metode Bayar:', doc.paymentMethod, width);
    }

    if (doc.notes) {
        lines.push(divider);
        for (const line of wrapCenteredLines(`Catatan: ${doc.notes}`, width)) {
            lines.push(line);
        }
    }

    lines.push(divider);

    if (doc.showQr && doc.qrUrl) {
        appendCenter(lines, doc.qrCaption, width);
        // Short hint only — full URL wraps badly on 58mm text printers.
        appendCenter(lines, 'Scan QR di struk digital', width);
        lines.push(divider);
    }

    appendCenter(lines, doc.footer, width);

    return `${lines.join('\n')}\n`;
}
