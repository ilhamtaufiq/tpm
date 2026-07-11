/**
 * Offline QR data-URL for thermal HTML (no network to api.qrserver.com).
 * Uses the `qrcode` package already present via dependency tree.
 */
export async function buildOfflineQrDataUrl(
    content: string,
    sizePx = 120,
): Promise<string | null> {
    if (!content?.trim()) return null;

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const QRCode = require('qrcode') as {
            toDataURL: (
                text: string,
                opts?: Record<string, unknown>,
            ) => Promise<string>;
        };

        const dataUrl = await QRCode.toDataURL(content, {
            // Higher ECC survives thermal threshold/blur better.
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 2,
            // Allow up to 360px so 80mm QR stays sharp after scale-down.
            width: Math.max(96, Math.min(sizePx, 360)),
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        });

        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            return null;
        }
        return dataUrl;
    } catch (error) {
        console.warn('[Print] Offline QR generation failed:', error);
        return null;
    }
}
