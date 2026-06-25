import type { PaperSize } from './paperSize';

export interface QzPrintOptions {
    printerName?: string;
    pageWidthPx?: number;
    pageHeightPx?: number;
    paperSize?: PaperSize;
}
