import * as FileSystem from 'expo-file-system';
import { getBleRasterSpec } from './paperSize';

/** Max base64 chars sent over RN bridge (~750 KB binary JPEG). */
const MAX_BLE_IMAGE_BASE64_CHARS = 1_000_000;

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return { mime: match[1], base64: match[2] };
}

async function readImageSourceAsBase64(imageSource: string): Promise<{ mime: string; base64: string }> {
    if (imageSource.startsWith('data:')) {
        const parsed = parseDataUrl(imageSource);
        if (!parsed) {
            throw new Error('Format gambar struk tidak valid.');
        }
        return parsed;
    }

    let fileUri = imageSource;
    if (fileUri.startsWith('/') && !fileUri.startsWith('file://')) {
        fileUri = `file://${fileUri}`;
    }

    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
        throw new Error('Gambar struk tidak ditemukan setelah render.');
    }

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    const lower = fileUri.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { mime, base64 };
}

export async function buildBleImagePayload(
    imageSource: string,
    paperSize?: string | null,
): Promise<string> {
    const raster = getBleRasterSpec(paperSize);
    const { mime, base64 } = await readImageSourceAsBase64(imageSource);

    if (!base64 || base64.length < 64) {
        throw new Error('Gambar struk kosong atau rusak setelah render.');
    }

    if (base64.length > MAX_BLE_IMAGE_BASE64_CHARS) {
        throw new Error(
            `Gambar struk terlalu besar untuk kertas ${raster.paperSize}. Kurangi item pada struk atau pilih kertas 58mm.`,
        );
    }

    const cacheDir = FileSystem.cacheDirectory;
    const cacheFile = `tpm_receipt_${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`;
    let absoluteCachePath = '';
    if (cacheDir) {
        const cacheUri = `${cacheDir}${cacheFile}`;
        await FileSystem.writeAsStringAsync(cacheUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
        });
        const cacheInfo = await FileSystem.getInfoAsync(cacheUri);
        if (!cacheInfo.exists) {
            throw new Error('Gagal menyimpan gambar struk ke cache aplikasi.');
        }
        absoluteCachePath = stripFileScheme(cacheUri);
    }

    const normalized = normalizeFileUri(imageSource);
    const sourcePath = stripFileScheme(normalized);
    const primaryPath = absoluteCachePath || sourcePath;

    const payload: Record<string, string | number> = {
        cacheFile,
        mime,
        maxWidth: raster.targetWidthPx,
        maxHeight: raster.maxHeightPx,
        paperSize: raster.paperSize,
        url: primaryPath.startsWith('/') ? `file://${primaryPath}` : normalized,
        path: primaryPath,
        absoluteCachePath: primaryPath,
        imageBase64: base64,
    };

    return JSON.stringify(payload);
}

/** Smaller bridge payload — native reads cacheFile/path first. */
export function buildBleCacheOnlyPayload(imagePayload: string): string | null {
    try {
        const parsed = JSON.parse(imagePayload) as {
            cacheFile?: string;
            mime?: string;
            maxWidth?: number;
            maxHeight?: number;
            paperSize?: string;
            url?: string;
            path?: string;
            absoluteCachePath?: string;
        };

        if (!parsed.cacheFile && !parsed.path && !parsed.url && !parsed.absoluteCachePath) {
            return null;
        }

        return JSON.stringify({
            cacheFile: parsed.cacheFile,
            mime: parsed.mime ?? 'image/jpeg',
            maxWidth: parsed.maxWidth,
            maxHeight: parsed.maxHeight,
            paperSize: parsed.paperSize,
            url: parsed.url,
            path: parsed.path ?? parsed.absoluteCachePath,
            absoluteCachePath: parsed.absoluteCachePath,
        });
    } catch {
        return null;
    }
}

function normalizeFileUri(uri: string): string {
    if (uri.startsWith('file://')) {
        return uri;
    }
    if (uri.startsWith('/')) {
        return `file://${uri}`;
    }
    return uri;
}

function stripFileScheme(uri: string): string {
    return uri.replace(/^file:\/\//, '');
}

/** Build native print payload with inline base64 (primary) + cache file + absolute url fallbacks. */
export async function buildBleImagePayloadFromFile(
    fileUri: string,
    paperSize?: string | null,
): Promise<string> {
    return buildBleImagePayload(fileUri, paperSize);
}