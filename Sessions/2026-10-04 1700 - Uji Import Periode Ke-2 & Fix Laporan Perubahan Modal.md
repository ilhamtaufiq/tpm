---
tags: [tpm, session]
date: 2026-10-04
time: "17:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/spare_part_service.py, backend/app/services/reports/modal_service.py, backend/app/services/data_import_service.py, backend/app/api/v1/laporan.py, frontend/app/laporan/perubahan-modal.tsx, frontend/utils/reportTemplates.ts, frontend/types/reports.ts, dashboard/src/pages/Reports.tsx, dashboard/src/types/reports.ts, backend/tests/test_modal_setoran_dan_anchor.py]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Uji `TPM_IMPORT_TEMPLATE_REAL_PERIODE_BERJALAN_KE-2.xlsx` lewat Settings > Data Import (DB kosong), lalu cek Neraca, Laba Rugi, Perubahan Modal.

## Constraints/Assumptions

- DB lokal MariaDB kosong + `alembic upgrade head`; saldo awal 2026-10-04.
- Skenario transaksi setelah import: jual bengkel 260rb (HPP 117rb), beli part tunai 302,5rb, listrik 500rb, prive 1jt, jual mobil TPM 50jt (HB 43,265jt), jual mobil investor 160jt (HB 145,7jt), bayar hutang import 5jt, terima piutang import 6jt, setoran modal 10jt.

## Keputusan

- Neraca & Laba Rugi sudah sesuai hitungan manual (laba operasional 20.677.500; modal 10 Okt 2.284.117.968,92).
- Fix: heal stok part by-ID (cek nama + one-shot), Modal Awal override hanya anchor 2026-09-12 (v5), filter setoran null-safe, setoran/prive per periode + `mutasi_modal_sebelumnya`, import mobil isi `harga_beli_awal`, `/validate` bandingkan `laba_operasional`.
- Persentase investor TIDAK ditambah ke template — diisi manual setelah import (keputusan user).
- Aturan dicatat di [[TPM - Aturan Bisnis & Invariant]] § Invariant Laporan & Import Saldo Awal.

## Status (Done / Now / Next)

- **Done**: setelah fix, Perubahan Modal: Modal Awal 2.254.440.468,92, setoran 10jt, penyesuaian backdate 0, non-kas 0, prive per periode = Laba Rugi; `/validate` SYNCED. `tsc` frontend & dashboard bersih; pytest tanpa regresi (5 gagal sama dengan baseline, bergantung data produksi).
- **Now**: -
- **Next**: setelah deploy, buka Perubahan Modal produksi — baris setoran modal kini muncul dan baris penyesuaian backdate mengecil sebesar setoran manual.

## Lanjutan: reset + import + 22 langkah transaksi

- Reset via `/system/reset-database` → import xlsx (tanggal digeser ke 2026-10-01) → 22 langkah: jual mobil investor (40%) + pencairan, booking DP + pelunasan, biaya persiapan, servis internal JB Mobil, beli part kredit + bayar, jual bengkel tunai/piutang + pelunasan, kasbon, gaji, transfer, aset, beli mobil, jasa angkut, setoran, prive, cicilan ganda hutang/piutang.
- Tiap langkah dicek: Δlaba = hitungan manual, Δmodal Neraca = Δlaba − Δprive + Δsetoran, backdate 0, LR = Perubahan Modal, `/validate` SYNCED.
- Bug ditemukan & diperbaiki: guard duplikat KasBank menolak pelunasan booking di hari yang sama (409); `/validate` MISMATCH hutang palsu saat ada booking.
- Temuan desain (belum diubah): daftar aset di Master Data tidak mencatat kas keluar.

## Lanjutan: piutang internal & tes

- Bug: edit transaksi bengkel internal tidak menyinkronkan piutang/hutang internal (kasus produksi BGL2609230004: grand_total 2.083.000, piutang internal 68.000). Diperbaiki + assert di `test_bengkel_void_and_edit_balance`.
- Tes snapshot produksi (financial_balance_audit, stock_mobil_part_audit, laporan_aliran) ditulis ulang jadi invariant; `test_muatan_date_sync` diperbaiki (filter kas hanya lulus bila id muatan == id pembayaran).
- Hasil pytest: DB kosong 54 lulus/8 skip, xlsx asli 60/2 skip, xlsx + 24 langkah transaksi 62/0, dump produksi 61/1 skip — 0 gagal.

## Open Questions

- Form aset: tambahkan pilihan sumber dana (kas/bank keluar atau setoran non-kas)?

## Working Set (file yang disentuh)

- lihat `files` di frontmatter
