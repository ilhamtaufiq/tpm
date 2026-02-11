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
            // Tricky case: "500.000" (thousand) vs "500.00" (decimal)
            // For this app's context, if more than 2 digits after last dot, it's a thousand separator
            const parts = amount.split('.');
            if (parts[parts.length - 1].length === 3) {
                value = parseFloat(amount.replace(/\./g, ''));
            } else {
                value = parseFloat(amount);
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

export const parseNumber = (value: string): number => {
    if (!value) return 0;
    return parseInt(value.replace(/\./g, ''), 10) || 0;
};

export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};
