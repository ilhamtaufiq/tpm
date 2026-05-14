# Internal Transactions & Unit Sync

Dokumen ini menjelaskan bagaimana sistem menangani transaksi antar unit (terutama antara Bengkel dan Jual Beli Mobil).

## 1. Skenario Utama: Repair Mobil Stok
Saat unit Jual Beli Mobil membeli mobil bekas, mobil tersebut seringkali perlu diperbaiki di Bengkel sendiri sebelum dijual.

### Alur Data:
1. **Transaksi Bengkel**: Dibuat dengan tipe `INTERNAL` dan ditargetkan ke `armada_id` atau `mobil_id` tertentu.
2. **Double Entry Otomatis**:
   - **Unit Bengkel**: Mencatat Pendapatan (Revenue) internal.
   - **Unit Mobil**: Mencatat Penambahan Nilai Stok (Capitalized Cost).
3. **Piutang/Hutang Internal**: Sistem mencatat saldo Hutang unit Mobil ke unit Bengkel.

## 2. Mekanisme Kapitalisasi (HPP)
Biaya repair internal tidak dianggap sebagai "Beban" (Expense) pada periode tersebut bagi perusahaan secara keseluruhan, melainkan **menambah harga pokok (HPP)** mobil tersebut.
- **Neraca**: Nilai Stok Mobil naik.
- **Laba Rugi**: Belum ada laba/rugi yang diakui sampai mobil tersebut laku.

## 3. Proses Eliminasi (Consolidation)
Agar laba perusahaan tidak "meledak" secara semu (karena bengkel merasa untung padahal uangnya masih di dalam aset mobil sendiri), sistem melakukan **Eliminasi**:
- Saat menghitung Laba Bersih Konsolidasi, pendapatan dari repair internal pada mobil yang **BELUM TERJUAL** dikurangi dari total laba.
- Saat mobil **TERJUAL**, eliminasi dilepas, dan laba bengkel tersebut akhirnya diakui secara riil.

## 4. File Terkait:
- `backend/app/services/kas_bank_integration.py`: Menangani pembuatan entry kas/bank otomatis untuk transaksi internal.
- `backend/app/services/reports/base.py`: Menangani perhitungan `internal_elimination`.
- `backend/app/services/mobil_service.py`: Menangani penambahan nilai repair ke harga stok mobil.

## 5. Hal yang Harus Diperhatikan AI:
- Jika mengedit `transaksi_bengkel_service.py`, pastikan bendera `is_internal` dikirim dengan benar ke integrasi keuangan.
- Jangan pernah menghapus logika eliminasi di `base.py` tanpa memahami dampaknya pada sinkronisasi 3 laporan.
