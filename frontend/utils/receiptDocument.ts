import { PrintSettings } from './printSettings';
import { PrintReceiptData } from './printReceipt';
import { getPaperDimensions } from './paperSize';
import { buildPublicReceiptUrl } from './publicReceiptUrl';
import {
    formatReceiptCurrency,
    formatReceiptDate,
    getReceiptSections,
    ReceiptLineItem,
} from './receiptFormatters';

export interface ReceiptInfoRow {
    label: string;
    value: string;
}

export interface ReceiptItemSection {
    title: string;
    items: ReceiptLineItem[];
}

export interface ReceiptDocument {
    paperSize: '58mm' | '80mm';
    companyName: string;
    headerText?: string;
    address?: string;
    phone?: string;
    infoRows: ReceiptInfoRow[];
    sections: ReceiptItemSection[];
    subtotal: string;
    total: string;
    discount?: string;
    paid?: string;
    sisa?: string;
    change?: string;
    isLunas: boolean;
    paymentMethod?: string;
    notes?: string;
    footer: string;
    showQr: boolean;
    qrUrl?: string;
    qrCaption: string;
}

/** Skip empty / placeholder values so both QZ and BLE omit noise like "-" */
function isMeaningfulValue(value: string | number | undefined | null): value is string | number {
    if (value === undefined || value === null) return false;
    const text = String(value).trim();
    if (!text) return false;
    if (text === '-' || text === '—') return false;
    return true;
}

function pushInfoRow(
    rows: ReceiptInfoRow[],
    label: string,
    value: string | number | undefined | null,
) {
    if (!isMeaningfulValue(value)) return;
    rows.push({ label, value: String(value).trim() });
}

/**
 * Single source of truth for thermal receipt content.
 * Used by generateReceiptHTML (QZ / browser), BLE text, and native ThermalReceiptView.
 */
export function buildReceiptDocument(
    data: PrintReceiptData,
    settings: PrintSettings,
): ReceiptDocument {
    const paper = getPaperDimensions(settings.paperSize);
    const { services, parts, servicesTitle } = getReceiptSections(data);
    const paidAmount = data.paid ?? 0;
    const sisaAmount = data.total - paidAmount;
    const changeAmount =
        data.change !== undefined && data.change > 0
            ? data.change
            : paidAmount > data.total
                ? paidAmount - data.total
                : 0;

    const infoRows: ReceiptInfoRow[] = [];
    pushInfoRow(infoRows, 'No. Nota:', data.transactionNumber);
    pushInfoRow(infoRows, 'Antrian:', data.antrian);
    pushInfoRow(infoRows, 'Tanggal:', formatReceiptDate(data.date));
    pushInfoRow(infoRows, 'Pelanggan:', data.customerName);
    pushInfoRow(infoRows, 'No. Polisi:', data.vehiclePlate);
    pushInfoRow(infoRows, 'Jenis:', data.vehicleType);
    pushInfoRow(infoRows, 'Kasir:', data.cashierName);
    pushInfoRow(infoRows, 'Mekanik:', data.mechanicName);
    pushInfoRow(infoRows, 'Status:', data.status);

    if (data.type === 'jasa_angkut') {
        pushInfoRow(infoRows, 'Asal:', data.origin);
        pushInfoRow(infoRows, 'Tujuan:', data.destination);
        pushInfoRow(infoRows, 'Sopir:', data.driverName);
    }

    const sections: ReceiptItemSection[] = [];
    if (services.length > 0) {
        sections.push({ title: servicesTitle, items: services });
    }
    if (parts.length > 0) {
        sections.push({ title: 'SPAREPART', items: parts });
    }

    const qrType = data.type === 'mobil' ? 'mobil' : data.type;
    const receiptId = data.publicReceiptToken || data.transactionNumber;
    const qrUrl = settings.showQRCode
        ? buildPublicReceiptUrl(qrType, receiptId, settings.qrCodeBaseURL)
        : undefined;

    return {
        paperSize: paper.paperSize,
        companyName: settings.companyName || 'TIGA PUTRA MOTOR',
        headerText: settings.header?.trim() || undefined,
        address: settings.companyAddress?.trim() || undefined,
        phone: settings.companyPhone?.trim() || undefined,
        infoRows,
        sections,
        subtotal: formatReceiptCurrency(data.subtotal),
        total: formatReceiptCurrency(data.total),
        discount:
            data.discount && data.discount > 0 && data.showDiscount !== false
                ? formatReceiptCurrency(data.discount)
                : undefined,
        paid: data.paid !== undefined ? formatReceiptCurrency(data.paid) : undefined,
        sisa: sisaAmount > 0 ? formatReceiptCurrency(sisaAmount) : undefined,
        change: changeAmount > 0 ? formatReceiptCurrency(changeAmount) : undefined,
        isLunas: sisaAmount <= 0,
        paymentMethod: isMeaningfulValue(data.paymentMethod)
            ? String(data.paymentMethod).toUpperCase()
            : undefined,
        notes: isMeaningfulValue(data.notes) ? String(data.notes).trim() : undefined,
        footer: settings.footer || 'Terima kasih',
        showQr: Boolean(settings.showQRCode && qrUrl),
        qrUrl,
        qrCaption: 'Scan untuk lihat struk online',
    };
}
