import Constants from 'expo-constants';

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

/**
 * Frontend app origin for /receipt/... pages (not the API host).
 * On local dev the API may be :8000 while the Expo web app is :8081.
 */
export function getPublicReceiptBaseUrl(override?: string | null): string {
    const custom = stripTrailingSlash((override || '').trim());
    if (custom && !AUTO_DETECT_BASE_URLS.has(custom)) {
        return custom;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }

    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const [host, port = '8081'] = hostUri.split(':');
        if (host) {
            return `http://${host}:${port}`;
        }
    }

    return PRODUCTION_FALLBACK;
}

export function buildPublicReceiptUrl(
    type: PublicReceiptType,
    idOrToken: string,
    overrideBaseUrl?: string | null,
): string {
    const base = getPublicReceiptBaseUrl(overrideBaseUrl);
    return `${base}/receipt/${type}/${idOrToken}`;
}

export function normalizeQrCodeBaseUrl(value?: string | null): string {
    const trimmed = (value || '').trim();
    if (!trimmed || AUTO_DETECT_BASE_URLS.has(trimmed)) {
        return '';
    }
    return stripTrailingSlash(trimmed);
}