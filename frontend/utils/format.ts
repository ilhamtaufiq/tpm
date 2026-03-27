export const formatCurrency = (amount: any): string => {
    let value: number;
    if (typeof amount === 'number') {
        value = amount;
    } else if (typeof amount === 'string') {
        // If string contains a comma but no dot, or dot comes before comma, it's likely id-ID (500.000,00)
        // If it's a simple number string "500000", parse it directly.
        if (amount.includes(',') && !amount.includes('.')) {
            value = parseFloat(amount.replace(/,/g, '.'));
        } else if (amount.includes('.') && amount.includes(',')) {
            value = parseFloat(amount.replace(/\./g, '').replace(/,/g, '.'));
        } else if (amount.includes('.') && !amount.includes(',')) {
            // Distinguish Indonesian thousand separators from decimal points
            const dotCount = (amount.match(/\./g) || []).length;
            if (dotCount > 1) {
                // Multiple dots = always thousand separators (e.g., "10.000.000")
                value = parseFloat(amount.replace(/\./g, ''));
            } else {
                // Single dot - check if it's Indonesian format (e.g., "500.000") or decimal (e.g., "10000.00")
                const parts = amount.split('.');
                const lastSegLen = parts[parts.length - 1].length;
                const firstSegLen = parts[0].length;
                // Indonesian thousand format: "X.XXX" where first part is 1-3 digits and last part is exactly 3
                // Examples: "500.000", "1.000", "50.000" → thousand separator
                // NOT Indonesian: "10000.000" (first part > 3 digits), "10000.00" (last part != 3)
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

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeAmount).replace(/Rp\s?/, 'Rp.');
};

export const formatNumber = (value: string | number): string => {
    if (value === undefined || value === null || value === '') return '';

    if (typeof value === 'number') {
        return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    let str = value.toString();

    // Check if it's an API float (e.g., "600000.00" or "600000.0")
    // Pattern: one or more digits, a single dot, and 1 or 2 digits at the end
    // importantly, no other dots in the string
    if (/^\d+\.\d{1,2}$/.test(str)) {
        return Math.round(parseFloat(str)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    // For all other cases (live input like "1.234", "10.000"), strip non-digits and reformat
    // this handles typing correctly as it ignores formatting characters
    const cleanNumber = str.replace(/\D/g, '');
    if (!cleanNumber) return '';
    return cleanNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseNumber = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0;
    const strValue = String(value);
    
    // Check if it's an API float format (e.g., "600000.00")
    // If it has a point followed by 1 or 2 digits AND no other points,
    // it's likely a standard decimal string from the API.
    if (/^\d+\.\d{1,2}$/.test(strValue)) {
        return Math.round(parseFloat(strValue));
    }
    
    // Otherwise, treat as Indonesian format where dots are thousand separators
    return parseInt(strValue.replace(/\./g, ''), 10) || 0;
};

export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

export const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
