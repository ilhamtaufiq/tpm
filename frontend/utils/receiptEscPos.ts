import * as FileSystem from 'expo-file-system';
import jpeg from 'jpeg-js';

function normalizeFileUri(uri: string): string {
    if (uri.startsWith('file://')) {
        return uri;
    }
    if (uri.startsWith('/')) {
        return `file://${uri}`;
    }
    return uri;
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
    const chunk = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
        const slice = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
}

function shouldPrintPixel(r: number, g: number, b: number, a: number): boolean {
    if (a < 255) {
        return false;
    }
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 127;
}

/** Match BLEPrinterAdapter.sendBitmapToPrinter ESC/POS raster commands. */
export function rgbaToEscPosBytes(data: Uint8Array, width: number, height: number): Uint8Array {
    const chunks: number[] = [];

    const pushByte = (value: number) => {
        chunks.push(value & 0xff);
    };

    const pushBytes = (arr: number[]) => {
        for (const value of arr) {
            pushByte(value);
        }
    };

    pushBytes([0x1b, 0x33, 24]);
    pushBytes([0x1b, 0x61, 0x31]);

    for (let y = 0; y < height; y += 24) {
        pushBytes([0x1b, 0x2a, 33]);
        pushByte(width & 0xff);
        pushByte((width >> 8) & 0xff);

        for (let x = 0; x < width; x += 1) {
            for (let band = 0; band < 3; band += 1) {
                let slice = 0;
                for (let bit = 0; bit < 8; bit += 1) {
                    const row = y + band * 8 + bit;
                    if (row < height) {
                        const idx = (row * width + x) * 4;
                        if (shouldPrintPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                            slice |= 1 << (7 - bit);
                        }
                    }
                }
                pushByte(slice);
            }
        }

        pushByte(0x0a);
    }

    pushBytes([0x1b, 0x33, 32]);
    pushByte(0x0a);

    return new Uint8Array(chunks);
}

export async function jpegFileToEscPosBase64(fileUri: string): Promise<string> {
    const normalized = normalizeFileUri(fileUri);
    const info = await FileSystem.getInfoAsync(normalized);
    if (!info.exists) {
        throw new Error('File gambar struk tidak ditemukan.');
    }

    const base64 = await FileSystem.readAsStringAsync(normalized, {
        encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length < 64) {
        throw new Error('File gambar struk kosong.');
    }

    const decoded = jpeg.decode(base64ToBytes(base64), { useTArray: true });
    if (!decoded?.data || decoded.width <= 0 || decoded.height <= 0) {
        throw new Error('Gagal decode JPEG struk.');
    }

    const escPosBytes = rgbaToEscPosBytes(decoded.data, decoded.width, decoded.height);
    if (escPosBytes.length < 32) {
        throw new Error('Data ESC/POS struk kosong.');
    }

    return bytesToBase64(escPosBytes);
}

export async function jpegPayloadToEscPosBase64(imagePayload: string): Promise<string> {
    const parsed = JSON.parse(imagePayload) as {
        url?: string;
        path?: string;
        cacheFile?: string;
        absoluteCachePath?: string;
    };

    const candidates: string[] = [];

    if (parsed.absoluteCachePath) {
        candidates.push(normalizeFileUri(parsed.absoluteCachePath));
    }
    if (parsed.url) {
        candidates.push(normalizeFileUri(parsed.url));
    }
    if (parsed.path) {
        candidates.push(normalizeFileUri(parsed.path));
    }
    if (parsed.cacheFile && FileSystem.cacheDirectory) {
        candidates.push(normalizeFileUri(`${FileSystem.cacheDirectory}${parsed.cacheFile}`));
    }

    let lastError: Error | null = null;
    for (const candidate of candidates) {
        try {
            return await jpegFileToEscPosBase64(candidate);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError ?? new Error('Tidak ada file gambar struk yang valid untuk dikonversi.');
}