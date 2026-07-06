export const isInternalBengkelKategori = (kategori?: string | null) => {
    const raw = String(kategori || 'umum').toLowerCase();
    return raw === 'jasa_angkut' || raw === 'jual_beli_mobil';
};

export const isBengkelTransactionLocked = (item?: {
    status_pengerjaan?: string | null;
    status_bayar?: string | null;
    kategori?: string | null;
} | null) => {
    if (!item) return false;
    const workStatus = String(item.status_pengerjaan || '').toUpperCase();
    const payStatus = String(item.status_bayar || '').toUpperCase();
    if (workStatus.includes('SELESAI') && payStatus === 'INTERNAL') return true;
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
    if (raw === 'INTERNAL') return 'Internal';
    if (raw === 'LUNAS') return 'Lunas';
    if (raw === 'CICILAN') return 'Cicilan';
    if (raw === 'BELUM_LUNAS') return 'Belum Lunas';
    return 'Belum Bayar';
};

export const buildSoldMobilIdSet = (mobilRows?: Array<{ id?: number | string; status?: string | null }>) => {
    const soldSet = new Set<string>();
    (mobilRows || []).forEach((mobil) => {
        if (String(mobil.status || '').toUpperCase() === 'TERJUAL' && mobil.id != null) {
            soldSet.add(String(mobil.id));
        }
    });
    return soldSet;
};

export const buildSoldJbmInvoiceSet = (
    bengkelRows?: Array<{ kategori?: string | null; mobil_id?: number | string | null; nomor_transaksi?: string | null }>,
    soldMobilIds?: Set<string>,
) => {
    const invoices = new Set<string>();
    if (!soldMobilIds?.size) return invoices;

    (bengkelRows || []).forEach((row) => {
        const kategori = String(row.kategori || '').toLowerCase();
        if (
            kategori === 'jual_beli_mobil' &&
            row.mobil_id != null &&
            soldMobilIds.has(String(row.mobil_id)) &&
            row.nomor_transaksi
        ) {
            invoices.add(row.nomor_transaksi);
        }
    });
    return invoices;
};

export const isSoldJbmWorkshopItem = (item?: { kategori?: string | null; mobil_id?: number | string | null } | null, soldMobilIds?: Set<string>) => {
    if (!item || !soldMobilIds?.size) return false;
    const kategori = String(item.kategori || '').toLowerCase();
    return kategori === 'jual_beli_mobil' && item.mobil_id != null && soldMobilIds.has(String(item.mobil_id));
};

export const getBengkelQueuePaymentStatus = (
    item?: { status_bayar?: string | null; jumlah_bayar?: number | string | null; kategori?: string | null; mobil_id?: number | string | null } | null,
    soldMobilIds?: Set<string>,
) => {
    if (isInternalBengkelKategori(item?.kategori) || String(item?.status_bayar || '').toUpperCase() === 'INTERNAL') {
        return 'INTERNAL';
    }

    const status = String(item?.status_bayar || '').toUpperCase();
    const paidAmount = Number(item?.jumlah_bayar || 0);

    if (status === 'BATAL') return 'BATAL';
    if (status === 'LUNAS') return 'LUNAS';
    if (paidAmount > 0) return 'BELUM_LUNAS';
    return 'BELUM_BAYAR';
};