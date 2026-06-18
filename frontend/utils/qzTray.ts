import { Platform } from 'react-native';
import type { QzPrintOptions } from './qzTray.types';

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

let _printHtmlViaQz: (html: string, options?: QzPrintOptions) => Promise<boolean>;
let _testQzTrayConnection: () => Promise<QzConnectionTestResult>;
let _getQzPrinters: () => Promise<string[]>;

if (Platform.OS === 'web') {
    const web = require('./qzTray.web');
    _printHtmlViaQz = web.printHtmlViaQz;
    _testQzTrayConnection = web.testQzTrayConnection;
    _getQzPrinters = web.getQzPrinters;
} else {
    const native = require('./qzTray.native');
    _printHtmlViaQz = native.printHtmlViaQz;
    _testQzTrayConnection = native.testQzTrayConnection;
    _getQzPrinters = native.getQzPrinters;
}

export const printHtmlViaQz = _printHtmlViaQz;
export const testQzTrayConnection = _testQzTrayConnection;
export const getQzPrinters = _getQzPrinters;
