import { Platform } from 'react-native';
import { buildReceiptDocument } from './receiptDocument';
import { ensureLogoBase64 } from './receiptLogo';
import { getPaperDimensions } from './paperSize';
import { PrintReceiptData } from './printReceipt';
import { PrintSettings, printSettingsService } from './printSettings';
import { buildOfflineQrDataUrl } from './receiptQrOffline';

export interface PreparedReceiptAssets {
    settings: PrintSettings;
    qrImageDataUrl: string | null;
}

export interface PrepareReceiptAssetsOptions {
    /** Skip QR image entirely (text-only BLE). */
    skipQrImage?: boolean;
    /** Prefer default/local logo only — skip remote logo download. */
    localLogoOnly?: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(fallback);
            }
        }, ms);
        promise
            .then((value) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                }
            })
            .catch(() => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(fallback);
                }
            });
    });
}

export async function prepareReceiptAssets(
    data: PrintReceiptData,
    settings?: PrintSettings,
    options?: PrepareReceiptAssetsOptions,
): Promise<PreparedReceiptAssets> {
    const activeSettings = settings ?? await printSettingsService.getSettings();
    const paper = getPaperDimensions(activeSettings.paperSize);
    const normalizedSettings: PrintSettings = {
        ...activeSettings,
        paperSize: paper.paperSize,
    };

    const logoSource = normalizedSettings.logoUri ?? 'tpm_default';
    // Cap logo work so BLE never freezes on remote logo; fall back to default.
    const base64Logo = await withTimeout(
        ensureLogoBase64(
            options?.localLogoOnly && logoSource !== 'tpm_default' && !logoSource.startsWith('data:')
                ? 'tpm_default'
                : logoSource,
        ),
        4000,
        null,
    );

    const processedSettings: PrintSettings = {
        ...normalizedSettings,
        logoUri: base64Logo,
    };

    let qrImageDataUrl: string | null = null;
    if (!options?.skipQrImage && processedSettings.showQRCode) {
        const doc = buildReceiptDocument(data, processedSettings);
        if (doc.showQr && doc.qrUrl) {
            // Offline QR — same visual as QZ without network hang.
            qrImageDataUrl = await withTimeout(
                buildOfflineQrDataUrl(doc.qrUrl, paper.qrSizePx * 2),
                2500,
                null,
            );
        }
    }

    // Android HTML capture needs data URLs (no external images in WebView).
    // Web/QZ can fall back to external QR URL in generateReceiptHTML when null.
    if (Platform.OS === 'android' && !qrImageDataUrl && !options?.skipQrImage) {
        // leave null — generateReceiptHTML will use api.qrserver.com URL which may fail offline
    }

    return { settings: processedSettings, qrImageDataUrl };
}
