export type PaperSize = '58mm' | '80mm';

export interface PaperDimensions {
    paperSize: PaperSize;
    widthMm: number;
    widthPx: number;
    widthIn: number;
    padding: string;
    fontBase: number;
    fontSmall: number;
    fontTitle: number;
    fontFooter: number;
    /** Typical monospace character width for BLE / plain-text thermal output */
    charWidth: number;
    /** QR code edge length in pixels for HTML receipts */
    qrSizePx: number;
    /** Max logo width in pixels for HTML receipts */
    logoMaxPx: number;
    /** Printable raster width in dots for BLE thermal image/logo output (203dpi) */
    bleImageWidthPx: number;
    /** Max raster height in dots — keeps BLE image size bounded per paper width */
    bleMaxImageHeightPx: number;
}

export interface BleRasterSpec {
    paperSize: PaperSize;
    layoutWidthPx: number;
    targetWidthPx: number;
    maxHeightPx: number;
    captureScale: number;
    layoutMaxHeightPx: number;
    jpegQuality: number;
}

const PAPER_MAP: Record<PaperSize, Omit<PaperDimensions, 'paperSize'>> = {
    /** 58 mm paper — printable ~48 mm @ 203 dpi; roll diameter (30/37/40 mm) is irrelevant to layout */
    '58mm': {
        widthMm: 58,
        widthPx: 220,
        widthIn: 2.28,
        padding: '2mm',
        fontBase: 10,
        fontSmall: 9,
        fontTitle: 14,
        fontFooter: 9,
        charWidth: 32,
        qrSizePx: 56,
        logoMaxPx: 64,
        bleImageWidthPx: 384,
        bleMaxImageHeightPx: 2048,
    },
    '80mm': {
        widthMm: 80,
        widthPx: 302,
        widthIn: 3.15,
        padding: '4mm',
        fontBase: 11,
        fontSmall: 10,
        fontTitle: 16,
        fontFooter: 10,
        charWidth: 48,
        qrSizePx: 80,
        logoMaxPx: 80,
        bleImageWidthPx: 576,
        bleMaxImageHeightPx: 3072,
    },
};

/** Thermal raster sizing derived from paper settings (203 dpi dot width). */
export function getBleRasterSpec(paperSize?: string | null): BleRasterSpec {
    const paper = getPaperDimensions(paperSize);
    const captureScale = paper.bleImageWidthPx / paper.widthPx;
    const layoutMaxHeightPx = Math.ceil(paper.bleMaxImageHeightPx / captureScale) + 48;

    return {
        paperSize: paper.paperSize,
        layoutWidthPx: paper.widthPx,
        targetWidthPx: paper.bleImageWidthPx,
        maxHeightPx: paper.bleMaxImageHeightPx,
        captureScale,
        layoutMaxHeightPx,
        jpegQuality: 0.85,
    };
}

/** Dashed line for plain-text / BLE thermal receipts */
export function receiptDivider(charWidth: number): string {
    return '-'.repeat(Math.max(16, charWidth));
}

export function normalizePaperSize(value?: string | null): PaperSize {
    if (!value) return '80mm';
    const normalized = value.toLowerCase().trim();
    if (normalized === '58mm' || normalized === '58') return '58mm';
    return '80mm';
}

export function getPaperDimensions(paperSize?: string | null): PaperDimensions {
    const size = normalizePaperSize(paperSize);
    return { paperSize: size, ...PAPER_MAP[size] };
}