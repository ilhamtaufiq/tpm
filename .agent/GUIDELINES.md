# Agent Guidelines & Best Practices

Dokumen ini berisi aturan kerja agar perubahan tetap konsisten dengan desain sistem TPM.

## 1. Prinsip Umum
- Pahami alur bisnis sebelum mengubah kode.
- Jangan menyelesaikan gejala dengan merusak akuntansi dasar.
- Gunakan mode komunikasi Caveman secara default: singkat, langsung, hemat token, tetapi istilah teknis tetap presisi.
- Untuk command shell, kombinasikan Caveman dengan RTK: pakai prefix `rtk` jika memungkinkan.
- Jika satu perubahan menyentuh transaksi, pikirkan efeknya ke:
  1. ledger,
  2. piutang/hutang,
  3. stok/aset,
  4. laporan.

## 2. Accounting Integrity
- **Never force balance**: jangan menambah adjustment hardcoded hanya agar Aktiva = Pasiva.
- Jika neraca tidak seimbang, telusuri dulu:
  - `Modal Non-Kas`,
  - internal transaction sync,
  - saldo kas/bank,
  - hutang/piutang yang hilang.
- Jangan campuradukkan kasbon dengan modal.
- Untuk transaksi lintas wallet, pastikan akun sumber/tujuan eksplisit dan masuk akal.

## 3. Backend Rules
- Gunakan enum dari `app.utils.constants`; hindari string literal bebas.
- Jaga keselarasan antara:
  - model SQLAlchemy,
  - schema Pydantic,
  - service,
  - endpoint API.
- Untuk logika lintas modul, lebih aman mengubah service domain daripada menaruh patch ad hoc di endpoint.
- Saat menambah transaksi baru, tentukan apakah perlu:
  - `KasBank`,
  - `PiutangUsaha`,
  - `HutangUsaha`,
  - atau hanya perubahan non-kas.

## 4. Frontend Rules
- Gunakan service domain yang sudah ada di `frontend/services/`.
- Gunakan `formatCurrency` untuk uang.
- Beri feedback yang jelas untuk sukses, gagal, dan validasi.
- Untuk modul terproteksi, cek keterkaitan dengan `useSecurityStore` dan route mapping.
- Jangan merusak flow offline/persistence saat mengubah fetching.

## 5. Reporting Rules
- `reports/base.py` adalah pusat preparasi data konsolidasi; mulai dari sana bila laporan tidak konsisten.
- `neraca_service.py` adalah pusat rekonsiliasi neraca dan modal non-kas.
- Jangan mengubah satu laporan tanpa memeriksa dampaknya ke dua laporan lain.
- Gunakan rentang tanggal yang sama saat membandingkan Laba Rugi, Perubahan Modal, dan snapshot Neraca.

## 6. Internal Transaction Rules
- Internal mobil harus menjaga pasangan piutang/hutang.
- Jangan menghapus `internal_elimination` tanpa desain pengganti yang menjaga konsolidasi.
- Jika mengubah alur penjualan mobil, cek settlement dan reversal internal.

## 7. Troubleshooting Order
1. Reproduksi dengan data dan tanggal yang jelas.
2. Cek transaksi sumber.
3. Cek ledger/piutang/hutang terkait.
4. Cek agregasi di service report.
5. Baru ubah UI jika data backend sudah benar.

## 8. Dokumentasi
- Jika mengubah alur inti, perbarui `.agent` pada turn yang sama.
- Dokumentasi harus menjelaskan implementasi aktual, bukan desain lama yang sudah tidak dipakai.
- Untuk perubahan finance/laporan, jadikan `FINANCE_REPORTING_GUARDRAIL.md` sebagai acuan utama dan update dokumen itu di turn yang sama.
