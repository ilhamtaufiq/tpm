import { QzPrintOptions } from './qzTray.types';

export async function printHtmlViaQz(_html: string, _options: QzPrintOptions = {}): Promise<boolean> {
    return false;
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
    return {
        ok: false,
        connected: false,
        message: 'QZ Tray hanya tersedia untuk web.',
        printers: []
    };
}

export async function getQzPrinters(): Promise<string[]> {
    return [];
}
