// Penggabungan baris riwayat dompet unit.
//
// Biaya operasional bisa dicatat lewat dua jalur:
//   1. Dompet unit → baris kas_bank (jenis KAS_UNIT_X, atau sumber unit di akun pusat).
//   2. Form Pengeluaran → unit tersimpan di `bisnis_kategori`, sedangkan baris kas-nya
//      selalu bersumber PENGELUARAN sehingga tidak pernah cocok dengan filter dompet.
// Fungsi di sini menyatukan keduanya supaya riwayat dompet utuh.

// Unit mobil punya 3 penamaan historis di kolom bisnis_kategori.
export const EXPENSE_UNITS: Record<string, string[]> = {
    BENGKEL: ['bengkel'],
    JASA_ANGKUT: ['jasa_angkut'],
    JUAL_BELI_MOBIL: ['jual_beli_mobil', 'mobil', 'penjualan_mobil'],
};

export const expenseUnitsParam = (unitScope: string): string =>
    (EXPENSE_UNITS[unitScope] ?? []).join(',');

/** Baris pengeluaran → bentuk baris kas_bank agar konsumen dompet tak perlu berubah. */
export function expenseToKasRow(e: any): any {
    return {
        // Id dinegatifkan: pengeluaran hidup di tabel lain, idnya bisa bentrok dengan kas_bank.
        id: -Math.abs(Number(e.id)),
        nomor_transaksi: e.nomor_transaksi,
        tanggal: e.tanggal,
        // Akun asal tidak tersimpan di baris pengeluaran.
        jenis: 'PENGELUARAN',
        tipe: 'KELUAR',
        nominal: Number(e.jumlah),
        sumber: 'PENGELUARAN',
        referensi_id: e.id,
        nomor_referensi: e.nomor_transaksi,
        saldo_sebelum: 0,
        saldo_sesudah: 0,
        keterangan: e.deskripsi,
        created_at: e.created_at,
    };
}

/**
 * Buang pengeluaran yang tidak boleh tampil di dompet ini:
 * - baris kas-nya sudah tampil (dibayar dari dompet unit sendiri → hindari ganda);
 * - baris optimistis offline: unitnya belum diketahui, tak bisa dipastikan milik dompet ini.
 */
export function filterWalletExpenseRows(
    expenses: any[],
    unitScope: string,
    kasNomorReferensi: Iterable<string>,
): any[] {
    const units = EXPENSE_UNITS[unitScope] ?? [];
    const kasRefs = new Set(kasNomorReferensi);
    return expenses.filter((e: any) => {
        const nomor = String(e?.nomor_transaksi ?? '');
        if (nomor.startsWith('OFF-')) return false;
        if (kasRefs.has(nomor)) return false;
        return units.includes(String(e?.bisnis_kategori ?? '').toLowerCase());
    });
}

/** Gabung, dedup per id, urut terbaru dulu. */
export function mergeWalletRows(wallet: any[] = [], central: any[] = [], expenses: any[] = []): any[] {
    const seen = new Set<number>();
    const merged = [...wallet, ...central, ...expenses].filter((item: any) =>
        item?.id == null || seen.has(item.id) ? false : (seen.add(item.id), true)
    );
    return merged.sort((x: any, y: any) => {
        if (x.tanggal !== y.tanggal) return x.tanggal < y.tanggal ? 1 : -1;
        const cx = x.created_at ?? '';
        const cy = y.created_at ?? '';
        if (cx !== cy) return cx < cy ? 1 : -1;
        return (y.id ?? 0) - (x.id ?? 0);
    });
}

// Sumber unit pada feed aktivitas (/dashboard/recent-activity), dari sumber kas unit.
const FEED_SOURCE_BY_UNIT: Record<string, string> = {
    BENGKEL: 'bengkel',
    JASA_ANGKUT: 'jasa_angkut',
    JUAL_BELI_MOBIL: 'jual_beli_mobil',
};

export const feedSourceForUnit = (unitScope: string): string | undefined => FEED_SOURCE_BY_UNIT[unitScope];

const tanggalLokalIso = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Baris transaksi unit dari feed aktivitas → bentuk baris kas_bank. Id berawalan 'bengkel_' / 'muatan_' (tak bentrok dengan id kas). */
export function activityToWalletRow(a: any): any {
    return {
        id: a.id,
        nomor_transaksi: a.ref_number || a.subtitle,
        tanggal: tanggalLokalIso(a.timestamp),
        jenis: a.status,
        tipe: a.is_incoming ? 'MASUK' : 'KELUAR',
        nominal: Number(a.amount),
        sumber: a.source,
        referensi_id: a.original_id,
        nomor_referensi: a.ref_number,
        keterangan: a.title,
        metode_pembayaran: a.status,
        created_at: a.timestamp,
        // Penanda: baris ini milik feed transaksi, bukan kas_bank (tak bisa dibatalkan dari dompet).
        dari_feed: true,
    };
}

/**
 * Tambahkan transaksi unit (type workshop / transport) ke riwayat dompet.
 * - Baris kas/pengeluaran yang sudah ada tidak diubah.
 * - Transaksi yang nomornya sudah tampil sebagai baris kas dilewati (hindari ganda).
 * - Dibatasi rentang tanggal dompet bila diberikan (format yyyy-MM-dd).
 */
export function mergeActivityRows(
    base: any[] = [],
    activities: any[] = [],
    range: { tanggal_dari?: string; tanggal_sampai?: string } = {},
): any[] {
    const usedRefs = new Set<string>();
    base.forEach((row: any) => {
        if (row?.nomor_referensi) usedRefs.add(String(row.nomor_referensi));
        if (row?.nomor_transaksi) usedRefs.add(String(row.nomor_transaksi));
    });
    const usedIds = new Set<string>();
    const extra: any[] = [];
    activities
        .filter((a: any) => a?.type === 'workshop' || a?.type === 'transport')
        .map(activityToWalletRow)
        .forEach((row: any) => {
            if (usedIds.has(row.id)) return;
            if (row.nomor_referensi && usedRefs.has(String(row.nomor_referensi))) return;
            if (!row.tanggal) return;
            if (range.tanggal_dari && row.tanggal < range.tanggal_dari) return;
            if (range.tanggal_sampai && row.tanggal > range.tanggal_sampai) return;
            usedIds.add(row.id);
            if (row.nomor_referensi) usedRefs.add(String(row.nomor_referensi));
            extra.push(row);
        });
    if (extra.length === 0) return base;
    return [...base, ...extra].sort((x: any, y: any) => {
        if (x.tanggal !== y.tanggal) return x.tanggal < y.tanggal ? 1 : -1;
        const cx = String(x.created_at ?? '');
        const cy = String(y.created_at ?? '');
        if (cx !== cy) return cx < cy ? 1 : -1;
        return 0;
    });
}
