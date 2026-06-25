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
}

const PAPER_MAP: Record<PaperSize, Omit<PaperDimensions, 'paperSize'>> = {
    '58mm': {
        widthMm: 58,
        widthPx: 220,
        widthIn: 2.28,
        padding: '2mm',
        fontBase: 10,
        fontSmall: 9,
        fontTitle: 14,
        fontFooter: 9,
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
    },
};

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