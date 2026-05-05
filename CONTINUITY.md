# CONTINUITY LEDGER

## Goal
Fix the Rp.200.000 Neraca (Balance Sheet) discrepancy caused by 2 internal piutang records (PTG2605050001, PTG2605050002) without matching internal hutang records.

## Constraints/Assumptions
- TPM is an Expo React Native + FastAPI backend multi-unit business app
- Neraca follows A = L + E identity
- Internal piutang/hutang must be bilateral (both sides recorded)
- Sync button creates missing hutang from piutang records

## Key decisions
- Fixed `sync_internal_transactions()` to handle ALL internal piutang (not just those with nomor_referensi)
- Added multi-strategy hutang matching (nomor_referensi → referensi_id fallback)
- Derived hutang sumber/unit from piutang source instead of hardcoding JUAL_BELI_MOBIL
- Added sisa_piutang comparison alongside nominal for better sync accuracy
- Added status synchronization between piutang and hutang

## State
- Done: Fixed sync_internal_transactions in neraca_service.py
- Now: User needs to click "SINKRONKAN SEKARANG" button to auto-create the 2 missing hutang records
- Next: Verify neraca is balanced after sync

## Open questions
- CONFIRMED: The 2 PTG records are internal piutang with sisa > 0 and no matching hutang

## Working set
- `backend/app/services/reports/neraca_service.py` (sync function fixed)
- `backend/app/services/reports/base.py` (read-only, balance logic)
- `frontend/app/laporan/neraca.tsx` (UI, no changes needed)
