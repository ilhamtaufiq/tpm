import { NativeModules, Platform } from 'react-native';
import { Buffer } from 'buffer';
// Same ESC/POS encoder used by BLEPrinter.printBill / printText in the library.
import * as EPToolkit from 'react-native-thermal-receipt-printer/dist/utils/EPToolkit';

// Hermes has no Node Buffer. EPToolkit + body text encoding need it after logo.
const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!g.Buffer) {
    g.Buffer = Buffer;
}

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

export type BleBillOptions = {
    beep?: boolean;
    cut?: boolean;
    tailingLine?: boolean;
    encoding?: string;
};

const DEFAULT_BILL_OPTIONS: Required<BleBillOptions> = {
    beep: false,
    cut: true,
    tailingLine: true,
    encoding: 'UTF8',
};

/**
 * EPToolkit.exchange_text has a flag bug:
 *   if (typeof opt === "boolean" && controller[key]) { apply }
 * So cut/beep/tailingLine:false still APPLY (controller buffers are truthy).
 * Only pass a flag when it is true; omit it when false so the library skips it.
 *
 * Line-spacing commands that use ASCII digit opcodes leak on cheap BLE printers
 * when ESC is dropped/desynced after bit-image logo:
 *   ESC 2 (0x1B 0x32) → printable "2"  e.g. "2Scan untuk lihat struk..."
 *   ESC 3 n (0x1B 0x33 n) → printable "3"  e.g. "3TIGA PUTRA MOTOR"
 * Strip both; rely on ESC @ defaults instead of substituting one digit for another.
 */
function sanitizeEscPosBuffer(buffer: Buffer): Buffer {
    const out: number[] = [];
    for (let i = 0; i < buffer.length; i += 1) {
        if (buffer[i] === 0x1b && i + 1 < buffer.length) {
            const cmd = buffer[i + 1];
            // ESC 2 — select default line spacing (ASCII '2')
            if (cmd === 0x32) {
                i += 1;
                continue;
            }
            // ESC 3 n — set line spacing to n (ASCII '3' + binary n)
            if (cmd === 0x33 && i + 2 < buffer.length) {
                i += 2;
                continue;
            }
        }
        out.push(buffer[i]);
    }
    return Buffer.from(out);
}

/** Minimal Latin-1 ESC/POS text (no EPToolkit / no iconv) — last-resort body path. */
function simpleBillTextToBase64(text: string, opts?: BleBillOptions): string {
    const options = { ...DEFAULT_BILL_OPTIONS, ...opts };
    const chunks: number[] = [];
    // ESC @ init only — do not emit ESC 2 / ESC 3 (ASCII digit leak on cheap printers)
    chunks.push(0x1b, 0x40);
    // ESC a 0 left
    chunks.push(0x1b, 0x61, 0x00);

    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        // Strip simple <C>/<B> tags used by generateBleReceiptText so plain path still readable
        const plain = line
            .replace(/<\/?(?:C|B|CB|CM|CD|D|M|L|R)>/gi, '')
            .replace(/&nbsp;/g, ' ');
        for (let i = 0; i < plain.length; i += 1) {
            const code = plain.charCodeAt(i);
            chunks.push(code <= 0xff ? code : 0x3f);
        }
        chunks.push(0x0a);
    }

    if (options.tailingLine) {
        chunks.push(0x0a, 0x0a);
    }
    if (options.cut) {
        chunks.push(0x0a, 0x1d, 0x56, 0x00);
    }

    let binary = '';
    const bytes = new Uint8Array(chunks);
    const step = 8192;
    for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
}

export function billTextToBase64(text: string, opts?: BleBillOptions): string {
    const options = { ...DEFAULT_BILL_OPTIONS, ...opts };

    try {
        // Only include true flags — omit false so EPToolkit does not still apply them.
        const toolkitOpts: Record<string, unknown> = {
            encoding: options.encoding || 'UTF8',
        };
        if (options.cut) toolkitOpts.cut = true;
        if (options.beep) toolkitOpts.beep = true;
        if (options.tailingLine) toolkitOpts.tailingLine = true;

        // IOptions requires all flags; partial object is intentional so false flags are omitted (EPToolkit bug).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = EPToolkit.exchange_text(text, toolkitOpts as any);
        const buffer = sanitizeEscPosBuffer(raw);

        // When cut was requested, EPToolkit uses ESC i which many BLE printers ignore.
        // Append GS V 0 (partial cut) as a more compatible cut sequence.
        if (options.cut) {
            const withCut = Buffer.concat([buffer, Buffer.from([0x0a, 0x1d, 0x56, 0x00])]);
            return withCut.toString('base64');
        }

        return buffer.toString('base64');
    } catch (e) {
        console.warn('[Print] EPToolkit bill encode failed, using simple path:', e);
        return simpleBillTextToBase64(text, opts);
    }
}

/**
 * Minimal centered lines after logo/QR bitmaps — no EPToolkit ESC 2 / UTF8 FS codes.
 * Avoids the "2Scan..." artifact and extra blank feeds on thermal BLE printers.
 */
export function billCenterLinesToBase64(
    lines: string[],
    opts?: { cut?: boolean },
): string {
    const chunks: number[] = [];
    // ESC @ init only — avoid ESC 3 (ASCII '3' leak → "3TIGA PUTRA MOTOR")
    chunks.push(0x1b, 0x40);

    for (const rawLine of lines) {
        const line = String(rawLine || '').trim();
        if (!line) continue;
        // ESC a 1 center (binary 1, not ASCII '1')
        chunks.push(0x1b, 0x61, 0x01);
        for (let i = 0; i < line.length; i += 1) {
            const code = line.charCodeAt(i);
            // Latin-1 safe for Indonesian receipt captions
            chunks.push(code <= 0xff ? code : 0x3f);
        }
        chunks.push(0x0a);
    }

    // ESC a 0 left + one small feed
    chunks.push(0x1b, 0x61, 0x00);
    chunks.push(0x0a);

    if (opts?.cut) {
        // GS V 0 partial cut
        chunks.push(0x1d, 0x56, 0x00);
    }

    let binary = '';
    const bytes = new Uint8Array(chunks);
    const step = 8192;
    for (let i = 0; i < bytes.length; i += step) {
        const slice = bytes.subarray(i, i + step);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
}

export function printRawBase64(base64: string, timeoutMs = 12000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!RNBLEPrinter?.printRawData) {
            reject(new Error('Native printRawData tidak tersedia. Rebuild APK setelah update printer.'));
            return;
        }

        if (!base64 || base64.length < 8) {
            reject(new Error('Data cetak kosong.'));
            return;
        }

        let settled = false;
        const finish = (error?: string, soft = false) => {
            if (settled) return;
            settled = true;
            if (error && !soft) {
                reject(new Error(error));
                return;
            }
            // soft timeout: data usually already on the wire (callback never fires on some APKs)
            resolve();
        };

        RNBLEPrinter.printRawData(base64, (error: string) => {
            finish(error || undefined);
        });

        setTimeout(() => {
            if (!settled) {
                console.warn('[Print] printRawData callback timeout — assuming sent');
                finish(undefined, true);
            }
        }, timeoutMs);
    });
}

/** Fire printRawData without waiting (pairing test path). */
export function printRawBase64FireAndForget(base64: string): void {
    if (!RNBLEPrinter?.printRawData) {
        throw new Error('Native printRawData tidak tersedia. Rebuild APK setelah update printer.');
    }
    if (!base64 || base64.length < 8) {
        throw new Error('Data cetak kosong.');
    }
    RNBLEPrinter.printRawData(base64, () => {});
}

export async function printBillText(text: string, opts?: BleBillOptions): Promise<void> {
    const base64 = billTextToBase64(text, opts);
    if (!base64 || base64.length < 8) {
        throw new Error('Data teks struk kosong (encode gagal).');
    }
    console.log('[Print] bill text base64 length', base64.length);
    await printRawBase64(base64, 15000);
}

/**
 * Same path as the working Bluetooth pairing test: fire printRawData without
 * waiting for the native callback (some APK builds never invoke it).
 */
export function printBillTextFireAndForget(text: string, opts?: BleBillOptions): void {
    if (!RNBLEPrinter?.printRawData) {
        throw new Error('Native printRawData tidak tersedia. Rebuild APK setelah update printer.');
    }

    const base64 = billTextToBase64(text, opts);
    if (!base64 || base64.length < 8) {
        throw new Error('Data cetak kosong.');
    }

    RNBLEPrinter.printRawData(base64, () => {});
}

/**
 * Print logo/image via patched native printImageData (JSON payload with imageBase64/path).
 * Fire-and-forget — use printImageDataAsync when order matters (logo before text).
 */
export function printImageDataFireAndForget(payloadJson: string): void {
    if (!RNBLEPrinter?.printImageData) {
        throw new Error('Native printImageData tidak tersedia. Rebuild APK setelah update printer.');
    }
    if (!payloadJson || payloadJson.length < 8) {
        throw new Error('Payload gambar kosong.');
    }
    RNBLEPrinter.printImageData(payloadJson, () => {});
}

/**
 * Await logo/image print. Native invokes callback with empty error on success
 * (patched). Times out as soft-success so a stuck callback never blocks text forever.
 */
export function printImageDataAsync(payloadJson: string, timeoutMs = 12000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!RNBLEPrinter?.printImageData) {
            reject(new Error('Native printImageData tidak tersedia. Rebuild APK setelah update printer.'));
            return;
        }
        if (!payloadJson || payloadJson.length < 8) {
            reject(new Error('Payload gambar kosong.'));
            return;
        }

        let settled = false;
        const finish = (error?: string) => {
            if (settled) return;
            settled = true;
            if (error) {
                reject(new Error(error));
                return;
            }
            resolve();
        };

        try {
            RNBLEPrinter.printImageData(payloadJson, (error: string) => {
                finish(error || undefined);
            });
        } catch (e) {
            finish(e instanceof Error ? e.message : String(e));
            return;
        }

        // Soft success on timeout: older APKs may never invoke the success callback.
        setTimeout(() => {
            if (!settled) {
                console.warn('[Print] printImageData callback timeout — assuming sent');
                finish();
            }
        }, timeoutMs);
    });
}

/**
 * Print QR via native ZXing encode (BLEPrinterAdapter.printQrCode).
 * Content is usually the public receipt URL.
 */
export function printQrCodeFireAndForget(content: string): void {
    if (!RNBLEPrinter?.printQrCode) {
        throw new Error('Native printQrCode tidak tersedia. Rebuild APK setelah update printer.');
    }
    const value = (content || '').trim();
    if (!value) {
        throw new Error('Konten QR kosong.');
    }
    RNBLEPrinter.printQrCode(value, () => {});
}

export function printQrCodeAsync(content: string, timeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!RNBLEPrinter?.printQrCode) {
            reject(new Error('Native printQrCode tidak tersedia. Rebuild APK setelah update printer.'));
            return;
        }
        const value = (content || '').trim();
        if (!value) {
            reject(new Error('Konten QR kosong.'));
            return;
        }

        let settled = false;
        const finish = (error?: string) => {
            if (settled) return;
            settled = true;
            if (error) {
                reject(new Error(error));
                return;
            }
            resolve();
        };

        try {
            RNBLEPrinter.printQrCode(value, (error: string) => {
                finish(error || undefined);
            });
        } catch (e) {
            finish(e instanceof Error ? e.message : String(e));
            return;
        }

        setTimeout(() => {
            if (!settled) {
                console.warn('[Print] printQrCode callback timeout — assuming sent');
                finish();
            }
        }, timeoutMs);
    });
}

export function isBleImagePrintAvailable(): boolean {
    return Boolean(RNBLEPrinter?.printImageData);
}

export function isBleQrPrintAvailable(): boolean {
    return Boolean(RNBLEPrinter?.printQrCode);
}