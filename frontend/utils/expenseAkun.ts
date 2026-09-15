/**
 * Aturan penurunan metode bayar dari akun sumber dana.
 *
 * Sebelumnya form pengeluaran punya dua pilihan terpisah (akun + metode), sehingga
 * operator bisa memilih `KAS_UTAMA` + `TRANSFER`. Backend mencatatnya sebagai
 * TRANSFER dari akun kas tunai, dan kas utama ikut terpotong (KAS2609150042).
 * Sekarang akun satu-satunya pilihan; metode selalu diturunkan dari sini.
 *
 * Harus tetap sepakat dengan `get_kas_jenis` di backend:
 * TRANSFER -> akun bank, selain itu -> akun kas.
 */
export const AKUN_BANK = ['BANK_UTAMA'];

export const UNITS: Record<string, string> = {
    KAS_UNIT_JASA_ANGKUT: 'jasa_angkut',
    KAS_UNIT_BENGKEL: 'bengkel',
    KAS_UNIT_MOBIL: 'jual_beli_mobil',
};

export const AKUN = [
    { label: 'Kantor', short: 'Kantor', value: 'KAS_UTAMA' },
    { label: 'Bank', short: 'Bank', value: 'BANK_UTAMA' },
    { label: 'Unit Jasa Angkut', short: 'J. Angkut', value: 'KAS_UNIT_JASA_ANGKUT' },
    { label: 'Unit Bengkel', short: 'Bengkel', value: 'KAS_UNIT_BENGKEL' },
    { label: 'Unit Mobil', short: 'Mobil', value: 'KAS_UNIT_MOBIL' },
];

export function metodeDariAkun(akun: string | null | undefined): 'TRANSFER' | 'TUNAI' {
    return akun && AKUN_BANK.includes(akun) ? 'TRANSFER' : 'TUNAI';
}

export function akunUntukUnit(bisnisKategori: string): string | undefined {
    return Object.keys(UNITS).find((akun) => UNITS[akun] === bisnisKategori);
}
