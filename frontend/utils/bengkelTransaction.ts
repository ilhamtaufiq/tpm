export const isBengkelTransactionLocked = (item?: {
    status_pengerjaan?: string | null;
    status_bayar?: string | null;
} | null) => {
    if (!item) return false;
    const workStatus = String(item.status_pengerjaan || '').toUpperCase();
    const payStatus = String(item.status_bayar || '').toUpperCase();
    return workStatus.includes('SELESAI') && payStatus === 'LUNAS';
};

export const isBengkelTransactionVoided = (item?: {
    status_pengerjaan?: string | null;
    status_bayar?: string | null;
} | null) => {
    if (!item) return false;
    const workStatus = String(item.status_pengerjaan || '').toUpperCase();
    const payStatus = String(item.status_bayar || '').toUpperCase();
    return workStatus.includes('BATAL') || payStatus === 'BATAL';
};

export const formatBengkelWorkStatusLabel = (status?: string | null) => {
    const raw = String(status || '').toLowerCase();
    if (raw.includes('batal')) return 'Dibatalkan';
    if (raw.includes('selesai')) return 'Selesai';
    if (raw.includes('proses')) return 'Proses';
    return 'Antre';
};

export const formatBengkelPaymentStatusLabel = (status?: string | null) => {
    const raw = String(status || '').toUpperCase();
    if (raw === 'BATAL') return 'Dibatalkan';
    if (raw === 'LUNAS') return 'Lunas';
    if (raw === 'CICILAN') return 'Cicilan';
    if (raw === 'BELUM_LUNAS') return 'Belum Lunas';
    return 'Belum Bayar';
};