# Database Schema Overview

Daftar tabel inti dan hubungannya dalam database TPM.

## 1. Keuangan (Core Finance)
- `kas_bank`: Log transaksi tunai/transfer. Relasi ke `user` (created_by).
- `piutang`: Pencatatan tagihan ke customer, karyawan (kasbon), atau internal.
- `hutang`: Pencatatan hutang ke supplier atau investor.

## 2. Jual Beli Mobil
- `mobil`: Master data stok mobil.
- `penjualan_mobil`: Transaksi penjualan. Relasi ke `mobil_id`, `customer_id`.
- `pembelian_mobil`: Transaksi pembelian stok.
- `mobil_repair_external`: Biaya repair di luar bengkel sendiri.

## 3. Bengkel (Workshop)
- `spare_part`: Inventaris suku cadang.
- `transaksi_bengkel`: Header servis/penjualan part.
- `item_transaksi_bengkel`: Detail part/jasa yang terjual.
- `pembelian_part`: Transaksi stok masuk.

## 4. Jasa Angkut (Logistics)
- `armada`: Daftar truk/kendaraan angkut.
- `muatan_jasa_angkut`: Transaksi pengiriman/ritase.
- `biaya_muatan`: Biaya operasional per rit (BBM, Tol, dll).

## 5. SDM (Human Resources)
- `karyawan`: Data induk karyawan.
- `kasbon_karyawan`: Log pinjaman. Relasi ke `piutang_id`.
- `slip_gaji`: Catatan penggajian mingguan/bulanan.
- `absensi`: Catatan kehadiran.

## Relasi Krusial
- **`mobil_id`**: Muncul di `transaksi_bengkel` sebagai referensi jika bengkel mengerjakan mobil stok (Internal Repair).
- **`piutang_id`**: Menghubungkan modul operasional (Sales) ke modul Keuangan untuk pelacakan sisa tagihan.
