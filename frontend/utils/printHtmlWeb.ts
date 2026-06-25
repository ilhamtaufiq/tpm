import { PrintSettings } from './printSettings';
import { getPaperDimensions } from './paperSize';
import { printHtmlInBrowser } from './printHtmlBrowser';
import { printHtmlViaQz } from './qzTray';
import { QzPrintOptions } from './qzTray.types';

export interface WebPrintOverrides extends QzPrintOptions {
    /** When true, always try QZ first regardless of printMethod (e.g. settings test print). */
    forceQz?: boolean;
    /** When true, skip QZ and use browser print only. */
    browserOnly?: boolean;
}

/**
 * Web print orchestrator.
 * Default on web: QZ Tray first (same as Pengaturan > Test Print), then browser fallback.
 * browser-only when printMethod === 'browser' and forceQz is not set.
 */
export async function printHtmlOnWeb(
    html: string,
    settings: Pick<PrintSettings, 'printMethod' | 'webPrinterName' | 'paperSize'>,
    overrides: WebPrintOverrides = {}
): Promise<void> {
    const paper = getPaperDimensions(settings.paperSize);
    const qzOptions: QzPrintOptions = {
        printerName: overrides.printerName ?? (settings.webPrinterName || undefined),
        paperSize: overrides.paperSize ?? paper.paperSize,
        pageWidthPx: overrides.pageWidthPx ?? paper.widthPx,
        pageHeightPx: overrides.pageHeightPx ?? 9999,
    };

    const browserOnly = overrides.browserOnly || (settings.printMethod === 'browser' && !overrides.forceQz);
    const tryQzFirst = overrides.forceQz || !browserOnly;

    if (tryQzFirst) {
        const printedByQz = await printHtmlViaQz(html, qzOptions);
        if (printedByQz) return;
    }

    await printHtmlInBrowser(html, paper.paperSize);
}