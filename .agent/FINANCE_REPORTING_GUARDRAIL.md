# Finance Reporting Guardrail

Status: stable, verified, single source of truth for finance/reporting changes.

## Scope

Dokumen ini mencakup alur yang menyentuh:
- `finance`
- `laporan`
- `kas_bank`
- `piutang`
- `hutang`
- `neraca`
- `laba_rugi`
- `perubahan_modal`

## Aturan Perubahan

Setiap perubahan yang menyentuh area di atas wajib:
1. diverifikasi end-to-end;
2. dicek dampaknya ke UI, service, dan data sumber;
3. dipastikan tidak merusak konsistensi laporan;
4. dicatat di dokumen ini jika ada perubahan flow, label, atau aturan hitung.

## Investor Reversal Requirement

Untuk mobil milik investor:
- `cancel-sale` tidak boleh dijalankan sebelum pencairan investor direversal secara eksplisit.
- Reversal wajib memakai endpoint `/penjualan-mobil/{id}/investor/reversal`.
- Setelah reversal, validasi ulang saldo kas, status pencairan, dan histori laporan yang terdampak.
- Riwayat pencairan yang direversal harus tetap terlihat dan diberi penanda `REVERSED`, bukan dihapus dari histori.
- Jika ada perubahan pada flow ini, pastikan notifikasi / realtime coverage ikut dicek ulang.

## Checklist Verifikasi Minimum

- UI sesuai flow terbaru.
- Data yang dipakai screen sesuai service/backend.
- Nominal, status, dan filter laporan tetap konsisten.
- Hasil laporan tidak berubah tanpa alasan bisnis yang jelas.
- `tsc` atau test relevan lolos.
- Kalau perubahan menyentuh data live, cek juga `REALTIME_COVERAGE.md` untuk emitter dan scope yang terdampak.

## Prinsip

- Jangan ubah logika laporan hanya untuk menutupi selisih.
- Jika flow keuangan berubah, update dokumentasi ini dulu atau bersamaan dengan implementasi.
- Untuk perubahan yang berdampak ke laporan, dokumentasi ini adalah referensi utama sebelum review lanjutan.
- Untuk perubahan yang butuh live refresh, update juga `.agent/REALTIME_COVERAGE.md`.
