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
    if (value === undefined || value === null || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
    if (isNaN(num)) return '';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseNumber = (formattedValue: string): number => {
    if (!formattedValue || formattedValue === '') return 0;
    const cleaned = formattedValue.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
};
