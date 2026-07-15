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
 * On web without FileSystem cache, returns the data-URI unchanged.
 */
export async function writeReceiptImageDataUriToCache(
    dataUri: string,
    fileLabel = 'struk',
): Promise<string> {
    const base64 = stripDataUrlPrefix(dataUri);
    if (!base64 || base64.length < 32) {
        throw new Error('Data gambar struk kosong.');
    }

    const cacheDir = FileSystem.cacheDirectory;
    // Web / limited environments: keep data-URI so share/download still works
    if (!cacheDir || Platform.OS === 'web') {
        return dataUri.startsWith('data:') ? dataUri : `data:image/png;base64,${base64}`;
    }

    const target = `${cacheDir}struk_${sanitizeFilePart(fileLabel)}_${Date.now()}.png`;
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
    const url = buildPublicReceiptImageApiUrl(type, idOrToken);
    const label = fileLabel || idOrToken;

    if (Platform.OS === 'web') {
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) {
            throw new Error(`Gagal mengunduh gambar struk (HTTP ${response.status})`);
        }
        const blob = await response.blob();
        if (blob.size < 50) {
            throw new Error('Gambar struk kosong dari server.');
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error('Gagal membaca gambar struk.'));
            };
            reader.onerror = () => reject(new Error('Gagal membaca gambar struk.'));
            reader.readAsDataURL(blob);
        });
        return writeReceiptImageDataUriToCache(dataUrl, label);
    }

    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
        throw new Error('Cache aplikasi tidak tersedia untuk mengunduh gambar struk.');
    }

    const target = `${cacheDir}struk_${sanitizeFilePart(label)}_${Date.now()}.png`;
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

async function imageUriToFile(imageUri: string, fileName = 'struk-tpm.png'): Promise<File | null> {
    if (typeof File === 'undefined' || typeof fetch === 'undefined') return null;
    try {
        if (imageUri.startsWith('data:')) {
            const res = await fetch(imageUri);
            const blob = await res.blob();
            return new File([blob], fileName, { type: blob.type || 'image/png' });
        }
        if (
            imageUri.startsWith('blob:')
            || imageUri.startsWith('http://')
            || imageUri.startsWith('https://')
        ) {
            const res = await fetch(imageUri);
            const blob = await res.blob();
            return new File([blob], fileName, { type: blob.type || 'image/png' });
        }
    } catch (error) {
        console.warn('[Share] imageUriToFile failed:', error);
    }
    return null;
}

function downloadBlobOrUri(fileOrUri: File | string, fileName = 'struk-tpm.png'): void {
    if (typeof document === 'undefined') return;
    try {
        const link = document.createElement('a');
        if (typeof fileOrUri === 'string') {
            link.href = fileOrUri;
        } else {
            link.href = URL.createObjectURL(fileOrUri);
        }
        link.download = fileName;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (typeof fileOrUri !== 'string') {
            setTimeout(() => URL.revokeObjectURL(link.href), 1500);
        }
    } catch (error) {
        console.warn('[Share] download trigger failed:', error);
    }
}

/** Clipboard with textarea fallback (works when Clipboard API is blocked). */
async function copyTextWeb(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through
        }
    }

    if (typeof document === 'undefined') return false;
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

/**
 * Web share: Web Share API (mobile/secure) → copy link + download image (desktop).
 * Never hard-fail if at least link can be copied or image downloaded.
 */
async function shareOnWeb(
    message: string,
    title: string,
    shareUrl: string,
    imageUri: string | null,
): Promise<SharePublicReceiptLinkResult> {
    const file = imageUri ? await imageUriToFile(imageUri) : null;

    // 1) Native Web Share (Chrome Android / Safari iOS / some desktop)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const basePayload: ShareData = {
            title,
            text: message,
            url: shareUrl,
        };

        if (file) {
            const withFiles = { ...basePayload, files: [file] } as ShareData;
            try {
                const canFiles = typeof navigator.canShare !== 'function'
                    || navigator.canShare(withFiles);
                if (canFiles) {
                    await navigator.share(withFiles);
                    return 'shared';
                }
            } catch (error) {
                if (isShareCancelled(error)) return 'cancelled';
                console.warn('[Share] web share with files failed:', error);
            }
        }

        try {
            await navigator.share(basePayload);
            if (file) downloadBlobOrUri(file);
            else if (imageUri) downloadBlobOrUri(imageUri);
            return 'shared';
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
            console.warn('[Share] web share text failed, clipboard fallback:', error);
        }
    }

    // 2) Desktop / unsupported share: copy link + download PNG
    const copied = await copyTextWeb(message);
    if (file) downloadBlobOrUri(file);
    else if (imageUri) downloadBlobOrUri(imageUri);

    if (copied) return 'copied';

    // 3) Last resort: open share URL so user can copy from address bar
    if (typeof window !== 'undefined' && shareUrl) {
        try {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
            return 'shared';
        } catch {
            // ignore
        }
    }

    throw new Error(
        'Browser memblokir berbagi otomatis. Salin link struk manual atau gunakan HTTPS.',
    );
}

async function shareOnNative(
    message: string,
    title: string,
    shareUrl: string,
    imageUri: string | null,
): Promise<SharePublicReceiptLinkResult> {
    // Prefer expo-sharing for local image files — reliable on Android WhatsApp/Telegram.
    // RN Share.share({ url: file:// }) often only sends text on many Android OEMs.
    if (imageUri && (await Sharing.isAvailableAsync())) {
        try {
            await Sharing.shareAsync(imageUri, {
                mimeType: 'image/png',
                dialogTitle: `${title}\n${message}`,
                UTI: 'public.png',
            });
            return 'shared';
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
            console.warn('[Share] Sharing.shareAsync image failed:', error);
        }
    }

    // iOS / fallback: system share sheet with caption + optional file URL
    try {
        if (imageUri && Platform.OS === 'ios') {
            await Share.share({
                message,
                url: imageUri,
                title,
            });
            return 'shared';
        }

        await Share.share({
            message,
            // On Android, `url` as https link is often appended; file:// is unreliable.
            url: Platform.OS === 'ios' ? shareUrl : undefined,
            title,
        });
        return 'shared';
    } catch (error) {
        if (isShareCancelled(error)) return 'cancelled';
        throw error;
    }
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

    if (Platform.OS === 'web') {
        const ok = await copyTextWeb(message);
        if (!ok) {
            throw new Error('Gagal menyalin link. Izinkan akses clipboard di browser.');
        }
        return;
    }

    await Share.share({
        message,
        url: shareUrl,
        title: PUBLIC_RECEIPT_SHARE_TITLE,
    });
}
