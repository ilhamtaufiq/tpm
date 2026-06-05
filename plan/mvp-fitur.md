# MVP Fitur TPM - Rencana Implementasi Bertahap

Tanggal: 2026-06-05

Dokumen ini menerjemahkan `audit1.md`, `audit2.md`, dan `audit3.md` menjadi rencana MVP fitur yang bisa dikerjakan bertahap. Fokus MVP bukan menambah banyak modul baru, tetapi membuat fitur inti stabil, aman secara finansial, dan nyaman dipakai harian.

## Tujuan MVP

MVP dianggap siap jika aplikasi bisa dipakai untuk operasional harian Tiga Putra Motor dengan alur berikut:

- Bengkel bisa membuat antrian, update order, cetak order slip, menyelesaikan pekerjaan, dan menerima pembayaran/pelunasan tanpa merusak laporan.
- Jual beli mobil bisa mencatat stok, biaya, penjualan, pembayaran, investor, dan laporan dasar.
- Jasa angkut bisa mencatat muatan, biaya operasional, pembayaran/piutang, dan laporan unit.
- Keuangan bisa menampilkan kas/bank, piutang, hutang, pengeluaran, dan laporan utama yang seimbang.
- UI membedakan jelas antara proses kerja dan transaksi finansial.

## Prinsip MVP

1. Stabilitas laporan lebih penting daripada fitur tambahan.
2. Alur finansial harus eksplisit dan bisa ditelusuri.
3. Jangan membuat record keuangan dari aktivitas operasional yang belum final.
4. Fitur boleh sederhana, tetapi status dan data harus benar.
5. Perubahan besar dibuat bertahap agar flow existing tidak rusak.

## MVP 1 - Stabilkan Bengkel

### Scope

- Buat Antrian Bengkel.
- Update Order/Open Bill.
- Tambah jasa servis dan sparepart.
- Cetak Order Slip.
- Selesaikan pekerjaan.
- Pembayaran langsung.
- Pelunasan dari riwayat/rincian order.
- Piutang untuk selesai belum bayar.

### Fitur Wajib

- Status kerja: `ANTRE`, `PROSES`, `SELESAI`, `BATAL`.
- Status bayar: `BELUM_LUNAS`, `CICILAN`, `LUNAS`, `BATAL`.
- Antrian dan proses tidak masuk kas/piutang/hutang/laporan finansial.
- Selesai belum bayar membuat piutang.
- Pembayaran lunas membuat kas masuk.
- Void/batal mengembalikan stok dan membatalkan efek finansial.
- Rincian order menampilkan:
  - item order
  - total
  - diskon
  - status kerja
  - status bayar
  - histori pembayaran
  - tombol cetak sesuai status

### Task Backend

- Tambah guard backend agar `ANTRE/PROSES` tidak membuat KasBank/Piutang/Hutang.
- Validasi `diskon <= subtotal`.
- Validasi nominal payment `> 0`.
- Pastikan selesai belum bayar membuat piutang.
- Pastikan pembayaran piutang bengkel update status transaksi.
- Tambahkan test integrasi:
  - antre tanpa finance
  - antre dengan item tanpa finance
  - update order tidak finance
  - selesai belum bayar jadi piutang
  - lunas jadi kas
  - batal restore stok

### Task Frontend

- Label tombol:
  - `Simpan Antrian`
  - `Simpan Update Order`
  - `Selesaikan Pekerjaan`
  - `Bayar Sekarang`
  - `Pelunasan`
  - `Cetak Order Slip`
  - `Cetak Struk`
- Pisahkan badge status kerja dan status bayar.
- Rincian order dari riwayat harus punya tombol pembayaran/pelunasan jika belum lunas.
- Review item menggabungkan item sama menjadi qty total.
- Input nominal/diskon tetap memakai format Rupiah.

### Acceptance Criteria

- Tidak ada transaksi bengkel `ANTRE/PROSES` di riwayat keuangan.
- Order selesai belum bayar muncul sebagai piutang.
- Neraca tetap balance setelah order selesai belum bayar.
- Pelunasan mengurangi piutang dan menambah kas.
- Order slip berbeda dari struk pembayaran.

## MVP 2 - Stabilkan Laporan Keuangan

### Scope

- Mutasi kas/bank.
- Piutang.
- Hutang.
- Laba rugi.
- Neraca.
- Perubahan modal.
- Reconciliation check awal.

### Fitur Wajib

- Laporan tidak menghitung Bengkel `ANTRE/PROSES`.
- Laporan tidak menghitung transaksi batal.
- Piutang/hutang internal dieliminasi di neraca konsolidasi.
- Ada endpoint atau script audit untuk mendeteksi:
  - KasBank nominal 0
  - KasBank dari Bengkel non-final
  - Piutang lunas tapi sisa > 0
  - Hutang lunas tapi sisa > 0
  - stok negatif
  - neraca selisih

### Task Backend

- Buat `ReconciliationService` read-only.
- Tambahkan endpoint `GET /laporan/reconciliation`.
- Tambahkan response findings dengan severity.
- Tambahkan test neraca untuk skenario kecil:
  - modal awal
  - bengkel antre
  - bengkel selesai belum bayar
  - pelunasan

### Task Frontend

- Di Neraca, tampilkan panel jika ada selisih.
- Tambahkan tombol `Cek Rekonsiliasi`.
- Pada mutasi/piutang/hutang, tampilkan referensi transaksi asal.

### Acceptance Criteria

- User bisa tahu kenapa neraca selisih.
- Laporan utama tetap balance untuk skenario MVP.
- Tidak ada record Rp0 baru di KasBank.

## MVP 3 - Stabilkan Jual Beli Mobil

### Scope

- Master mobil.
- Pembelian/stok mobil.
- Biaya persiapan.
- Internal bengkel untuk mobil.
- Penjualan mobil.
- Pembayaran/cicilan.
- Investor dan pencairan.

### Fitur Wajib

- Satu mobil hanya bisa punya satu penjualan aktif.
- Mobil investor tidak bisa cancel sale setelah pencairan sebelum reversal.
- Biaya internal bengkel ke mobil masuk ke histori biaya mobil.
- Penjualan belum lunas punya piutang.
- Pelunasan mengubah piutang dan kas.

### Task Backend

- Audit ulang flow internal bengkel mobil.
- Pastikan cancel sale investor mengikuti guardrail reversal.
- Tambahkan test:
  - jual mobil tunai
  - jual mobil cicilan
  - pelunasan mobil
  - investor payout
  - cancel sale setelah investor payout ditolak

### Task Frontend

- Tampilkan status unit dan status bayar terpisah.
- Tampilkan histori biaya mobil dengan source.
- Tambahkan aksi pelunasan yang jelas.
- Tampilkan status investor payout/reversal.

### Acceptance Criteria

- Mobil tidak bisa double sale.
- Laporan mobil tidak double count internal repair.
- Investor payout aman terhadap cancel sale.

## MVP 4 - Stabilkan Jasa Angkut

### Scope

- Master armada dan supir.
- Buat muatan.
- Biaya operasional.
- Status muatan.
- Pembayaran/piutang.
- Repair internal dari bengkel.

### Keputusan Bisnis Wajib

Sebelum implementasi lanjut, tetapkan basis piutang JA:

- Opsi A: `harga_jual`
- Opsi B: `pendapatan_kotor`
- Opsi C: `share_tpm`

Rekomendasi MVP: gunakan `harga_jual` untuk invoice customer eksternal, lalu simpan margin/share TPM sebagai laporan internal.

### Task Backend

- Pastikan biaya operasional tidak double count.
- Pastikan muatan batal tidak masuk laporan.
- Pastikan repair bengkel JA hanya masuk finance saat selesai.
- Tambahkan test:
  - muatan belum bayar
  - muatan lunas
  - biaya operasional
  - repair JA
  - batal muatan

### Task Frontend

- Tampilkan status muatan dan status bayar.
- Tampilkan biaya operasional per muatan/armada.
- Tambahkan pelunasan piutang JA.
- Tampilkan repair bengkel terkait muatan.

### Acceptance Criteria

- Piutang JA konsisten.
- Biaya operasional muncul satu kali.
- Muatan batal tidak mempengaruhi laporan aktif.

## MVP 5 - UI/UX Operasional

### Scope

- Dashboard home.
- Riwayat transaksi.
- Detail order.
- Filter minimal.
- Print/receipt.
- Empty/loading/error state.

### Fitur Wajib

- Filter dashboard tidak terlalu banyak pill.
- Riwayat bisa mengarah ke screen edit/detail yang benar.
- Rincian order punya aksi sesuai status.
- Order Slip, Invoice, dan Receipt dibedakan.
- Search customer default 10 data, infinite loading, dan search inline.
- Guest customer memunculkan field kendaraan hanya ketika diperlukan.

### Acceptance Criteria

- User tidak bingung antara antrian, transaksi, invoice, dan pembayaran.
- Semua aksi utama bisa dicapai dari detail/riwayat.
- UI tidak membuka bottom sheet berlebihan untuk search sederhana.

## MVP 6 - Data Safety dan Audit Trail

### Scope

- Reversal ledger.
- Audit log minimal.
- Idempotency payment.
- Soft delete/void policy.

### Fitur Wajib

- Payment tidak duplicate karena double tap.
- Transaksi final tidak dihapus langsung.
- Void memakai reversal.
- Ada alasan batal/void.
- Ada user dan waktu untuk posted/void.

### Task Backend

- Tambahkan `idempotency_key` untuk payment.
- Tambahkan `void_reason`, `voided_by`, `voided_at`.
- Tambahkan reversal untuk KasBank.
- Terapkan minimal pada Bengkel dulu.

### Acceptance Criteria

- Double submit payment tidak menggandakan kas.
- Void transaksi lunas tidak menghapus mutasi lama.
- Riwayat reversal bisa ditelusuri.

## Prioritas Eksekusi

Urutan yang disarankan:

1. MVP 1 - Stabilkan Bengkel.
2. MVP 2 - Stabilkan Laporan Keuangan.
3. MVP 6 - Data Safety dasar untuk Bengkel.
4. MVP 3 - Stabilkan Jual Beli Mobil.
5. MVP 4 - Stabilkan Jasa Angkut.
6. MVP 5 - UI/UX Operasional.

Alasan:

- Bengkel adalah sumber bug terbaru dan paling aktif di flow sekarang.
- Laporan harus segera dijaga agar perubahan berikutnya tidak menambah selisih.
- Reversal/idempotency perlu mulai dari modul yang paling sering dipakai.
- Mobil dan JA lebih aman dikerjakan setelah pola settlement lebih stabil.

## Milestone

### Milestone A - Bengkel Aman

Target:

- Antrian tidak masuk finance.
- Selesai belum bayar jadi piutang.
- Lunas jadi kas.
- Rincian order punya pembayaran/pelunasan.
- Order slip dan struk jelas.

### Milestone B - Laporan Aman

Target:

- Neraca balance untuk skenario utama.
- Reconciliation endpoint tersedia.
- Laporan tidak menghitung order non-final.

### Milestone C - Mobil Aman

Target:

- Penjualan, cicilan, investor, dan cancel sale aman.
- Internal repair tidak double count.

### Milestone D - JA Aman

Target:

- Piutang JA konsisten.
- Biaya operasional tidak double.
- Muatan batal aman.

### Milestone E - Safety Layer

Target:

- Payment idempotent.
- Void/reversal tersedia.
- Audit trail minimal.

## Definition of Done MVP

MVP dianggap selesai jika:

- Flow Bengkel umum bisa berjalan dari antrian sampai pelunasan.
- Flow Mobil bisa berjalan dari stok sampai penjualan/pelunasan.
- Flow JA bisa berjalan dari muatan sampai pembayaran.
- Kas/piutang/hutang berubah sesuai transaksi.
- Laba rugi dan neraca tidak selisih pada skenario utama.
- Tidak ada record finance Rp0 dari order operasional.
- UI action sesuai status.
- Ada test minimal untuk finance gate dan laporan.

## Catatan Non-MVP

Fitur berikut sebaiknya ditunda sampai MVP stabil:

- Refactor besar seluruh laporan sekaligus.
- Dashboard analitik kompleks.
- Otomasi akuntansi penuh berbasis jurnal double-entry.
- Multi-branch/multi-company.
- Role permission granular lengkap.
- Offline-first penuh untuk semua transaksi finansial.

Fitur ini penting, tetapi berisiko tinggi jika dikerjakan sebelum settlement dan laporan stabil.
