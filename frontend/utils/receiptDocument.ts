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
    isLunas: boolean;
    paymentMethod?: string;
    footer: string;
    showQr: boolean;
    qrUrl?: string;
    qrCaption: string;
}

function pushInfoRow(
    rows: ReceiptInfoRow[],
    label: string,
    value: string | number | undefined | null,
) {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (!text) return;
    rows.push({ label, value: text });
}

export function buildReceiptDocument(
    data: PrintReceiptData,
    settings: PrintSettings,
): ReceiptDocument {
    const paper = getPaperDimensions(settings.paperSize);
    const { services, parts, servicesTitle } = getReceiptSections(data);
    const sisaAmount = data.total - (data.paid || 0);

    const infoRows: ReceiptInfoRow[] = [];
    pushInfoRow(infoRows, 'No. Nota:', data.transactionNumber);
    pushInfoRow(infoRows, 'Tanggal:', formatReceiptDate(data.date));
    pushInfoRow(infoRows, 'Pelanggan:', data.customerName);
    pushInfoRow(infoRows, 'No. Polisi:', data.vehiclePlate);

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
            data.discount && data.showDiscount !== false
                ? formatReceiptCurrency(data.discount)
                : undefined,
        paid: data.paid !== undefined ? formatReceiptCurrency(data.paid) : undefined,
        sisa: sisaAmount > 0 ? formatReceiptCurrency(sisaAmount) : undefined,
        isLunas: sisaAmount <= 0,
        paymentMethod: data.paymentMethod
            ? String(data.paymentMethod).toUpperCase()
            : undefined,
        footer: settings.footer || 'Terima kasih',
        showQr: Boolean(settings.showQRCode && qrUrl),
        qrUrl,
        qrCaption: 'Scan untuk lihat struk online',
    };
}