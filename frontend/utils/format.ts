export const formatCurrency = (amount: any): string => {
    let value: number;
    if (typeof amount === 'number') {
        value = amount;
    } else if (typeof amount === 'string') {
        const cleanString = amount.replace(/[^\d.-]/g, '');
        // If it looks like a formatted integer (IDR style), we should remove dots.
        // But if it has a decimal comma/dot at the end, it's tricky.
        // For IDR, we usually deal with integers.
        const idrClean = amount.replace(/\./g, '').replace(/,/g, '.');
        value = parseFloat(idrClean);
    } else {
        value = 0;
    }
    const safeAmount = isNaN(value) ? 0 : value;

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(safeAmount);
};

export const formatNumber = (value: string | number): string => {
    if (!value) return '';
    const stringValue = value.toString().replace(/\D/g, '');
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
