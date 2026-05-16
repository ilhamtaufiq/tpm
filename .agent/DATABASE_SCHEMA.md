# Database Schema Overview

Ringkasan tabel inti yang benar-benar dipakai oleh kode backend saat ini.

## 1. Keuangan (Core Finance)
- `kas_bank`: ledger pergerakan kas/bank.
- `piutang_usaha`: piutang customer, kasbon karyawan, dan piutang internal.
- `pembayaran_piutang`: riwayat pembayaran piutang.
- `hutang_usaha`: hutang supplier, investor, dan hutang internal.
- `pembayaran_hutang`: riwayat pembayaran hutang.
- `aset`: aset tetap perusahaan.

## 2. Jual Beli Mobil
- `mobil`: master stok mobil.
- `mobil_media`: media/foto mobil.
- `mobil_biaya_lainnya`: biaya tambahan non-bengkel per mobil.
- `mobil_part_service`: biaya part/service yang dikapitalisasi ke mobil.
- `transaksi_penjualan_mobil`: transaksi penjualan mobil.
- `investor_disbursement_detail`: rincian pencairan investor pada penjualan mobil.

## 3. Bengkel (Workshop)
- `spare_parts`: inventaris suku cadang.
- `jasa_servis`: master jasa servis.
- `pembelian_spare_parts`: header pembelian stok part.
- `detail_pembelian_spare_parts`: detail item pembelian part.
- `transaksi_penjualan_bengkel`: header transaksi bengkel.
- `detail_transaksi_spare_parts`: detail part yang terjual/dipakai.
- `detail_transaksi_services`: detail jasa servis.
- `pengeluaran_bengkel`: pengeluaran operasional bengkel dan pengeluaran yang ditag ke unit/mobil/armada.

## 4. Jasa Angkut (Logistics)
- `supir`: master supir.
- `armada_jasa_angkut`: master armada.
- `muatan_jasa_angkut`: transaksi ritase/pengiriman.
- `jasa_angkut_biaya_lainnya`: biaya tambahan per muatan atau armada.
- `jasa_angkut_part_service`: biaya part/service armada yang dikapitalisasi ke jasa angkut.

## 5. SDM (Human Resources)
- `karyawan`: master karyawan.
- `absensi`: catatan kehadiran.
- `slip_gaji`: catatan penggajian mingguan.
- `kasbon_karyawan`: pinjaman/kasbon karyawan.

## Relasi Krusial
- `transaksi_penjualan_bengkel.mobil_id` menghubungkan pekerjaan bengkel ke mobil stok untuk internal repair unit Jual Beli Mobil.
- `transaksi_penjualan_bengkel.armada_id` dan `muatan_id` menghubungkan pekerjaan bengkel ke unit Jasa Angkut.
- `piutang_usaha.referensi_id` dan `hutang_usaha.referensi_id` menghubungkan dokumen keuangan dengan transaksi sumbernya.
- `piutang_usaha.is_internal` dan `hutang_usaha.is_internal` menandai transaksi antar-unit agar laporan konsolidasi bisa mengeliminasi profit semu dengan benar.
- `kasbon_karyawan` dihubungkan ke piutang melalui referensi pada `piutang_usaha`, bukan lewat foreign key langsung di model `KasbonKaryawan`.

## Catatan
- Jika membuat query SQL atau migrasi, gunakan nama tabel aktual di atas, bukan nama generik seperti `piutang`, `hutang`, atau `transaksi_bengkel`.
