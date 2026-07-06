import { Platform, Image } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { FILE_URL } from './api';

const DEFAULT_LOGO = require('../assets/logo_tpm.png');

let defaultLogoCache: string | null = null;
const logoCache = new Map<string, string>();

function resolveWebUri(uri: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('blob:')) {
        return uri;
    }
    const base = typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : (FILE_URL || '');
    if (uri.startsWith('/')) {
        return `${base.replace(/\/$/, '')}${uri}`;
    }
    return uri;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });
}

function guessImageMime(uri: string, contentType?: string | null): string {
    if (contentType && contentType.startsWith('image/')) {
        return contentType.split(';')[0].trim();
    }
    const lower = uri.toLowerCase();
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
    if (lower.includes('.webp')) return 'image/webp';
    if (lower.includes('.gif')) return 'image/gif';
    return 'image/png';
}

async function readFileUriAsDataUrl(uri: string): Promise<string | null> {
    try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64) return null;
        return `data:${guessImageMime(uri)};base64,${base64}`;
    } catch {
        return null;
    }
}

export async function fetchImageAsDataUrl(uri: string): Promise<string | null> {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return null;

    const extension = guessImageMime(uri) === 'image/jpeg' ? 'jpg' : 'png';
    const targetUri = `${cacheDir}tpm_logo_${Date.now()}.${extension}`;

    try {
        const downloaded = await FileSystem.downloadAsync(uri, targetUri);
        if (downloaded.status < 200 || downloaded.status >= 300) {
            return null;
        }
        const mime = guessImageMime(uri, downloaded.headers?.['Content-Type']);
        const base64 = await FileSystem.readAsStringAsync(downloaded.uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64) return null;
        return `data:${mime};base64,${base64}`;
    } catch {
        return null;
    }
}

function convertImageViaCanvas(uri: string, maxWidth: number): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const naturalW = img.naturalWidth || img.width || maxWidth;
                const naturalH = img.naturalHeight || img.height || maxWidth;
                const scale = Math.min(1, maxWidth / naturalW);
                const w = Math.max(1, Math.round(naturalW * scale));
                const h = Math.max(1, Math.round(naturalH * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/png', 0.9));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = resolveWebUri(uri);
    });
}

async function fetchAsDataUrl(uri: string): Promise<string | null> {
    try {
        const response = await fetch(resolveWebUri(uri));
        if (!response.ok) return null;
        const blob = await response.blob();
        return blobToDataUrl(blob);
    } catch {
        return null;
    }
}

async function convertUriToBase64(uri: string, maxWidth = 160): Promise<string | null> {
    if (!uri) return null;
    if (uri.startsWith('data:')) return uri;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const fromCanvas = await convertImageViaCanvas(uri, maxWidth);
        if (fromCanvas) return fromCanvas;
        return fetchAsDataUrl(uri);
    }

    try {
        if (uri.startsWith('file://') || uri.startsWith('content://')) {
            return readFileUriAsDataUrl(uri);
        }

        const fetchUri = uri.startsWith('/') && FILE_URL
            ? `${FILE_URL.replace(/\/$/, '')}${uri}`
            : uri;

        if (fetchUri.startsWith('http://') || fetchUri.startsWith('https://')) {
            return fetchImageAsDataUrl(fetchUri);
        }

        if (fetchUri.startsWith('file://') || fetchUri.startsWith('content://')) {
            return readFileUriAsDataUrl(fetchUri);
        }

        return fetchImageAsDataUrl(fetchUri);
    } catch (e) {
        console.warn('Logo convert failed:', e);
        return null;
    }
}

async function loadDefaultLogoBase64(): Promise<string | null> {
    if (defaultLogoCache) return defaultLogoCache;

    try {
        const asset = Asset.fromModule(DEFAULT_LOGO);
        await asset.downloadAsync();
        const sourceUri = asset.localUri || asset.uri;
        if (sourceUri) {
            const converted = Platform.OS === 'web'
                ? await convertUriToBase64(sourceUri, 160)
                : await readFileUriAsDataUrl(sourceUri);
            if (converted) {
                defaultLogoCache = converted;
                return converted;
            }
        }
    } catch (e) {
        console.warn('expo-asset default logo failed:', e);
    }

    try {
        const resolved = Image.resolveAssetSource(DEFAULT_LOGO);
        if (resolved?.uri) {
            const converted = await convertUriToBase64(resolved.uri, 160);
            if (converted) {
                defaultLogoCache = converted;
                return converted;
            }
        }
    } catch (e) {
        console.warn('resolveAssetSource default logo failed:', e);
    }

    return null;
}

/**
 * Resolve any logo setting to an inline data URL suitable for QZ Tray / thermal HTML.
 */
export async function ensureLogoBase64(uri: string | null | undefined): Promise<string | null> {
    if (!uri) return loadDefaultLogoBase64();
    if (uri === 'tpm_default') return loadDefaultLogoBase64();
    if (uri.startsWith('data:')) return uri;

    if (logoCache.has(uri)) return logoCache.get(uri)!;

    const converted = await convertUriToBase64(uri, 160);
    if (converted) {
        logoCache.set(uri, converted);
        return converted;
    }

    return loadDefaultLogoBase64();
}

export function buildReceiptLogoHtml(logoUri: string | null | undefined, maxPx = 80): string {
    if (!logoUri) return '';
    const safeSrc = logoUri.replace(/"/g, '&quot;');
    return `<img src="${safeSrc}" width="${maxPx}" height="auto" style="max-width:${maxPx}px;height:auto;display:block;margin:0 auto 6px" alt="Logo" />`;
}

function stripDataUrlPrefix(dataUrl: string): string | null {
    const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    return match?.[1] ?? null;
}

/**
 * Writes the resolved logo to cache and returns a JSON payload for the patched BLE
 * printImageData native method ({ url, maxWidth }).
 */
export async function prepareBleLogoPayload(
    logoUri: string | null | undefined,
    maxWidthPx: number,
): Promise<string | null> {
    const dataUrl = await ensureLogoBase64(logoUri);
    if (!dataUrl) return null;

    const base64 = stripDataUrlPrefix(dataUrl);
    if (!base64) return null;

    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return null;

    const fileUri = `${cacheDir}tpm_receipt_logo.png`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    return JSON.stringify({
        imageBase64: base64,
        cacheFile: 'tpm_receipt_logo.png',
        mime: 'image/png',
        maxWidth: Math.max(64, Math.round(maxWidthPx * 0.55)),
    });
}