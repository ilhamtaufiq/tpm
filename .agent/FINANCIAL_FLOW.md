# Financial Flow Analysis (Alur Keuangan)

Dokumen ini menjelaskan bagaimana uang, piutang/hutang, stok, dan nilai modal bergerak di sistem TPM.

## 1. Prinsip Dasar
- Semua arus uang nyata masuk ke ledger `kas_bank`.
- Tidak semua perubahan nilai adalah arus kas; contoh: modal non-kas, kapitalisasi repair, dan eliminasi internal.
- Tiap transaksi harus dibaca dari dua sudut:
  1. dampak operasional per unit,
  2. dampak konsolidasi perusahaan.

## 2. Procurement Flow (Pembelian Aset/Stok)
### A. Pembelian Tunai
1. aset/stok dibuat,
2. `KasBank` mencatat `KELUAR`,
3. nilai stok/aset bertambah,
4. kas berkurang.

### B. Pembelian Kredit
1. aset/stok dibuat,
2. `HutangUsaha` bertambah,
3. belum ada arus kas saat pembelian,
4. saat pelunasan, `KasBank` mencatat `KELUAR` dan saldo hutang turun.

### C. Aset/Stok Masuk Tanpa Jejak Pembelian
Jika aset atau stok ada tetapi tidak ditemukan pembelian kas/hutang yang sesuai, sistem dapat menganggapnya sebagai **Modal Non-Kas**.

## 3. Sales & Revenue Flow
### A. Penjualan Tunai
- transaksi operasional dibuat,
- `KasBank` mencatat `MASUK`,
- akun tujuan umumnya mengikuti kebijakan wallet:
  - transfer -> `BANK_UTAMA`,
  - tunai unit -> wallet unit terkait.

### B. Penjualan Piutang
- transaksi operasional dibuat,
- `PiutangUsaha` bertambah,
- kas belum berubah,
- saat pelanggan membayar, `KasBank` mencatat `MASUK` dan saldo piutang turun.

## 4. Internal Service Flow
### A. Bengkel -> Jual Beli Mobil
1. Bengkel mengerjakan mobil stok.
2. Tercipta pendapatan internal Bengkel, `PiutangUsaha` internal, dan `HutangUsaha` internal unit Mobil.
3. Biaya part/service dikapitalisasi ke mobil.
4. Selama mobil belum terjual, laba internal dieliminasi dari laporan konsolidasi.
5. Saat mobil terjual/lunas, kewajiban internal diselesaikan dan eliminasi dilepas.

### B. Bengkel -> Jasa Angkut
- Pekerjaan untuk armada atau muatan ditandai sebagai internal Jasa Angkut.
- Biaya terkait ikut masuk ke perhitungan unit Jasa Angkut dan memengaruhi laba TPM untuk ritase/armada terkait.

## 5. Employee Flow
### A. Kasbon
1. `KasbonKaryawan` dibuat.
2. `PiutangUsaha` dengan sumber `KASBON_KARYAWAN` dibuat.
3. Dana keluar melalui `KasBank`.
4. Saat kasbon dibayar manual atau dipotong dari payroll, saldo piutang berkurang.

### B. Penggajian
1. Slip gaji menghitung gaji pokok, lembur, dan potongan kasbon.
2. Potongan kasbon mengurangi piutang karyawan.
3. Sisa gaji dibayar melalui `KasBank`.
4. Gaji memengaruhi laba ditahan dan laporan laba rugi konsolidasi.

## 6. Funding Source & Wallet Routing
- **Transfer** secara default masuk/keluar melalui `BANK_UTAMA`.
- **Tunai/Internal** dari unit memakai wallet unit terkait:
  - `KAS_UNIT_BENGKEL`
  - `KAS_UNIT_MOBIL`
  - `KAS_UNIT_JASA_ANGKUT`
- Transaksi pusat/non-unit default ke `KAS_UTAMA`.
- Jika ada kebutuhan memakai akun tertentu, gunakan `kas_jenis` eksplisit; jangan bergantung pada asumsi diam-diam.

## 7. Dampak ke Tiga Laporan
| Peristiwa | Laba Rugi | Perubahan Modal | Neraca |
|---|---|---|---|
| Penjualan tunai eksternal | pendapatan/laba naik | laba periode naik | kas naik, equity naik |
| Penjualan piutang | pendapatan/laba naik | laba periode naik | piutang naik, equity naik |
| Pembelian stok tunai | belum otomatis beban | tidak langsung | kas turun, persediaan naik |
| Kasbon karyawan | bukan beban | tidak mengubah equity | kas turun, piutang naik |
| Repair internal mobil belum terjual | laba unit Bengkel ada, lalu dieliminasi konsolidasi | laba ditahan disesuaikan | stok dan internal receivable/payable direkonsiliasi |

## 8. Red Flags Saat Debugging
- saldo kas berubah tetapi tidak ada entry `KasBank`,
- stok/aset naik tanpa kas, hutang, atau modal non-kas yang jelas,
- piutang/hutang internal hanya tercatat salah satu sisi,
- laba unit benar tetapi laba konsolidasi terlalu tinggi,
- neraca seimbang hanya karena “dipaksa”, bukan karena alurnya benar.
