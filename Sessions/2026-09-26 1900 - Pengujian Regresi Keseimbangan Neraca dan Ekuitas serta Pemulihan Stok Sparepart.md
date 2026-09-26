---
tags: [tpm, session, testing, pytest, balance, neraca, ekuitas, sparepart-stok]
date: 2026-09-26
time: "19:00"
module: testing
status: done
agent: claude
files: [backend/tests/test_bengkel_void_and_edit_balance.py]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Membuat pengujian regresi backend (`pytest`) untuk memverifikasi bahwa fitur Void dan Edit Item transaksi bengkel pada modul Mobil dan Armada Jasa Angkut menjaga laporan keuangan (Neraca & Perubahan Modal) tetap 100% balance, serta mengonfirmasi mekanisme pemulihan stok sparepart.

## Constraints/Assumptions

- `NeracaService.get_report()` wajib menghasilkan `is_balanced == True` dan `selisih < 100` sebelum dan sesudah aksi void/edit.
- `ModalService.get_report()` wajib menghasilkan `is_balanced == True` dan `selisih < 100` sebelum dan sesudah aksi void/edit.
- Pemulihan stok sparepart pada `void_transaction` dan `update` memakai penguncian baris `with_for_update()` untuk mencegah race condition.

## Keputusan

- Membuat skrip tes `backend/tests/test_bengkel_void_and_edit_balance.py` dengan 2 kasus uji:
  1. `test_kasus_1_bengkel_mobil_edit_dan_void_balance`: Create, Edit Item, dan Void nota bengkel unit mobil + verifikasi keseimbangan Neraca & Ekuitas.
  2. `test_kasus_2_bengkel_jasa_angkut_edit_dan_void_balance`: Create, Edit Item, dan Void nota perbaikan armada Jasa Angkut + verifikasi keseimbangan Neraca & Ekuitas.
- Mengonfirmasi mekanika pemulihan stok (`sp.stok += detail.qty`) di `transaksi_bengkel_service.py`.

## Status (Done / Now / Next)

- **Done**:
  - File tes `backend/tests/test_bengkel_void_and_edit_balance.py` dibuat dan 2/2 tes passed.
  - Penjelasan mekanisme pengembalian stok sparepart disampaikan ke pengguna.
  - Commit & push ke branch `main`.
- **Now**: Selesai.
- **Next**: Await feedback dari user.

## Open Questions

- None.
