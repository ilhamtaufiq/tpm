---
tags: [tpm, modul, mobil]
---

# TPM — Modul Jual Beli Mobil

⬅️ [[CLAUDE|Kembali ke Hub]]

## Fungsi Operasional

Pencatatan unit mobil masuk, kalkulasi biaya perbaikan/persiapan unit, manajemen investor modal patungan, status pemasaran (Stok/Booked/Terjual).

## Dampak Finansial

- Pengakuan Aset (Inventori Mobil).
- Kalkulasi Net Margin per Unit.
- Pembagian profit otomatis ke investor.
- Tracking piutang pembeli.

## Alur Logika

1. **Capitalization**: mobil dibeli → diklasifikasikan sebagai persediaan/aset lancar. Harga beli = nilai buku awal.
2. **Upkeep (Biaya Persiapan)**: pengeluaran perbaikan/cuci/salon/sparepart untuk unit tersebut **otomatis dikapitalisasi** — menambah nilai buku aset (menaikkan harga pokok unit).
3. **Joint Venture (Konsorsium Investor)**: pencatatan porsi modal investor eksternal per unit mobil.
4. **Disposal (Penjualan)**: mobil terjual tunai/kredit. Sistem hitung:
   ```
   Margin Kotor = Harga Jual - (Harga Beli + Total Biaya Persiapan)
   ```
   Profit bersih dibagikan otomatis ke saldo kas masing-masing investor sesuai persentase kepemilikan modal.

⬅️ [[CLAUDE|Kembali ke Hub]]
