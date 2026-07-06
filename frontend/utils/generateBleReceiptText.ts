import { PrintSettings } from './printSettings';
import { getPaperDimensions, receiptDivider } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import {
    formatReceiptCurrency,
    formatReceiptDate,
    getReceiptSections,
    padReceiptColumns,
    ReceiptLineItem,
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

function appendItemsSection(
    lines: string[],
    items: ReceiptLineItem[] | undefined,
    title: string,
    width: number,
): void {
    if (!items || items.length === 0) return;

    appendCenter(lines, `--- ${title} ---`, width, true);

    for (const item of items) {
        lines.push(String(item.description || '-').toUpperCase());
        appendRow(
            lines,
            `${item.quantity} x ${formatReceiptCurrency(item.unitPrice)}`,
            formatReceiptCurrency(item.subtotal),
            width,
        );
    }
}

/**
 * Plain-text thermal receipt matching generateReceiptHTML section order and fields.
 */
export function generateBleReceiptText(data: PrintReceiptData, settings: PrintSettings): string {
    const paper = getPaperDimensions(settings.paperSize);
    const width = paper.charWidth;
    const divider = receiptDivider(width);
    const lines: string[] = [];
    const fmt = formatReceiptCurrency;
    const { services, parts, servicesTitle } = getReceiptSections(data);
    const sisa = data.total - (data.paid || 0);

    appendCenter(lines, settings.companyName || 'TIGA PUTRA MOTOR', width, true);

    if (settings.header?.trim()) {
        appendCenter(lines, settings.header.trim(), width);
    }
    if (settings.companyAddress?.trim()) {
        appendCenter(lines, settings.companyAddress.trim(), width);
    }
    if (settings.companyPhone?.trim()) {
        appendCenter(lines, `Telp: ${settings.companyPhone.trim()}`, width);
    }

    lines.push(divider);

    const infoRows: Array<[string, string | number | undefined]> = [
        ['No. Nota:', data.transactionNumber],
        ['Tanggal:', formatReceiptDate(data.date)],
        ['Pelanggan:', data.customerName],
        ['No. Polisi:', data.vehiclePlate],
    ];

    if (data.type === 'jasa_angkut') {
        infoRows.push(['Asal:', data.origin], ['Tujuan:', data.destination], ['Sopir:', data.driverName]);
    }

    for (const [label, value] of infoRows) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            appendRow(lines, label, String(value), width);
        }
    }

    lines.push(divider);

    appendItemsSection(lines, services, servicesTitle, width);

    if (services.length > 0 && parts.length > 0) {
        lines.push(divider);
    }

    appendItemsSection(lines, parts, 'SPAREPART', width);

    lines.push(divider);
    appendRow(lines, 'SUBTOTAL', fmt(data.subtotal), width, true);
    lines.push(divider);
    appendRow(lines, 'TOTAL', fmt(data.total), width, true);

    if (data.discount && data.showDiscount !== false) {
        appendRow(lines, 'Diskon', `-${fmt(data.discount)}`, width);
    }

    if (data.paid !== undefined) {
        appendRow(lines, 'Dibayar', fmt(data.paid), width);
    }

    if (sisa > 0) {
        appendRow(lines, 'SISA', fmt(sisa), width, true);
    } else {
        appendCenter(lines, 'LUNAS', width, true);
    }

    if (data.paymentMethod) {
        appendRow(lines, 'Metode Bayar:', String(data.paymentMethod).toUpperCase(), width);
    }

    lines.push(divider);
    appendCenter(lines, settings.footer || 'Terima kasih', width);

    return `${lines.join('\n')}\n`;
}