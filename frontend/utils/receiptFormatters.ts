export interface ReceiptLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface ReceiptContentData {
    type: 'bengkel' | 'jasa_angkut' | 'mobil';
    transactionNumber: string;
    date: Date;
    customerName: string;
    items?: ReceiptLineItem[];
    services?: ReceiptLineItem[];
    parts?: ReceiptLineItem[];
    subtotal: number;
    discount?: number;
    total: number;
    paid?: number;
    paymentMethod?: string;
    showDiscount?: boolean;
    vehiclePlate?: string;
    origin?: string;
    destination?: string;
    driverName?: string;
}

export function formatReceiptCurrency(amount: number): string {
    return 'Rp' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatReceiptDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${d}/${m}/${y} - ${h}:${min}`;
}

export function padReceiptColumns(left: string, right: string, width: number): string {
    const cleanRight = right.trim();
    const maxLeft = width - cleanRight.length - 1;

    if (maxLeft < 1) {
        return `${left}\n${' '.repeat(Math.max(0, width - cleanRight.length))}${cleanRight}`;
    }

    const trimmedLeft = left.length > maxLeft ? `${left.slice(0, maxLeft - 1)}…` : left;
    const spaces = width - trimmedLeft.length - cleanRight.length;
    return trimmedLeft + ' '.repeat(Math.max(1, spaces)) + cleanRight;
}

export function wrapCenteredLines(text: string, width: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= width) {
            current = candidate;
            continue;
        }

        if (current) lines.push(current);
        current = word.length > width ? word.slice(0, width) : word;
    }

    if (current) lines.push(current);
    return lines;
}

export interface ReceiptSections {
    services: ReceiptLineItem[];
    parts: ReceiptLineItem[];
    servicesTitle: string;
}

export function getReceiptSections(data: ReceiptContentData): ReceiptSections {
    const services = data.services || (data.type === 'bengkel' ? [] : data.items || []);
    const parts = data.parts || [];
    const items = data.items || [];
    const servicesTitle = services.length > 0
        ? 'JASA'
        : data.type === 'mobil'
            ? 'UNIT MOBIL'
            : data.type === 'jasa_angkut'
                ? 'JASA ANGKUT'
                : 'ITEMS';

    const resolvedServices = services.length > 0
        ? services
        : (data.type !== 'bengkel' && items.length > 0)
            ? items
            : [];

    return {
        services: resolvedServices,
        parts,
        servicesTitle,
    };
}