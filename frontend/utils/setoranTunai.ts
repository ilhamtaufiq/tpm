/**
 * Keterangan setoran mengikuti tujuan yang dipilih, supaya label tidak
 * menyebut "tunai" saat uangnya masuk ke bank atau unit lain.
 */
export const SETORAN_NOTE_DEFAULT = 'Setoran Tunai ke Akun Utama';

const LABEL_TUJUAN: Record<string, string> = {
    KAS_UTAMA: 'Setoran Tunai ke Akun Utama',
    BANK_UTAMA: 'Setoran ke Bank Utama',
    KAS_UNIT_MOBIL: 'Setoran ke Unit Mobil',
    KAS_UNIT_BENGKEL: 'Setoran ke Unit Bengkel',
};

export const labelSetoran = (tujuan: string): string => LABEL_TUJUAN[tujuan] ?? SETORAN_NOTE_DEFAULT;

/** Keterangan yang diisi otomatis (belum diedit user) boleh diganti saat tujuan berubah. */
export const isSetoranAutoNote = (note: string): boolean =>
    !note || Object.values(LABEL_TUJUAN).includes(note);
