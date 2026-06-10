# Internal Transactions & Unit Sync

Dokumen ini menjelaskan sinkronisasi transaksi antar-unit, terutama pekerjaan Bengkel untuk unit Jual Beli Mobil dan Jasa Angkut.

## 1. Jenis Internal Transaction Saat Ini

### A. Internal Repair Mobil Stok
Terjadi saat Bengkel mengerjakan mobil milik unit Jual Beli Mobil.

Penanda utama di kode:
- `transaksi_penjualan_bengkel.kategori = "jual_beli_mobil"`
- `transaksi_penjualan_bengkel.mobil_id` terisi
- `PiutangUsaha.is_internal = True`
- `HutangUsaha.is_internal = True`

### B. Internal Repair Jasa Angkut
Terjadi saat Bengkel mengerjakan armada atau muatan unit Jasa Angkut.

Penanda utama di kode:
- `transaksi_penjualan_bengkel.kategori = "jasa_angkut"`
- transaksi terkait dapat membawa `armada_id` dan/atau `muatan_id`

## 2. Alur Internal Repair Mobil
1. Bengkel membuat transaksi dengan kategori `jual_beli_mobil` dan `mobil_id`.
2. Sistem mencatat:
   - pendapatan internal dari sisi Bengkel,
   - `PiutangUsaha` internal untuk Bengkel,
   - `HutangUsaha` internal untuk unit Mobil.
3. Detail part/service dicatat ke `mobil_part_service` agar biaya repair ikut menambah nilai ekonomis mobil.
4. Selama mobil belum terjual, pendapatan internal yang belum terealisasi dieliminasi dari laba konsolidasi melalui `internal_elimination`.
5. Saat mobil terjual dan sudah memenuhi syarat settlement, kewajiban internal diselesaikan oleh `penjualan_mobil_service.py`.

## 3. Kapitalisasi dan HPP
- Dari perspektif unit Mobil, biaya repair internal bukan beban periode berjalan biasa; biaya tersebut menambah nilai mobil.
- Kode membedakan:
  - `HPP accounting`: dipakai untuk pencatatan laba transaksi mobil.
  - `real modal`: mencakup biaya internal repair juga, dan dipakai untuk perhitungan pembagian investor.
- Karena itu, membaca satu angka HPP saja tidak selalu cukup untuk menjelaskan laba unit Mobil dan laba investor.

## 4. Eliminasi Konsolidasi
Untuk mencegah profit semu:
- laba bengkel dari repair internal mobil yang belum terjual dihitung sebagai `internal_elimination`,
- eliminasi ini ikut memengaruhi laporan laba rugi, perubahan modal, dan neraca,
- saat mobil sudah terjual, eliminasi dilepas karena nilai sudah benar-benar terealisasi melalui penjualan eksternal.

## 5. Settlement dan Reversal
- Settlement internal mobil tidak boleh diasumsikan selesai hanya karena transaksi bengkel dibuat.
- `penjualan_mobil_service.py` menangani penyelesaian internal saat mobil dijual/lunas.
- Jika penjualan mobil dibatalkan, service ini juga membatalkan piutang/hutang internal dan membalikkan entry terkait agar stok dan laporan kembali konsisten.

## 6. File Terkait
- `backend/app/services/transaksi_bengkel_service.py`
  - pembuatan transaksi internal, piutang/hutang internal, dan detail kapitalisasi.
- `backend/app/services/penjualan_mobil_service.py`
  - settlement, pembatalan, dan penyesuaian internal saat siklus penjualan mobil berubah.
- `backend/app/services/kas_bank_integration.py`
  - routing entry ledger otomatis saat memang ada arus kas/bookkeeping movement.
- `backend/app/services/reports/base.py`
  - perhitungan `internal_elimination`.
- `backend/app/services/reports/neraca_service.py`
  - rekonsiliasi internal asset/liability dan dampaknya ke neraca.

## 7. Hal yang Harus Diperhatikan Saat Mengubah Kode
- Jika mengubah transaksi bengkel internal, pastikan:
  - `kategori`,
  - `mobil_id` / `armada_id`,
  - `is_internal`,
  - dan pasangan piutang/hutang
  tetap konsisten.
- Jangan menghapus `internal_elimination` hanya karena total laporan terlihat lebih sederhana; itu akan membuat laba konsolidasi terlalu tinggi untuk mobil yang belum terjual.
- Saat debugging kasus internal mobil, jangan berhenti di `transaksi_bengkel_service.py`; periksa juga efek lanjutannya di `penjualan_mobil_service.py` dan report services.
