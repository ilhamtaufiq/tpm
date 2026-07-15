/**
 * Convert receipt logo (PNG/JPEG data URL) → ESC/POS raster base64.
 * Printed via printRawData (same path as text) so logo works without patched printImageData.
 */
import jpeg from 'jpeg-js';
import { ensureLogoBase64 } from './receiptLogo';

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

function stripDataUrl(dataUrl: string): { mime: string; base64: string } | null {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return { mime: match[1], base64: match[2] };
}

interface RgbaImage {
    width: number;
    height: number;
    data: Uint8Array;
}

function decodeJpegRgba(bytes: Uint8Array): RgbaImage | null {
    try {
        const decoded = jpeg.decode(bytes, { useTArray: true });
        if (!decoded?.data || decoded.width <= 0 || decoded.height <= 0) return null;
        return {
            width: decoded.width,
            height: decoded.height,
            data: decoded.data as Uint8Array,
        };
    } catch (e) {
        console.warn('[Print] jpeg logo decode failed:', e);
        return null;
    }
}

function decodePngRgba(bytes: Uint8Array): RgbaImage | null {
    try {
        // Browser build only — Node main entry (lib/png.js) requires `stream`
        // and breaks Metro/EAS Android bundles.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PNG } = require('pngjs/browser') as {
            PNG: {
                sync: {
                    read: (buf: Buffer | Uint8Array) => {
                        width: number;
                        height: number;
                        data: Buffer | Uint8Array;
                    };
                };
            };
        };

        // pngjs expects Buffer-like; polyfill Buffer when Hermes omits it.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const BufferCtor = (globalThis as { Buffer?: typeof Buffer }).Buffer
            ?? (require('buffer') as { Buffer: typeof Buffer }).Buffer;
        const input = BufferCtor.from(bytes);
        const png = PNG.sync.read(input);
        if (!png?.data || png.width <= 0 || png.height <= 0) return null;

        const data = png.data instanceof Uint8Array
            ? new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength)
            : new Uint8Array(png.data as ArrayLike<number>);

        return { width: png.width, height: png.height, data };
    } catch (e) {
        console.warn('[Print] png logo decode failed:', e);
        return null;
    }
}

/** Composite alpha onto white, then scale width (nearest-neighbor). */
function resizeLogoForThermal(src: RgbaImage, maxWidth: number): RgbaImage {
    const targetW = Math.max(48, Math.min(maxWidth, src.width > maxWidth ? maxWidth : src.width));
    // Always scale down large logos; keep small logos as-is unless wider than max.
    const scale = targetW / src.width;
    const targetH = Math.max(1, Math.round(src.height * scale));
    const out = new Uint8Array(targetW * targetH * 4);

    for (let y = 0; y < targetH; y += 1) {
        const sy = Math.min(src.height - 1, Math.floor(y / scale));
        for (let x = 0; x < targetW; x += 1) {
            const sx = Math.min(src.width - 1, Math.floor(x / scale));
            const si = (sy * src.width + sx) * 4;
            const di = (y * targetW + x) * 4;
            const a = src.data[si + 3] / 255;
            // Premultiply onto white so transparent PNG logos don't vanish.
            out[di] = Math.round(src.data[si] * a + 255 * (1 - a));
            out[di + 1] = Math.round(src.data[si + 1] * a + 255 * (1 - a));
            out[di + 2] = Math.round(src.data[si + 2] * a + 255 * (1 - a));
            out[di + 3] = 255;
        }
    }

    return { width: targetW, height: targetH, data: out };
}

/**
 * Thermal 1-bit threshold — slightly aggressive so light-colored logos still ink.
 * Returns true = print black dot.
 */
function shouldInk(r: number, g: number, b: number): boolean {
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 168;
}

/** Same banded ESC/POS raster as BLEPrinterAdapter.sendBitmapToPrinter. */
function rgbaToLogoEscPos(img: RgbaImage): Uint8Array {
    const { width, height, data } = img;
    const chunks: number[] = [];
    const push = (v: number) => {
        chunks.push(v & 0xff);
    };
    const pushArr = (arr: number[]) => {
        for (const v of arr) push(v);
    };

    // Init + center. Avoid ESC 2 / ESC 3 here — if the stream desyncs after
    // bit-image, those opcodes are ASCII '2'/'3' and print as garbage digits
    // before the company name (e.g. "3TIGA PUTRA MOTOR").
    pushArr([0x1b, 0x40]);
    pushArr([0x1b, 0x61, 0x01]);

    for (let y = 0; y < height; y += 24) {
        pushArr([0x1b, 0x2a, 33]);
        push(width & 0xff);
        push((width >> 8) & 0xff);

        for (let x = 0; x < width; x += 1) {
            for (let band = 0; band < 3; band += 1) {
                let slice = 0;
                for (let bit = 0; bit < 8; bit += 1) {
                    const row = y + band * 8 + bit;
                    if (row < height) {
                        const idx = (row * width + x) * 4;
                        if (shouldInk(data[idx], data[idx + 1], data[idx + 2])) {
                            slice |= 1 << (7 - bit);
                        }
                    }
                }
                push(slice);
            }
        }
        push(0x0a);
    }

    // Restore text mode cleanly after bit-image (no digit line-spacing opcodes)
    pushArr([0x1b, 0x40]); // ESC @ init
    pushArr([0x1b, 0x61, 0x00]); // left align
    push(0x0a); // single small feed after logo

    return new Uint8Array(chunks);
}

function decodeLogoDataUrl(dataUrl: string): RgbaImage | null {
    const parsed = stripDataUrl(dataUrl);
    if (!parsed) return null;
    const bytes = base64ToBytes(parsed.base64);
    if (parsed.mime.includes('jpeg') || parsed.mime.includes('jpg')) {
        return decodeJpegRgba(bytes);
    }
    // Default PNG (also try jpeg if png fails)
    return decodePngRgba(bytes) ?? decodeJpegRgba(bytes);
}

/**
 * Build ESC/POS base64 for logo. Uses default asset when uri missing.
 * maxWidthDots: thermal dots (e.g. 160–220 for 58/80mm).
 */
export async function buildLogoEscPosBase64(
    logoUri: string | null | undefined,
    maxWidthDots: number,
): Promise<string | null> {
    try {
        let dataUrl = await ensureLogoBase64(logoUri || 'tpm_default');
        if (!dataUrl) {
            dataUrl = await ensureLogoBase64('tpm_default');
        }
        if (!dataUrl) {
            console.error('[Print] buildLogoEscPosBase64: no logo data');
            return null;
        }

        const decoded = decodeLogoDataUrl(dataUrl);
        if (!decoded) {
            console.error('[Print] buildLogoEscPosBase64: decode failed');
            return null;
        }

        const maxW = Math.max(96, Math.min(384, Math.round(maxWidthDots)));
        const resized = resizeLogoForThermal(decoded, maxW);
        // Guard extreme height (huge logos)
        if (resized.height > 600) {
            const scale = 600 / resized.height;
            const w2 = Math.max(48, Math.round(resized.width * scale));
            const resized2 = resizeLogoForThermal(resized, w2);
            const esc = rgbaToLogoEscPos(resized2);
            if (esc.length < 32) return null;
            return bytesToBase64(esc);
        }

        const escPos = rgbaToLogoEscPos(resized);
        if (escPos.length < 32) {
            console.error('[Print] buildLogoEscPosBase64: empty raster');
            return null;
        }

        console.log('[Print] logo ESC/POS ready', {
            srcW: decoded.width,
            srcH: decoded.height,
            outW: resized.width,
            outH: resized.height,
            bytes: escPos.length,
        });

        return bytesToBase64(escPos);
    } catch (e) {
        console.error('[Print] buildLogoEscPosBase64 failed:', e);
        return null;
    }
}
