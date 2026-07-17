import { PrintSettings } from './printSettings';
import { getBleNativeLayout, receiptDivider } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import { buildReceiptDocument } from './receiptDocument';
import {
    formatCenteredReceiptLines,
    formatReceiptCurrency,
    padReceiptColumns,
} from './receiptFormatters';

/**
 * Software-centered line (spaces). Do NOT use <C>/ESC a — after logo bitmaps many
 * BLE printers drop ESC and print "a" + left-aligned text ("aTiga Putra Motor").
 */
function appendCenter(lines: string[], text: string, width: number): void {
    for (const line of formatCenteredReceiptLines(text, width)) {
        lines.push(line);
    }
}

function appendRow(lines: string[], left: string, right: string, width: number): void {
    lines.push(padReceiptColumns(left, right, width));
}

export interface GenerateBleReceiptTextOptions {
    /** When true, print text caption instead of native QR image. Default false. */
    includeQrPlaceholder?: boolean;
    /** When false, omit footer (caller prints footer after QR). Default true. */
    includeFooter?: boolean;
    /** Override column width (dots/12). Defaults to getBleNativeLayout().textCharWidth. */
    charWidth?: number;
}

/**
 * Native thermal ESC/POS receipt for Android BLE.
 *
 * Content comes from the same buildReceiptDocument() as web/QZ HTML
 * (fields, order, totals). Column width tracks 58mm/80mm via getBleNativeLayout
 * so fallback is closer to the HTML/QZ raster path.
 */
export function generateBleReceiptText(
    data: PrintReceiptData,
    settings: PrintSettings,
    options?: GenerateBleReceiptTextOptions,
): string {
    const layout = getBleNativeLayout(settings.paperSize);
    const width = options?.charWidth ?? layout.textCharWidth;
    const divider = receiptDivider(width);
    const doc = buildReceiptDocument(data, settings);
    const lines: string[] = [];

    // ── Header (same fields as QZ HTML header) ──
    // Company name first line mirrors bold title in HTML.
    appendCenter(lines, doc.companyName.toUpperCase(), width);
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
            // Bold-ish item name: uppercase like HTML font-weight bold
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
    // TOTAL emphasized — uppercase label matches HTML larger TOTAL row
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
        appendCenter(lines, `Catatan: ${doc.notes}`, width);
    }

    lines.push(divider);

    // QR bitmap is printed after this text. Footer follows QR.
    if (options?.includeQrPlaceholder && doc.showQr) {
        appendCenter(lines, doc.qrCaption, width);
        appendCenter(lines, 'Buka link struk digital di HP', width);
        lines.push(divider);
    }

    if (options?.includeFooter !== false) {
        appendCenter(lines, doc.footer, width);
        // Single trailing newline only — extra blank lines made long empty paper after cut.
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}
