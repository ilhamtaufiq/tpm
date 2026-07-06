import { Platform, Share } from 'react-native';
import { printSettingsService } from './printSettings';
import {
    buildPublicReceiptUrl,
    getPublicReceiptBaseUrl,
    PublicReceiptType,
} from './publicReceiptUrl';

export const PUBLIC_RECEIPT_SHARE_TITLE = 'Struk Tiga Putra Motor';

export function buildPublicReceiptShareMessage(
    transactionNumber: string | undefined,
    shareUrl: string,
): string {
    const label = (transactionNumber || '').trim() || 'transaksi';
    return `Struk transaksi ${label} — Tiga Putra Motor\n${shareUrl}`;
}

export async function resolvePublicReceiptBaseUrl(): Promise<string> {
    try {
        const settings = await printSettingsService.getSettings();
        return getPublicReceiptBaseUrl(settings.qrCodeBaseURL);
    } catch {
        return getPublicReceiptBaseUrl();
    }
}

export async function buildPublicReceiptShareUrl(
    type: PublicReceiptType,
    idOrToken: string,
): Promise<string> {
    const baseUrl = await resolvePublicReceiptBaseUrl();
    return buildPublicReceiptUrl(type, idOrToken, baseUrl);
}

export function resolvePublicReceiptShareId(
    type: PublicReceiptType,
    source: { public_receipt_token?: string | null; id?: string | number | null } | null | undefined,
    fallbackId?: string | number,
): string | null {
    if (type === 'jasa_angkut') {
        const tripId = source?.id ?? fallbackId;
        return tripId != null && String(tripId).trim() !== '' ? String(tripId) : null;
    }

    const token = source?.public_receipt_token;
    return token && String(token).trim() !== '' ? String(token) : null;
}

export type SharePublicReceiptLinkResult = 'shared' | 'copied' | 'cancelled';

export type SharePublicReceiptLinkOptions = {
    shareUrl: string;
    transactionNumber?: string;
    title?: string;
    onCopied?: () => void;
    onShared?: () => void;
    onCancel?: () => void;
};

function isShareCancelled(error: unknown): boolean {
    const message = String((error as { message?: string })?.message || '').toLowerCase();
    return message.includes('cancel') || message.includes('dismiss') || message.includes('abort');
}

export async function sharePublicReceiptLink(
    options: SharePublicReceiptLinkOptions,
): Promise<SharePublicReceiptLinkResult> {
    const message = buildPublicReceiptShareMessage(options.transactionNumber, options.shareUrl);
    const title = options.title || PUBLIC_RECEIPT_SHARE_TITLE;

    try {
        if (Platform.OS === 'web') {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({
                    title,
                    text: message,
                    url: options.shareUrl,
                });
                options.onShared?.();
                return 'shared';
            }

            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(message);
                options.onCopied?.();
                return 'copied';
            }
        }

        await Share.share({
            message,
            url: options.shareUrl,
            title,
        });
        options.onShared?.();
        return 'shared';
    } catch (error) {
        if (isShareCancelled(error)) {
            options.onCancel?.();
            return 'cancelled';
        }

        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(message);
            options.onCopied?.();
            return 'copied';
        }

        throw error;
    }
}

export async function copyPublicReceiptLink(
    shareUrl: string,
    transactionNumber?: string,
): Promise<void> {
    const message = buildPublicReceiptShareMessage(transactionNumber, shareUrl);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        return;
    }

    await Share.share({
        message,
        url: shareUrl,
        title: PUBLIC_RECEIPT_SHARE_TITLE,
    });
}