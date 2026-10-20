export const formatCurrency = (amount: any): string => {
    let value: number;
    if (typeof amount === 'number') {
        value = amount;
    } else if (typeof amount === 'string') {
        if (amount.includes(',') && !amount.includes('.')) {
            value = parseFloat(amount.replace(/,/g, '.'));
        } else if (amount.includes('.') && amount.includes(',')) {
            value = parseFloat(amount.replace(/\./g, '').replace(/,/g, '.'));
        } else if (amount.includes('.') && !amount.includes(',')) {
            const dotCount = (amount.match(/\./g) || []).length;
            if (dotCount > 1) {
                value = parseFloat(amount.replace(/\./g, ''));
            } else {
                const parts = amount.split('.');
                const lastSegLen = parts[parts.length - 1].length;
                const firstSegLen = parts[0].length;
                if (lastSegLen === 3 && firstSegLen <= 3) {
                    value = parseFloat(amount.replace(/\./g, ''));
                } else {
                    value = parseFloat(amount);
                }
            }
        } else {
            value = parseFloat(amount);
        }
    } else {
        value = 0;
    }
    const safeAmount = isNaN(value) ? 0 : value;
    return 'Rp' + Math.round(safeAmount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const formatNumber = (value: string | number): string => {
    if (value === undefined || value === null || value === '' || value === '0') return '0';
    const strVal = String(value);
    // Only strip decimal if true API decimal (max 2 digits after dot)
    // "10000.00" -> decimal; "100.000" -> Indonesian thousands, keep intact
    const dotIdx = strVal.indexOf('.');
    const onlyOneDot = dotIdx > 0 && strVal.indexOf('.', dotIdx + 1) === -1;
    const decimalLen = onlyOneDot ? strVal.length - dotIdx - 1 : 0;
    const isApiDecimal = onlyOneDot && decimalLen >= 1 && decimalLen <= 2;
    const mainPart = isApiDecimal ? strVal.substring(0, dotIdx) : strVal;
    const cleaned = mainPart.replace(/[^0-9]/g, '');
    if (cleaned === '' || cleaned === '0') return '0';
    const num = parseInt(cleaned, 10);
    if (isNaN(num)) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseNumber = (formattedValue: string): number => {
    if (!formattedValue || formattedValue === '') return 0;
    const cleaned = formattedValue.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
};

/**
 * Qty bisa pecahan (0.5 liter oli), jadi jangan pakai formatNumber
 * yang membuang desimal: formatNumber(0.5) === '0'.
 * 1 -> "1", 0.50 -> "0.5", "0.5" -> "0.5"
 */
export const formatQty = (value: unknown): string => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return String(Number(num.toFixed(2)));
};

/**
 * Formats currency for display in financial reports.
 * Negative values are shown in parentheses with no minus sign: (Rp100.000)
 */
export const formatCurrencyDisplay = (amount: any): string => {
    let value: number;
    if (typeof amount === 'number') {
        value = amount;
    } else if (typeof amount === 'string') {
        if (amount.includes(',') && !amount.includes('.')) {
            value = parseFloat(amount.replace(/,/g, '.'));
        } else if (amount.includes('.') && amount.includes(',')) {
            value = parseFloat(amount.replace(/\./g, '').replace(/,/g, '.'));
        } else if (amount.includes('.') && !amount.includes(',')) {
            const dotCount = (amount.match(/\./g) || []).length;
            if (dotCount > 1) {
                value = parseFloat(amount.replace(/\./g, ''));
            } else {
                const parts = amount.split('.');
                const lastSegLen = parts[parts.length - 1].length;
                const firstSegLen = parts[0].length;
                if (lastSegLen === 3 && firstSegLen <= 3) {
                    value = parseFloat(amount.replace(/\./g, ''));
                } else {
                    value = parseFloat(amount);
                }
            }
        } else {
            value = parseFloat(amount);
        }
    } else {
        value = 0;
    }
    const safeAmount = isNaN(value) ? 0 : value;
    const absAmount = Math.abs(Math.round(safeAmount));
    const formatted = 'Rp' + absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return safeAmount < 0 ? `(${formatted})` : formatted;
};

export const formatDateTime = (dateString: string): string => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
};

// Tanggal saja (YYYY-MM-DD) dari server dibaca sebagai tanggal kalender lokal, bukan UTC midnight.
// new Date('2026-10-19') jatuh di 19 Okt 00.00 UTC, yang di perangkat zona barat tampil 18 Okt.
export const tanggalLokal = (value: string | Date | null | undefined): Date => {
    if (value instanceof Date) return value;
    if (!value) return new Date(NaN);
    const tanggalSaja = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (tanggalSaja) return new Date(Number(tanggalSaja[1]), Number(tanggalSaja[2]) - 1, Number(tanggalSaja[3]));
    return new Date(value);
};

const NAMA_BULAN =['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    try {
        // Tanggal saja (YYYY-MM-DD) diformat dari komponennya, supaya zona perangkat tidak menggeser harinya.
        const tanggalSaja = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
        if (tanggalSaja) {
            const [, y, m, d] = tanggalSaja;
            return `${d} ${NAMA_BULAN[Number(m) - 1]} ${y}`;
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return '-';
    }
};

// Tanggal "hari ini" mengikuti WIB (UTC+7) seperti server, bukan zona perangkat.
// Dengan `d` eksplisit, komponen tanggal lokal dipakai apa adanya.
export const getTodayString = (d?: Date): string => {
    if (!d) {
        const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
        return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-${String(wib.getUTCDate()).padStart(2, '0')}`;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
