import type { PublicReceiptData } from '../components/receipt/PublicReceiptCard';
import type { PublicReceiptType } from './publicReceiptUrl';

export const PUBLIC_RECEIPT_CAPTURE_ROOT_ID = 'public-receipt-export-root';

export type ExportPublicReceiptOptions = {
    receipt: PublicReceiptData;
    receiptType: PublicReceiptType;
    /** Public token / id used by /public/receipt/{type}/{id} */
    receiptId: string;
    shareUrl?: string;
    cardRef: { current: unknown };
};

export function sanitizeFileName(value: string): string {
    return (value || 'struk').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function buildPublicReceiptPdfPath(type: PublicReceiptType, receiptId: string): string {
    return `/public/receipt/${type}/${encodeURIComponent(receiptId)}/pdf`;
}

export async function prepareReceiptCapture(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 450));
}