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
