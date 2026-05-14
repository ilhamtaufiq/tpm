# Financial Flow Analysis (Alur Keuangan)

This document describes how funds and values move through the TPM system.

## 1. Procurement Flow (Pembelian Aset/Stok)
Aset (Mobil/Sparepart) masuk ke sistem melalui dua cara:
- **Tunai**: Transaksi `KasBank` (KELUAR) dibuat -> Stok bertambah.
- **Kredit**: `HutangUsaha` dibuat -> Stok bertambah. Saat pelunasan, transaksi `KasBank` (KELUAR) memotong saldo Hutang.
- **Injeksi Modal**: Jika stok didaftarkan tanpa `KasBank` atau `HutangUsaha`, sistem menganggapnya sebagai **Modal Non-Kas**.

## 2. Sales & Revenue Flow (Pendapatan)
- **Tunai**: Uang masuk ke **Wallet Unit** (contoh: `KAS_UNIT_BENGKEL`) -> Transaksi `KasBank` (MASUK).
- **Piutang**: Transaksi Penjualan dibuat -> `PiutangUsaha` bertambah. Saat pelanggan bayar, transaksi `KasBank` (MASUK) memotong saldo Piutang.

## 3. Internal Service Flow (Biaya Repair Mobil)
Ini adalah alur paling krusial untuk menjaga sinkronisasi unit:
1. **Pekerjaan**: Bengkel mengerjakan mobil milik unit Jual Beli Mobil.
2. **Pencatatan**: Terbentuk **Piutang Internal** (Bengkel) dan **Hutang Internal** (Mobil).
3. **Kapitalisasi**: Biaya repair ini otomatis **menambah nilai aset/stok mobil** tersebut (menaikkan HPP).
4. **Eliminasi**: Selama mobil belum terjual, pendapatan internal ini "dieliminasi" dari Laba Bersih konsolidasi untuk menghindari profit semu.

## 4. Employee Flow (Gaji & Kasbon)
1. **Pemberian Kasbon**: Dana keluar dari `KAS_UTAMA` -> `PiutangKaryawan` bertambah.
2. **Penggajian (Gaji Mingguan)**: 
   - Gaji kotor dihitung.
   - Potongan Kasbon dilakukan (mengurangi saldo `PiutangKaryawan`).
   - Sisa gaji dibayar tunai/transfer -> Transaksi `KasBank` (KELUAR).

## 5. Funding Source (Routing Dana)
- **Operasional Kecil**: Menggunakan Wallet Unit masing-masing.
- **Investasi/Besar/Kasbon**: Menggunakan `KAS_UTAMA` atau `BANK_UTAMA`.
- **Aturan**: Jika Wallet Unit kosong, sistem harus diarahkan secara eksplisit ke **Utama** melalui parameter `kas_jenis`.
