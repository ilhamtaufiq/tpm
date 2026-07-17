import { NativeModules, Platform } from 'react-native';

const RNBLEPrinter = Platform.OS === 'android' ? NativeModules.RNBLEPrinter : null;

export type BleBillOptions = {
    beep?: boolean;
    cut?: boolean;
    tailingLine?: boolean;
    encoding?: string;
    /** Thermal Font-A columns — used to software-center legacy <C> lines. */
    charWidth?: number;
};

const DEFAULT_BILL_OPTIONS: Required<Omit<BleBillOptions, 'charWidth'>> = {
    beep: false,
    cut: true,
    tailingLine: true,
    encoding: 'UTF8',
};

/**
 * Pad text to fixed thermal width with leading spaces (software center).
 * Avoids ESC a hardware align which leaks as printable "a" when ESC is dropped
 * after logo bit-images → "aTiga Putra Motor" left-aligned.
 */
function padCenter(text: string, width: number): string {
    const t = String(text || '').trim();
    if (!t) return '';
    if (width < 1 || t.length >= width) return t.slice(0, Math.max(1, width));
    const left = Math.floor((width - t.length) / 2);
    return `${' '.repeat(left)}${t}`;
}

/**
 * Minimal Latin-1 ESC/POS body — primary path for BLE after logo.
 * Only ESC @ init; no ESC a / ESC 2 / ESC 3 (letter/digit leaks on cheap printers).
 * Centered lines must already be space-padded (or still use legacy <C> tags — we pad).
 */
function simpleBillTextToBase64(text: string, opts?: BleBillOptions): string {
    const options = { ...DEFAULT_BILL_OPTIONS, ...opts };
    const width = Math.max(24, options.charWidth ?? 32);
    const chunks: number[] = [];
    // ESC @ init only — do not emit ESC a / ESC 2 / ESC 3
    chunks.push(0x1b, 0x40);

    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        const isCenterTag = /<C(?:B|M|D)?>/i.test(line);
        let plain = line
            .replace(/<\/?(?:C|B|CB|CM|CD|D|M|L|R)>/gi, '')
            .replace(/&nbsp;/g, ' ');
        // If caller still uses <C>, space-pad; otherwise keep existing spaces (software center).
        if (isCenterTag) {
            plain = padCenter(plain, width);
        }
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
    // Prefer simple encoder after logo bitmaps — EPToolkit emits ESC a / ESC 2 which
    // leak as "a"/"2"/"3" when ESC desyncs on cheap BLE printers.
    return simpleBillTextToBase64(text, opts);
}

/**
 * Minimal centered lines after logo/QR bitmaps — space padding only (no ESC a).
 * Avoids "aTiga..." / "2Scan..." / "3TIGA..." artifacts on thermal BLE printers.
 */
export function billCenterLinesToBase64(
    lines: string[],
    opts?: { cut?: boolean; charWidth?: number },
): string {
    const width = Math.max(24, opts?.charWidth ?? 32);
    const chunks: number[] = [];
    // ESC @ init only
    chunks.push(0x1b, 0x40);

    for (const rawLine of lines) {
        const line = padCenter(String(rawLine || ''), width);
        if (!line) continue;
        for (let i = 0; i < line.length; i += 1) {
            const code = line.charCodeAt(i);
            chunks.push(code <= 0xff ? code : 0x3f);
        }
        chunks.push(0x0a);
    }

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