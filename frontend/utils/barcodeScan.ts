const FNC1 = '\x1d';

/** Common GS1 application identifiers on automotive part labels. */
const GS1_AI_LENGTH: Record<string, number> = {
    '00': 18,
    '01': 14,
    '10': 20,
    '17': 6,
    '21': 20,
    '240': 30,
    '90': 30,
    '91': 90,
    '92': 90,
};

export type BarcodeScanFormat = 'gs1' | 'ean13' | 'ean8' | 'plain';

export interface ParsedBarcodeScan {
    raw: string;
    preferred: string;
    format: BarcodeScanFormat;
    candidates: string[];
}

function addCandidate(set: Set<string>, value?: string | null) {
    const normalized = (value ?? '').trim();
    if (!normalized) return;
    set.add(normalized);
    const stripped = normalized.replace(/^0+/, '');
    if (stripped) set.add(stripped);
}

function parseGs1Parentheses(raw: string, candidates: Set<string>): boolean {
    const pattern = /\((\d{2,4})\)([^()]+)/g;
    let matched = false;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(raw)) !== null) {
        matched = true;
        const ai = match[1];
        const value = match[2].trim();
        addCandidate(candidates, value);

        if (ai === '01' && value.length >= 13) {
            addCandidate(candidates, value.slice(-13));
            addCandidate(candidates, value.slice(-12));
        }
    }

    return matched;
}

function parseGs1Fnc1(raw: string, candidates: Set<string>) {
    if (!raw.includes(FNC1)) return;

    const segments = raw.split(FNC1).filter(Boolean);
    for (const segment of segments) {
        for (const [ai, fixedLength] of Object.entries(GS1_AI_LENGTH)) {
            if (!segment.startsWith(ai)) continue;
            const value = segment.slice(ai.length, ai.length + fixedLength).trim() || segment.slice(ai.length).trim();
            addCandidate(candidates, value);
            if (ai === '01' && value.length >= 13) {
                addCandidate(candidates, value.slice(-13));
            }
            break;
        }
    }
}

function extractEmbeddedEanCandidates(raw: string, candidates: Set<string>) {
    const gtinFromUrl = raw.match(/(?:[?&]gtin=|gtin[=/:])(\d{13})/i);
    if (gtinFromUrl?.[1]) addCandidate(candidates, gtinFromUrl[1]);

    const eanMatches = raw.match(/\b\d{13}\b/g);
    if (eanMatches) {
        eanMatches.forEach((value) => addCandidate(candidates, value));
    }

    const ean8Matches = raw.match(/\b\d{8}\b/g);
    if (ean8Matches) {
        ean8Matches.forEach((value) => addCandidate(candidates, value));
    }
}

function pickEanCandidate(candidates: Iterable<string>): string | undefined {
    const list = [...candidates];
    return list.find((value) => /^\d{13}$/.test(value))
        || list.find((value) => /^\d{8}$/.test(value));
}

function parseNumericBarcode(raw: string, candidates: Set<string>): BarcodeScanFormat | null {
    if (/^\d{13}$/.test(raw)) {
        addCandidate(candidates, raw);
        addCandidate(candidates, raw.slice(0, 12));
        return 'ean13';
    }
    if (/^\d{8}$/.test(raw)) {
        addCandidate(candidates, raw);
        return 'ean8';
    }
    return null;
}

/**
 * Expand a raw scanner string into multiple lookup candidates.
 * Labels often contain GS1 (90) part numbers and separate EAN-13 GTIN barcodes.
 */
export function parseBarcodeScan(rawInput: string): ParsedBarcodeScan {
    const raw = rawInput.trim();
    const candidates = new Set<string>();

    if (!raw) {
        return { raw: '', preferred: '', format: 'plain', candidates: [] };
    }

    addCandidate(candidates, raw);

    const withoutControls = raw.replace(/[\x00-\x1a\x1c-\x1f\x7f]/g, '');
    if (withoutControls !== raw) {
        addCandidate(candidates, withoutControls);
    }

    const isGs1 = parseGs1Parentheses(raw, candidates) || raw.includes(FNC1);
    if (raw.includes(FNC1)) {
        parseGs1Fnc1(raw, candidates);
    }

    const alphaPart = raw.match(/([A-Z]{1,4}\d{8,})/i);
    if (alphaPart) {
        addCandidate(candidates, alphaPart[1]);
    }

    const numericFormat = parseNumericBarcode(raw.replace(/\D/g, '').length === raw.length ? raw : '', candidates);
    extractEmbeddedEanCandidates(raw, candidates);

    const gs1Ai90 = raw.match(/\(90\)([^()]+)/i);
    const eanCandidate = pickEanCandidate(candidates);
    const preferred = eanCandidate
        || gs1Ai90?.[1]?.trim()
        || [...candidates].find((value) => value !== raw && /[A-Z]/i.test(value))
        || raw;

    const format: BarcodeScanFormat = eanCandidate
        ? (eanCandidate.length === 13 ? 'ean13' : 'ean8')
        : isGs1
            ? 'gs1'
            : numericFormat || 'plain';

    return {
        raw,
        preferred,
        format,
        candidates: [...candidates],
    };
}

export type SparePartBarcodeFields = {
    kode?: string | null;
    kode_part?: string | null;
    kode_ean?: string | null;
};

function partMatchesCandidate(part: SparePartBarcodeFields, candidate: string): boolean {
    const strippedCandidate = candidate.replace(/^0+/, '');
    const fields = [
        (part.kode || '').trim(),
        (part.kode_part || '').trim(),
        (part.kode_ean || '').trim(),
    ];

    return fields.some((field) =>
        field === candidate || field.replace(/^0+/, '') === strippedCandidate,
    );
}

export function findSparePartByBarcode<T extends SparePartBarcodeFields>(
    parts: T[],
    scannedData: string,
): T | undefined {
    const { candidates } = parseBarcodeScan(scannedData);

    for (const candidate of candidates) {
        const found = parts.find((part) => partMatchesCandidate(part, candidate));
        if (found) return found;
    }

    return undefined;
}

/** Pick best row from API search results (exact barcode match first, then fuzzy). */
export function pickBestSparePartMatch<T extends SparePartBarcodeFields>(
    rows: T[],
    scannedData: string,
): T | undefined {
    const exact = findSparePartByBarcode(rows, scannedData);
    if (exact) return exact;

    const parsed = parseBarcodeScan(scannedData);
    const queries = [...new Set([getBarcodeSearchQuery(scannedData), ...parsed.candidates])];

    for (const candidate of queries) {
        if (!candidate) continue;
        const stripped = candidate.replace(/^0+/, '');
        const hit = rows.find((part) => {
            const fields = [part.kode, part.kode_part, part.kode_ean].map((value) => (value || '').trim());
            return fields.some((field) =>
                field === candidate
                || field.replace(/^0+/, '') === stripped
                || (candidate.length >= 8 && field.includes(candidate)),
            );
        });
        if (hit) return hit;
    }

    const query = getBarcodeSearchQuery(scannedData);
    if (/^\d{8,14}$/.test(query) && rows.length === 1) {
        return rows[0];
    }

    return undefined;
}

/** Map scanned barcode to the best sparepart form field. */
export function mapBarcodeToSparePartFields(scannedData: string): {
    kode_part?: string;
    kode_ean?: string;
} {
    const parsed = parseBarcodeScan(scannedData);
    const result: { kode_part?: string; kode_ean?: string } = {};

    if (parsed.format === 'gs1' || /[A-Z]/i.test(parsed.preferred)) {
        result.kode_part = parsed.preferred;
    }
    if (parsed.format === 'ean13' || parsed.format === 'ean8') {
        result.kode_ean = parsed.candidates.find((c) => /^\d{8,14}$/.test(c)) || parsed.preferred;
    }

    if (!result.kode_part && parsed.format !== 'ean13' && parsed.format !== 'ean8') {
        result.kode_part = parsed.preferred;
    }
    if (!result.kode_ean) {
        const eanCandidate = parsed.candidates.find((c) => /^\d{13}$/.test(c));
        if (eanCandidate) result.kode_ean = eanCandidate;
    }

    return result;
}

/** Normalize scan result for search fields — prefer EAN-13 like transaksi screen. */
export function getBarcodeSearchQuery(scannedData: string): string {
    const parsed = parseBarcodeScan(scannedData);
    return pickEanCandidate(parsed.candidates) || parsed.preferred || parsed.raw;
}

/** Search box label after scan — prefer stored EAN, then kode part (matches transaksi UX). */
export function getSparePartSearchDisplayQuery(
    scannedData: string,
    part?: SparePartBarcodeFields | null,
): string {
    const ean = (part?.kode_ean || '').trim();
    if (ean) return ean;
    const partCode = (part?.kode_part || '').trim();
    if (partCode) return partCode;
    const kode = (part?.kode || '').trim();
    if (kode) return kode;
    return getBarcodeSearchQuery(scannedData);
}

const QR_LIKE_SCAN_TYPES = new Set(['qr', 'datamatrix', 'pdf417', 'aztec']);

/** When preferring 1D barcodes, ignore matrix/QR reads so EAN strip is picked instead. */
export function shouldRejectLinearPreferredScan(scanType: string): boolean {
    if ((scanType || '').toLowerCase() === 'hardware') return false;
    return QR_LIKE_SCAN_TYPES.has((scanType || '').toLowerCase());
}

export function formatSparePartCodes(part: SparePartBarcodeFields): string {
    const codes = [part.kode_part, part.kode_ean, part.kode].filter(Boolean);
    return codes.length ? [...new Set(codes)].join(' • ') : '-';
}

export function sparePartMatchesBarcode<T extends SparePartBarcodeFields>(
    part: T,
    scannedData: string,
): boolean {
    return findSparePartByBarcode([part], scannedData) !== undefined;
}