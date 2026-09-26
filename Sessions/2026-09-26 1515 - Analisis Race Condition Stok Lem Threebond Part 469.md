---
tags: [tpm, session]
date: 2026-09-26
time: "15:15"
module: bengkel
status: done
agent: claude-code
files: [backend/app/services/transaksi_bengkel_service.py, backend/alembic/versions/20260923_120000_add_qty_correction_to_revaluation.py]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Analisis penyebab selisih stok 1 pcs pada sparepart LEM THREEBOND (Part ID 469) akibat race condition pada transaksi bengkel.

## Constraints/Assumptions

- Pengurangan stok sparepart pada transaksi bengkel bersifat real-time.
- Tanpa row lock (`FOR UPDATE`), request eksekusi bersamaan membaca nilai stok lama secara simultan.

## Keputusan

### 1. Kronologi Kejadian (Race Condition)
- **Kondisi Awal**: Stok awal Lem Threebond di database tercatat **8 pcs** (Snapshot SP_A/SP_B).
- **Penggunaan Transaksi**:
  1. **Trx ID 9** (14 Sep 2026): Pakai **1 pcs** (Customer: Berkah Pasir, Plat: A 9334 QC).
  2. **Trx ID 44** (22 Sep 2026): Pakai **1 pcs** (Customer: Pak Kato, Plat: Z 8702 DM).
  3. **Trx ID 58** (24 Sep 2026): Pakai **1 pcs** (Customer: BML, Plat: F 8318 WU).

### 2. Root Cause
- Sebelum commit `ec74a123`, `TransaksiBengkelService` membaca stok tanpa row lock (`SELECT ... FOR UPDATE`).
- Dua request HTTP/API paralel membaca stok `8.00` bersamaan:
  - Request A: baca `8` → tulis `8 - 1 = 7`.
  - Request B: baca `8` → tulis `8 - 1 = 7`.
- Hasilnya: Kedua transaksi tersimpan, tetapi stok DB hanya berkurang 1 pcs (`8 → 7`) padahal barang fisik terpakai 2 pcs.

### 3. Solusi & Koreksi yang Telah Diterapkan
- **Backend Lock Fix (Commit `ec74a123`)**: Menambahkan `.with_for_update()` pada `TransaksiBengkelService` (`_validate_spare_parts`, update, void) agar pembacaan & pengurangan stok terproteksi row lock.
- **Koreksi Data DB (Commit `e87ff6f1` / Migrasi `20260923_120000`)**:
  - Stok dikoreksi langsung $7 \rightarrow 6$ pcs (dan per 24 Sep terpakai 1 pcs di Trx 58 sehingga saat ini posisi **5 pcs**).
  - Dimasukkan catatan *Qty Correction* (`amount = -25.000`, `is_qty_correction = 1`) di `spare_part_revaluation` agar Laporan Perubahan Modal dan Neraca tetap *balance*.

### 4. Ringkasan untuk Owner (Penjelasan Kejadian Operasional)
- **Gejala yang Ditemui Owner**: Stok fisik Lem Threebond di bengkel riilnya sudah terpakai 2 tube/pcs (Trx #9 & Trx #44), namun di sistem tercatat masih 7 pcs (kurang 1 pcs pemotongan). Akibatnya persediaan sparepart di Neraca membengkak Rp25.000 ($1\text{ pcs} \times \text{Rp}25.000$) dan memicu selisih -Rp25.000 pada Laporan Perubahan Modal.
- **Penyebab Singkat**: Terjadi bentrokan request simultan (*race condition*) saat simpan/update transaksi bengkel, di mana sistem membaca stok awal `8` dua kali sebelum sempat mengurangi nilai stok ke database.
- **Status & Kepastian untuk Owner**:
  1. **Stok Fisik & Sistem Sudah Cocok**: Data stok DB telah dikoreksi langsung menjadi 6 pcs (saat ini **5 pcs** setelah penggunaan Trx #58 pada 24 Sep).
  2. **Keamanan Transaksi Masa Depan**: Backend telah dipasang pengunci otomatis (`row-level lock / FOR UPDATE`), sehingga input transaksi bersamaan di dua device/layar tidak akan memicu stok meleset lagi.
  3. **Laporan Keuangan Balans**: Angka Neraca & Laporan Perubahan Modal telah disesuaikan dan 100% *balance* (selisih Rp0).

## Status (Done / Now / Next)

- **Done**: Analisis transaksi #9, #44, #58 dan penyusunan laporan sesi race condition part 469.
- **Now**: Selesai.
- **Next**: Siap untuk tugas pengembangan berikutnya.

## Open Questions

- None

## Working Set (file yang disentuh)

- `backend/app/services/transaksi_bengkel_service.py`
- `backend/alembic/versions/20260923_120000_add_qty_correction_to_revaluation.py`
- `Sessions/2026-09-26 1515 - Analisis Race Condition Stok Lem Threebond Part 469.md`
- `TPM - Log Pengembangan.md`
