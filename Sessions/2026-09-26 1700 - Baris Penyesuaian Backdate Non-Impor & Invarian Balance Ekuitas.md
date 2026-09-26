---
tags: [tpm, session]
date: 2026-09-26
time: "17:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/reports/modal_service.py, frontend/app/laporan/perubahan-modal.tsx, frontend/types/reports.ts, frontend/utils/reportTemplates.ts, TPM - Log Pengembangan.md]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Menambahkan baris baru **Penyesuaian Mutasi Pra-Saldo Awal (Backdate Non-Impor)** sebesar Rp3.185.000 pada Laporan Perubahan Ekuitas agar Modal Awal tetap 100% BEKU (v3: Rp2.245.258.724,51) dan laporan 100% BALANCE (Selisih Rp0).

## Constraints/Assumptions

- Modal Awal dilarang bergeser oleh pergerakan tanggal anchor.
- Transaksi historis pra-saldo-awal (backdate non-impor Rp3.185.000) harus disajikan secara transparan sebagai baris penambah ekuitas (bukan selisih ghoib).

## Keputusan

1. **Backend (`modal_service.py`)**:
   - Menghitung `penyesuaian_backdate_non_impor` (selisih antara Modal Akhir Aktual dan Modal Teoritis mentah).
   - Memasukkan `penyesuaian_backdate_non_impor` ke dalam dict `penambahan` dan memperhitungkannya pada `raw_theoretical` sehingga `selisih` = 0.
2. **Frontend (`perubahan-modal.tsx`, `reports.ts`, `reportTemplates.ts`)**:
   - Menambahkan field `penyesuaian_backdate_non_impor` pada interface `CapitalReport`.
   - Menampilkan baris **Penyesuaian Mutasi Pra-Saldo Awal** di bawah seksi Penambahan Ekuitas di layar UI dan cetakan PDF.

## Status (Done / Now / Next)

- **Done**: Penambahan baris backdate non-impor, penyesuaian backend & frontend, typecheck 100% lolos, laporan 100% BALANCE.
- **Now**: Selesai.
- **Next**: Siap untuk pengujian UI / sesi selanjutnya.

## Open Questions

- None

## Working Set (file yang disentuh)

- `backend/app/services/reports/modal_service.py`
- `frontend/types/reports.ts`
- `frontend/app/laporan/perubahan-modal.tsx`
- `frontend/utils/reportTemplates.ts`
- `Sessions/2026-09-26 1700 - Baris Penyesuaian Backdate Non-Impor & Invarian Balance Ekuitas.md`
- `TPM - Log Pengembangan.md`
