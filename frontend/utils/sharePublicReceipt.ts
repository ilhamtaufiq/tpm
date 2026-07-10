import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BASE_URL } from './api';
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
    /** When set, also attach a receipt image (server OG or provided capture). */
    receiptType?: PublicReceiptType;
    receiptId?: string;
    /** Prefer this local file URI (e.g. from view-shot capture). */
    imageFileUri?: string | null;
    /** Prefer this data URI (e.g. captureRef data-uri). */
    imageDataUri?: string | null;
    /** When false, only share text/link (default true if type+id available). */
    includeImage?: boolean;
    onCopied?: () => void;
    onShared?: () => void;
    onCancel?: () => void;
};

function isShareCancelled(error: unknown): boolean {
    const message = String((error as { message?: string })?.message || '').toLowerCase();
    return message.includes('cancel') || message.includes('dismiss') || message.includes('abort');
}

function sanitizeFilePart(value: string): string {
    return (value || 'struk').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
}

function stripDataUrlPrefix(dataUri: string): string {
    return dataUri.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
}

/** Build absolute API URL for public receipt OG/share PNG. */
export function buildPublicReceiptImageApiUrl(
    type: PublicReceiptType,
    idOrToken: string,
): string {
    return `${BASE_URL}/public/receipt/image/${type}/${encodeURIComponent(idOrToken)}`;
}

/**
 * Persist a PNG data-URI to the app cache and return a file:// URI.
 */
export async function writeReceiptImageDataUriToCache(
    dataUri: string,
    fileLabel = 'struk',
): Promise<string> {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
        throw new Error('Cache aplikasi tidak tersedia untuk menyimpan gambar struk.');
    }
    const target = `${cacheDir}struk_${sanitizeFilePart(fileLabel)}_${Date.now()}.png`;
    const base64 = stripDataUrlPrefix(dataUri);
    if (!base64 || base64.length < 32) {
        throw new Error('Data gambar struk kosong.');
    }
    await FileSystem.writeAsStringAsync(target, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });
    return target;
}

/**
 * Download server-generated receipt PNG to cache. Public endpoint (no auth).
 */
export async function downloadPublicReceiptImageToCache(
    type: PublicReceiptType,
    idOrToken: string,
    fileLabel?: string,
): Promise<string> {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
        throw new Error('Cache aplikasi tidak tersedia untuk mengunduh gambar struk.');
    }

    const target = `${cacheDir}struk_${sanitizeFilePart(fileLabel || idOrToken)}_${Date.now()}.png`;
    const url = buildPublicReceiptImageApiUrl(type, idOrToken);

    if (Platform.OS === 'web') {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Gagal mengunduh gambar struk (HTTP ${response.status})`);
        }
        const blob = await response.blob();
        if (blob.size < 50) {
            throw new Error('Gambar struk kosong dari server.');
        }
        // Web: convert blob → data URL → cache file when FileSystem supports it
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error('Gagal membaca gambar struk.'));
            };
            reader.onerror = () => reject(new Error('Gagal membaca gambar struk.'));
            reader.readAsDataURL(blob);
        });
        try {
            return await writeReceiptImageDataUriToCache(dataUrl, fileLabel || idOrToken);
        } catch {
            // FileSystem may be limited on web — return data URL for web share path
            return dataUrl;
        }
    }

    const result = await FileSystem.downloadAsync(url, target);
    if (result.status < 200 || result.status >= 300) {
        throw new Error(`Gagal mengunduh gambar struk (HTTP ${result.status})`);
    }
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || (info.size != null && info.size < 50)) {
        throw new Error('Gambar struk kosong dari server.');
    }
    return result.uri;
}

async function resolveShareImageFileUri(
    options: SharePublicReceiptLinkOptions,
): Promise<string | null> {
    const wantImage = options.includeImage !== false
        && Boolean(
            options.imageFileUri
            || options.imageDataUri
            || (options.receiptType && options.receiptId),
        );
    if (!wantImage) return null;

    try {
        if (options.imageFileUri) {
            return options.imageFileUri;
        }
        if (options.imageDataUri) {
            return await writeReceiptImageDataUriToCache(
                options.imageDataUri,
                options.transactionNumber || options.receiptId || 'struk',
            );
        }
        if (options.receiptType && options.receiptId) {
            return await downloadPublicReceiptImageToCache(
                options.receiptType,
                options.receiptId,
                options.transactionNumber || options.receiptId,
            );
        }
    } catch (error) {
        console.warn('[Share] receipt image prepare failed, link-only fallback:', error);
    }
    return null;
}

async function shareOnWeb(
    message: string,
    title: string,
    shareUrl: string,
    imageUri: string | null,
): Promise<SharePublicReceiptLinkResult> {
    let file: File | null = null;

    if (imageUri && typeof File !== 'undefined') {
        try {
            if (imageUri.startsWith('data:')) {
                const res = await fetch(imageUri);
                const blob = await res.blob();
                file = new File([blob], 'struk-tpm.png', { type: blob.type || 'image/png' });
            } else if (imageUri.startsWith('blob:') || imageUri.startsWith('http')) {
                const res = await fetch(imageUri);
                const blob = await res.blob();
                file = new File([blob], 'struk-tpm.png', { type: blob.type || 'image/png' });
            } else if (typeof FileSystem !== 'undefined') {
                // file:// from expo web — try fetch
                const res = await fetch(imageUri);
                const blob = await res.blob();
                file = new File([blob], 'struk-tpm.png', { type: 'image/png' });
            }
        } catch (error) {
            console.warn('[Share] web file prepare failed:', error);
        }
    }

    if (file && typeof navigator !== 'undefined' && navigator.share) {
        const payload: ShareData = {
            title,
            text: message,
            url: shareUrl,
        };
        const withFiles = { ...payload, files: [file] };
        try {
            if (typeof navigator.canShare === 'function' && navigator.canShare(withFiles)) {
                await navigator.share(withFiles);
                return 'shared';
            }
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
            // fall through to share without files
        }
        try {
            await navigator.share(payload);
            // Still try to trigger download of image so user can attach manually
            try {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(file);
                link.download = 'struk-tpm.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch {
                // ignore
            }
            return 'shared';
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
        }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        if (file) {
            try {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(file);
                link.download = 'struk-tpm.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch {
                // ignore
            }
        }
        return 'copied';
    }

    throw new Error('Berbagi tidak didukung di browser ini.');
}

async function shareOnNative(
    message: string,
    title: string,
    shareUrl: string,
    imageUri: string | null,
): Promise<SharePublicReceiptLinkResult> {
    // iOS: Share.share can take file url + message (image + caption/link).
    if (Platform.OS === 'ios' && imageUri) {
        try {
            await Share.share({
                message,
                url: imageUri,
                title,
            });
            return 'shared';
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
            console.warn('[Share] iOS image+message failed, fallback:', error);
        }
    }

    // Android (and iOS fallback): share image file; message includes link in dialog title.
    // WhatsApp often lets user add caption — put link in message sheet first when no image.
    if (imageUri && (await Sharing.isAvailableAsync())) {
        try {
            // Try RN Share with both (some Android OEMs forward message as caption).
            try {
                await Share.share({
                    message,
                    url: imageUri,
                    title,
                });
                return 'shared';
            } catch (shareErr) {
                if (isShareCancelled(shareErr)) return 'cancelled';
            }

            await Sharing.shareAsync(imageUri, {
                mimeType: 'image/png',
                dialogTitle: `${title}\n${shareUrl}`,
                UTI: 'public.png',
            });
            // After image share sheet, also offer text via a second soft path only if needed —
            // Prefer one sheet: image is primary; link is in dialog title + message when OEMs support it.
            return 'shared';
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
            console.warn('[Share] native image share failed, link-only fallback:', error);
        }
    }

    await Share.share({
        message,
        url: shareUrl,
        title,
    });
    return 'shared';
}

/**
 * Share public receipt: link text + optional struk image (for WhatsApp / system share).
 * Image sources (priority): imageDataUri → imageFileUri → server OG PNG.
 */
export async function sharePublicReceiptLink(
    options: SharePublicReceiptLinkOptions,
): Promise<SharePublicReceiptLinkResult> {
    const message = buildPublicReceiptShareMessage(options.transactionNumber, options.shareUrl);
    const title = options.title || PUBLIC_RECEIPT_SHARE_TITLE;
    const imageUri = await resolveShareImageFileUri(options);

    try {
        if (Platform.OS === 'web') {
            const result = await shareOnWeb(message, title, options.shareUrl, imageUri);
            if (result === 'shared') options.onShared?.();
            if (result === 'copied') options.onCopied?.();
            return result;
        }

        const result = await shareOnNative(message, title, options.shareUrl, imageUri);
        if (result === 'shared') options.onShared?.();
        return result;
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
