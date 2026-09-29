---
tags: [tpm, session]
date: 2026-09-28
time: "20:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/kas_bank_service.py, backend/heal_duplicate_kasbank_bengkel.py, backend/tests/test_financial_balance_audit.py, backend/tests/test_kasbank_duplicate_guard.py, frontend/app/_layout.tsx, frontend/utils/api.ts]
---

Format: Markdown | Status: DONE | Scope: Backend & Frontend Fixes

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Rekonsiliasi Kas Tunai Pusat & Bank ke target Rp6.011.500 / Rp811.321.376 setelah bug double-input sync bengkel 2026-09-26 19:46:48.

## Diagnosis

**Bug:** Operasi sync pembayaran piutang bengkel meng-insert **ulang** 37 baris `KasBank` (id 426-463, kecuali 449) yang sudah tercatat sebelumnya — di kedua jenis kas (KAS_UTAMA & BANK_UTAMA), sekaligus mem-backdate tanggal (created_at - tanggal = 2..11 hari).

Bukti:
- 37 baris identik (sumber+tipe+nominal+tanggal) dengan pasangan di blok lama (id < 426)
- `created_at` semua 2026-09-26 19:46:48
- Tanggal transaksi 09-15 s/d 09-26

Dampak awal:
- Kas Tunai: 11.647.500 (target 6.011.500) → overshoot 5.636.000
- Kas Bank: 844.059.876 (target 811.321.376) → overshoot 32.738.500
- Neraca tetap Aktiva = Pasiva (overshoot saling menutupi oleh double-input)

## Perbaikan

### 1. Reversal (heal_duplicate_kasbank_bengkel.py)
Jurnal balik untuk 37 baris duplikat, bukan delete fisik (invarian #3 CLAUDE.md):
- `tanggal=2026-09-28` (tidak mengubah tanggal asli)
- menggunakan `KasBankService.create()` dengan `allow_negative=True`
- marker `[VOID] HEAL-DUP-BGL260926`

### 2. Guard anti-duplikat (kas_bank_service.py)
- Cek `(jenis, tipe, sumber, nominal, tanggal)` sebelum insert
- Tolak HTTP 409 bila identik sudah ada
- Kecualikan baris `[VOID]` (reversal sengaja identik)

### 3. Test
- `test_kasbank_duplicate_guard.py` - duplikat ditolak (409), reversal diizinkan
- `test_financial_balance_audit.py` - rebaseline target ke 29 Sep

### 4. Frontend
- Fix merge markers di `_layout.tsx` & `api.ts`

## Verification

- `pytest`: 8/8 PASSED (4 test files)
- `npx tsc --noEmit`: PASSED
- Kas Tunai: Rp6.011.500 ✅
- Kas Bank: Rp811.321.376 ✅
- Neraca: Aktiva = Pasiva, selisih = 0 ✅

## Cara deploy ke server

```bash
# 1. Pull code
cd /path/to/tpm && git pull origin main

# 2. Apply migration (if any)
cd backend && alembic upgrade head

# 3. Jalankan healing script di server (WAJIB!)
cd backend && python heal_duplicate_kasbank_bengkel.py --apply

# 4. Restart service
#    Docker: docker compose restart backend
#    Manual: restart uvicorn process

# 5. Verifikasi
curl -s http://localhost:8000/api/v1/laporan/neraca?tanggal=2026-09-29 | python -m json.tool
# Cek: aktiva_lancar.kas_tunai = 6011500
# Cek: aktiva_lancar.kas_bank = 811321376.01
# Cek: selisih = 0, is_balanced = true
```
