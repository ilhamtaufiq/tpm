import qz from 'qz-tray';
import { QzPrintOptions } from './qzTray.types';

let connectPromise: Promise<void> | null = null;
let certInitialized = false;

/** QZ Tray install URL for user download prompt */
export const QZ_TRAY_INSTALL_URL = 'https://qz.io/download/';

/**
 * One-time security init: configure certificate/signing promises.
 * If window.__QZ_SIGNING_URL is set (by backend config), uses that.
 * Otherwise falls back to QZ built-in self-signing.
 */
async function initSecurity(): Promise<void> {
    if (certInitialized) return;
    certInitialized = true;
    try {
        const url = typeof window !== 'undefined' ? (window as any).__QZ_SIGNING_URL : undefined;
        if (url) {
            qz.security.setCertificatePromise(() => fetch(url).then(r => r.text()));
            qz.security.setSignaturePromise((d: string) =>
                fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: d }).then(r => r.text())
            );
        }
    } catch { /* non-fatal */ }
}

async function ensureConnected(): Promise<void> {
    if (qz.websocket.isActive()) return;
    if (!connectPromise) {
        await initSecurity();
        connectPromise = qz.websocket.connect({
            retries: 0,
            delay: 0,
            usingSecure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false
        }).then(() => undefined).finally(() => { connectPromise = null; });
    }
    await connectPromise;
}

/**
 * Auto-detect QZ Tray availability.
 * Returns { available, needsInstall, message }.
 * Call on page load to show install prompt if missing.
 */
export async function checkQzAvailability(): Promise<{ available: boolean; needsInstall: boolean; message: string }> {
    try {
        await ensureConnected();
        await qz.printers.find();
        return { available: true, needsInstall: false, message: 'QZ Tray tersedia.' };
    } catch (e: any) {
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('connect') || msg.includes('refused') || msg.includes('timed') || msg.includes('ws://')) {
            return { available: false, needsInstall: true, message: 'QZ Tray tidak berjalan. Install atau jalankan QZ Tray di komputer Anda.' };
        }
        if (msg.includes('permit') || msg.includes('allow') || msg.includes('trust')) {
            return { available: false, needsInstall: false, message: 'QZ Tray terdeteksi tetapi belum dipercaya. Izinkan sertifikat di QZ Tray.' };
        }
        return { available: false, needsInstall: true, message: e?.message || 'Gagal mendeteksi QZ Tray.' };
    }
}

export async function printHtmlViaQz(html: string, options: QzPrintOptions = {}): Promise<boolean> {
    try {
        await ensureConnected();

        let printerName = options.printerName?.trim();
        if (!printerName) {
            printerName = await qz.printers.getDefault();
        }

        const config = qz.configs.create(printerName, {
            copies: 1,
            margins: 0,
            rasterize: true,
            scaleContent: true,
        });

        const widthPx = options.pageWidthPx || 302;
        const heightPx = options.pageHeightPx || 9999;

        // Simple HTML without SVG wrapper - let QZ handle page size naturally
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New',monospace; font-size:13px; padding:3mm; background:#fff; color:#000; }
.divider { border-top:1px dashed #000; margin:5px 0; }
.center { text-align:center; }
.bold { font-weight:bold; }
img { max-width: 80px; height: auto; display: block; margin: 0 auto 5px; }
</style>
</head>
<body style="width:${widthPx}px;height:auto;">
${html}
</body>
</html>`;

        const printData: any = {
            type: 'pixel',
            format: 'html',
            flavor: 'plain',
            data: fullHtml,
        };

        await qz.print(config, [printData]);
        return true;
    } catch (error) {
        console.warn('QZ Tray print failed:', error);
        return false;
    }
}

export interface QzConnectionTestResult {
    ok: boolean;
    connected: boolean;
    message: string;
    defaultPrinter?: string;
    printers: string[];
    connectionInfo?: {
        socket?: string;
        host?: string;
        port?: number;
    };
}

export async function testQzTrayConnection(): Promise<QzConnectionTestResult> {
    try {
        await ensureConnected();
        const printers = await qz.printers.find();
        const defaultPrinter = await qz.printers.getDefault();
        const connectionInfo = typeof qz.websocket.getConnectionInfo === 'function'
            ? qz.websocket.getConnectionInfo()
            : undefined;

        return {
            ok: true,
            connected: true,
            message: 'QZ Tray terhubung dan siap print.',
            defaultPrinter,
            printers: Array.isArray(printers) ? printers : [],
            connectionInfo
        };
    } catch (error: any) {
        return {
            ok: false,
            connected: false,
            message: error?.message || 'Gagal terhubung ke QZ Tray.',
            printers: []
        };
    }
}

export async function getQzPrinters(): Promise<string[]> {
    try {
        await ensureConnected();
        const printers = await qz.printers.find();
        return Array.isArray(printers) ? printers : [];
    } catch (error) {
        console.warn('QZ Tray printer lookup failed:', error);
        return [];
    }
}
