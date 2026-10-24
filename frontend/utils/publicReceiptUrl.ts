import Constants from 'expo-constants';
import api, { BASE_URL, FILE_URL } from './api';

export type PublicReceiptType = 'bengkel' | 'jasa_angkut' | 'mobil';

const PRODUCTION_FALLBACK = 'https://tpm.cianjur.space';

/** Legacy / placeholder values — treat as auto-detect instead of a fixed domain. */
const AUTO_DETECT_BASE_URLS = new Set([
    '',
    'https://tpm.app',
    'http://tpm.app',
]);

function stripTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

function getApiOrigin(): string | null {
    const apiBase = api?.defaults?.baseURL;
    if (!apiBase) return null;
    try {
        const fullUrl = apiBase.startsWith('http://') || apiBase.startsWith('https://')
            ? apiBase
            : `http://${apiBase}`;
        const url = new URL(fullUrl);
        if (url.hostname) {
            return url.origin;
        }
    } catch {
        // Fall back gracefully if api.defaults.baseURL cannot be parsed
    }
    return null;
}

/**
 * Frontend app origin for /receipt/... pages (not the API host).
 * On local dev the API may be :8000 while the Expo web app is :8081.
 */
export function getPublicReceiptBaseUrl(override?: string | null): string {
    const custom = stripTrailingSlash((override || '').trim());
    if (custom && !AUTO_DETECT_BASE_URLS.has(custom)) {
        return custom;
    }

    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
        return window.location.origin;
    }

    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.debuggerHost ||
        (Constants.manifest as any)?.debuggerHost;
    if (hostUri) {
        const [host, port = '8081'] = hostUri.split(':');
        if (host) {
            return `http://${host}:${port}`;
        }
    }

    const apiOrigin = getApiOrigin();
    if (apiOrigin) {
        return apiOrigin;
    }

    return PRODUCTION_FALLBACK;
}

/** Origin server tanpa /api, mis. https://host. Dipakai untuk link pendek /s/{kode}. */
export function getPublicOrigin(): string {
    return FILE_URL.startsWith('http') ? FILE_URL : getPublicReceiptBaseUrl();
}

/** Basis API publik, mis. https://host/api/v1. Link yang dibaca crawler chat harus memakai host ini. */
export function getPublicApiBase(): string {
    return BASE_URL.startsWith('http') ? BASE_URL : `${getPublicReceiptBaseUrl()}/api/v1`;
}

export function buildPublicReceiptUrl(
    type: PublicReceiptType,
    idOrToken: string,
    overrideBaseUrl?: string | null,
): string {
    const base = getPublicReceiptBaseUrl(overrideBaseUrl);
    return `${base}/receipt/${type}/${idOrToken}`;
}

/** Link pendek `${api}/s/${kode}` yang meneruskan ke halaman struk. Null bila gagal. */
export async function buildPublicShortUrl(
    type: PublicReceiptType,
    idOrToken: string,
): Promise<string | null> {
    try {
        const { data } = await api.post('/public/short-link', { tipe: type, target: idOrToken });
        return `${getPublicOrigin()}/s/${data.kode}`;
    } catch (error) {
        console.warn('[publicReceiptUrl] gagal membuat link pendek, pakai link panjang:', error);
        return null;
    }
}

export function normalizeQrCodeBaseUrl(value?: string | null): string {
    const trimmed = (value || '').trim();
    if (!trimmed || AUTO_DETECT_BASE_URLS.has(trimmed)) {
        return '';
    }
    return stripTrailingSlash(trimmed);
}