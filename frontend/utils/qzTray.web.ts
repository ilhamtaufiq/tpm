import qz from 'qz-tray';
import { QzPrintOptions } from './qzTray.types';

let connectPromise: Promise<void> | null = null;

async function ensureConnected(): Promise<void> {
    if (qz.websocket.isActive()) return;

    if (!connectPromise) {
        connectPromise = qz.websocket.connect({
            retries: 0,
            delay: 0,
            usingSecure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false
        })
            .then(() => undefined)
            .finally(() => {
                connectPromise = null;
            });
    }

    await connectPromise;
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
            scaleContent: true
        });

        const printData: any = {
            type: 'pixel',
            format: 'html',
            flavor: 'plain',
            data: html
        };

        if (options.pageWidthPx) {
            printData.options = {
                pageWidth: options.pageWidthPx
            };
        }

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
