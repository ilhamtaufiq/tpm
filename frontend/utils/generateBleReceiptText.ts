import { PrintSettings } from './printSettings';
import { getPaperDimensions, receiptDivider } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import { buildReceiptDocument } from './receiptDocument';
import {
    formatReceiptCurrency,
    padReceiptColumns,
    wrapCenteredLines,
} from './receiptFormatters';

/**
 * Centered line. Avoid <B>/<CB> — many BLE printers use double-width bold and wrap columns.
 */
function appendCenter(lines: string[], text: string, width: number): void {
    for (const line of wrapCenteredLines(text, width)) {
        lines.push(`<C>${line}</C>`);
    }
}

function appendRow(lines: string[], left: string, right: string, width: number): void {
    lines.push(padReceiptColumns(left, right, width));
}

/**
 * Native thermal ESC/POS receipt for Android BLE.
 *
 * Content comes from the same buildReceiptDocument() as web/QZ HTML
 * (fields, order, totals). Layout is character-column thermal, not HTML.
 */
export function generateBleReceiptText(data: PrintReceiptData, settings: PrintSettings): string {
    const paper = getPaperDimensions(settings.paperSize);
    // Slightly under nominal width so physical margins don't wrap left/right columns.
    const width = Math.max(24, paper.charWidth - 2);
    const divider = receiptDivider(width);
    const doc = buildReceiptDocument(data, settings);
    const lines: string[] = [];

    // ── Header (same fields as QZ HTML header) ──
    appendCenter(lines, doc.companyName, width);
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

    // ── Info rows ──
    for (const row of doc.infoRows) {
        appendRow(lines, row.label, row.value, width);
    }

    lines.push(divider);

    // ── Line items ──
    doc.sections.forEach((section, index) => {
        if (index > 0) {
            lines.push(divider);
        }
        appendCenter(lines, `--- ${section.title} ---`, width);
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

    // ── Totals (same order as generateReceiptHTML / QZ) ──
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
        appendCenter(lines, 'LUNAS', width);
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

    // QR image needs graphics mode; native text path shows short caption only.
    if (doc.showQr) {
        appendCenter(lines, doc.qrCaption, width);
        appendCenter(lines, 'Buka link struk digital di HP', width);
        lines.push(divider);
    }

    appendCenter(lines, doc.footer, width);
    // Feed a bit for paper cut
    lines.push('');
    lines.push('');

    return `${lines.join('\n')}\n`;
}
