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

## Bengkel Work Order Finance Gate

Untuk transaksi bengkel:
- `SELESAI` = transaksi finansial final, semua komponen laporan diakui (laba, piutang, kas).
- `PROSES` dengan `grand_total > 0` = finalize finance: laba diakui, piutang/kas dicatat sesuai pembayaran.
- `ANTRE` dengan `grand_total > 0` = sama seperti PROSES, finalize finance.
- `ANTRE`/`PROSES` dengan `grand_total = 0` = belum finalize (kecuali ada DP).
- DP pada transaksi tanpa item (`grand_total = 0`) dicatat sebagai kas masuk dan muncul di Neraca sebagai "Uang Muka Penjualan" (Hutang).
- Saat transaksi di-settle (SELESAI), DP diakui sebagai pendapatan dan pos "Uang Muka Penjualan" hilang.
- **Pitfall**: Jangan double-counting `customer_dp` di `kewajiban_usaha` (`modal_service.py`) karena `hutang_usaha_total` sudah memuatnya.
- **Pitfall**: Query DP di `reports/base.py` tidak boleh memfilter `status_bayar != LUNAS` atau `status != LUNAS` untuk piutang, agar overpayment/DP tetap masuk sebagai liabilitas meski sistem menandainya LUNAS (karena `bayar >= grand_total`).
- Dashboard operasional boleh menampilkan semua status; dashboard finansial pakai filter `SELESAI` untuk laporan final.

## Pembatalan Transaksi (Void)

Ketika transaksi bengkel dibatalkan:
- Semua entry `KasBank` terkait transaksi **harus dihapus** agar saldo kas kembali normal.
- `PiutangUsaha` terkait transaksi **harus dihapus** agar tidak muncul di laporan piutang.
- `HutangUsaha` internal (jika ada) **harus dihapus** agar neraca tetap seimbang.
- Stok sparepart **harus dikembalikan** ke jumlah awal.
- Status transaksi di-set ke `status_pengerjaan = BATAL` dan `status_bayar = BATAL`.
- Transaksi yang sudah `BATAL` **tidak bisa di-unvoid**. Buat transaksi baru jika perlu.
- **File utama**: `backend/app/services/transaksi_bengkel_service.py` method `void_transaction()`.
- **File terkait**: `backend/app/services/kas_bank_service.py`, `backend/app/services/piutang_service.py`, `backend/app/services/hutang_service.py`.

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
