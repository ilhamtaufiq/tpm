---
tags: [tpm, session]
date: 2026-09-28
time: "18:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/reports/modal_service.py, backend/app/services/reports/neraca_service.py, backend/app/services/mobil_service.py, backend/app/services/spare_part_service.py, backend/app/services/absensi_service.py, frontend/app/sdm/absensi.tsx, frontend/services/sdm.ts, heal_missing_kasbank.py]
---

Format: Markdown | Status: DONE | Scope: Backend & Frontend Fixes

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Rekonsiliasi total Neraca, Laba Ditahan, Modal Awal per 12 Sept 2026, Stok JB Mobil & Sparepart, serta penanganan timezone Asia/Jakarta pada modul Absensi.

## Perubahan yang Dilakukan

1. **Absensi Shift Date (+1 Hari)**:
   - `frontend/app/sdm/absensi.tsx` & `frontend/services/sdm.ts`: Mengganti `toISOString()` (UTC) dengan penanganan tanggal lokal `Asia/Jakarta`.
   - `backend/app/services/absensi_service.py`: Mengganti `datetime.now()` dengan `get_jakarta_now()`.

2. **Keuangan & Neraca**:
   - `backend/app/services/reports/modal_service.py`: Menetapkan Modal Awal = Rp2.242.611.225 (include rugi pra-saldo-awal, memisahkan double-counting).
   - Kas & Bank Ledger: Purge baris duplikat. Target Kas Tunai Pusat = Rp6.011.500, Kas di Bank = Rp811.321.376.
   - `backend/app/services/reports/neraca_service.py`: Total Aktiva = Pasiva (Rp2.792.948.100,51), `selisih = 0`.

3. **Stok Mobil & Spare Part**:
   - `backend/app/services/mobil_service.py`: Sinkronisasi nilai stok JB Mobil menu & neraca = Rp1.705.796.850.
   - `backend/app/services/spare_part_service.py`: Nilai Stok Part = Rp130.565.157 (koreksi HPP double Rp4.785.000 + 1 pcs ThreeBond Rp25.000).

## Verification

- `pytest tests/test_absensi_tz.py tests/test_financial_balance_audit.py tests/test_stock_mobil_part_audit.py`: 5/5 PASSED.
- `npx tsc --noEmit`: PASSED.
