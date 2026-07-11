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
        fontTitle: 13,
        fontFooter: 9,
        charWidth: 32,
        qrSizePx: 64,
        // ~half of layout width so logo stays centered and readable on narrow roll
        logoMaxPx: 96,
        bleImageWidthPx: 384,
        bleMaxImageHeightPx: 2048,
    },
    '80mm': {
        widthMm: 80,
        widthPx: 302,
        widthIn: 3.15,
        padding: '3mm',
        fontBase: 11,
        fontSmall: 10,
        fontTitle: 15,
        fontFooter: 10,
        charWidth: 48,
        qrSizePx: 96,
        logoMaxPx: 120,
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

/**
 * Native ESC/POS fallback sizes — derived from the same HTML/QZ paper map so
 * logo/QR/text columns track 58mm vs 80mm like the WebView raster path.
 *
 * HTML logoMaxPx/qrSizePx are layout pixels; multiply by captureScale to get
 * thermal dots (same scale used when html2canvas upsamples to bleImageWidthPx).
 */
export interface BleNativeLayout {
    paperSize: PaperSize;
    /** Font-A character columns (12-dot font @ 203dpi ≈ bleImageWidth/12). */
    textCharWidth: number;
    /** Logo max width in dots — matches HTML logoMaxPx after raster scale. */
    logoMaxDots: number;
    /** QR edge in dots — matches HTML qrSizePx after raster scale. */
    qrSizeDots: number;
    /** Offline QR encode pixel size (2× dots, then printer scales via maxWidth). */
    qrEncodePx: number;
    /** Full printable width in dots. */
    rollWidthDots: number;
    captureScale: number;
}

export function getBleNativeLayout(paperSize?: string | null): BleNativeLayout {
    const paper = getPaperDimensions(paperSize);
    const captureScale = paper.bleImageWidthPx / paper.widthPx;

    // ESC/POS Font A ≈ 12 dots wide. Match full roll, then subtract a little for
    // the same side padding the HTML body uses (2–3 mm ≈ 1–2 chars).
    const fullCols = Math.max(24, Math.round(paper.bleImageWidthPx / 12));
    const padCols = paper.paperSize === '58mm' ? 2 : 2;
    const textCharWidth = Math.max(24, Math.min(paper.charWidth, fullCols - padCols));

    const logoMaxDots = Math.max(
        96,
        Math.min(paper.bleImageWidthPx, Math.round(paper.logoMaxPx * captureScale)),
    );
    const qrSizeDots = Math.max(
        96,
        Math.min(
            Math.round(paper.bleImageWidthPx * 0.55),
            Math.round(paper.qrSizePx * captureScale),
        ),
    );

    return {
        paperSize: paper.paperSize,
        textCharWidth,
        logoMaxDots,
        qrSizeDots,
        qrEncodePx: Math.min(320, Math.max(128, qrSizeDots * 2)),
        rollWidthDots: paper.bleImageWidthPx,
        captureScale,
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