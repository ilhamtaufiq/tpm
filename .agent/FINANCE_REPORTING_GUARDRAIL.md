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
- **Status kerja** (`ANTRE`/`PROSES`/`SELESAI`) terpisah dari **pengakuan keuangan**.
- `grand_total > 0` (sudah ada tagihan/item) = laba & pendapatan diakui di Laba Rugi & Neraca, termasuk saat status masih `PROSES`/`ANTRE`.
- Belum lunas (`BELUM_LUNAS`/`CICILAN`) = piutang dibuat, kas belum naik.
- `Update Transaksi` / `Simpan Transaksi` tanpa pembayaran **tidak** mengubah status kerja ke `SELESAI`; status tetap `ANTRE`/`PROSES`.
- `SELESAI` (status kerja) hanya dari: (1) pembayaran lunas, atau (2) ubah status manual di daftar antrian.
- `grand_total = 0` = belum ada tagihan (kecuali ada DP tercatat terpisah).
- DP pada transaksi tanpa item (`grand_total = 0`) dicatat sebagai kas masuk dan muncul di Neraca sebagai "Uang Muka Penjualan" (Hutang).
- Saat transaksi di-settle (SELESAI), DP diakui sebagai pendapatan dan pos "Uang Muka Penjualan" hilang.
- **Pitfall**: Jangan double-counting `customer_dp` di `kewajiban_usaha` (`modal_service.py`) karena `hutang_usaha_total` sudah memuatnya.
- **Pitfall**: Query DP di `reports/base.py` tidak boleh memfilter `status_bayar != LUNAS` atau `status != LUNAS` untuk piutang, agar overpayment/DP tetap masuk sebagai liabilitas meski sistem menandainya LUNAS (karena `bayar >= grand_total`).
- Dashboard operasional boleh menampilkan semua status; laporan finansial memakai filter `grand_total > 0` dan `status_bayar != BATAL`.
- **Internal JB Mobil (part/service)**: transaksi `jual_beli_mobil` dengan `grand_total > 0` dan status `PROSES` tetap diakui di Laba Rugi **dan** dikapitalisasi ke stok mobil (`perbaikan_internal`) di Neraca/Perubahan Modal. Filter terpusat: `app/utils/workshop_finance.py` (`workshop_finance_recognized_filters`, `internal_mobil_workshop_filters`). Jangan pakai `status_pengerjaan == SELESAI` saja untuk laporan finansial internal mobil — itu membuat laba bengkel terhitung tapi nilai stok mobil tidak naik (selisih perubahan modal).

## Pembatalan Transaksi (Void)

Status tampilan UI untuk void: **Dibatalkan** (bukan "Batal"/"BATAL").

Ketika transaksi bengkel dibatalkan:
- Semua entry `KasBank` terkait transaksi **harus dihapus** agar saldo kas kembali normal.
- `PiutangUsaha` terkait transaksi **harus dihapus** agar tidak muncul di laporan piutang.
- `HutangUsaha` internal (jika ada) **harus dihapus** agar neraca tetap seimbang.
- Stok sparepart **harus dikembalikan** ke jumlah awal.
- Status transaksi di-set ke `status_pengerjaan = BATAL` dan `status_bayar = BATAL`.
- Saldo kas/bank di-rebuild setelah penghapusan entri `KasBank` agar Neraca tidak selisih.
- Laporan finansial mengecualikan transaksi/piutang/hutang berstatus `BATAL`.
- Transaksi yang sudah `BATAL` **tidak bisa di-unvoid**. Buat transaksi baru jika perlu.
- **File utama**: `backend/app/services/transaksi_bengkel_service.py` method `void_transaction()`.
- **File terkait**: `backend/app/services/kas_bank_service.py`, `backend/app/services/piutang_service.py`, `backend/app/services/hutang_service.py`.

## Jasa Angkut — Biaya Operasional Dipotong Tagihan

Untuk muatan jasa angkut dengan biaya operasional (tol, dll.) yang **dipotong dari share/tagihan TPM**:

- Piutang JA = `laba_tpm` (gross share) − `total_biaya` operasional muatan (net tagihan).
- Pembayaran sebagian mengurangi `sisa_piutang`; kas masuk ke `KAS_UNIT_JASA_ANGKUT` (tunai) atau `BANK_UTAMA` (transfer).
- **Jangan** buat `KasBank` KELUAR terpisah untuk biaya operasional muatan — biaya sudah tercermin di piutang net.
- Laporan konsolidasi: `revenue_tpm` JA = gross share − `total_biaya_linked`; `trip_costs` di P&L tidak mengurangi ulang biaya yang sama.
- `NeracaService.sync_ja_muatan_finance()` membersihkan entri legacy `Biaya Operational Muatan` dan rebuild saldo unit JA agar pemasukan sebagian terbaca di aktiva.

**Pitfall**: Menghapus entri kas legacy tanpa rebuild `saldo_sesudah` membuat `KAS_UNIT_JASA_ANGKUT` tampak Rp0 padahal ada pemasukan sebagian → neraca selisih = laba ditahan − piutang JA.

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
