# Continuity Ledger - TPM Workshop Project

## Goal
Fix financial reporting discrepancy where cash sparepart purchases are categorized as transfer in "Laporan Perubahan Modal" and ensure Mobil Detail modal works correctly on Android.

## Constraints/Assumptions
- Backend: FastAPI/Python
- Frontend: Expo/React Native/TypeScript
- Database: PostgreSQL (via SQLAlchemy)
- Payment methods: TUNAI (Cash) and TRANSFER (Bank)
- Cash Accounts: `KAS_UNIT_BENGKEL`, `KAS_UTAMA`, `KAS_UNIT_MOBIL`, `KAS_UNIT_JASA_ANGKUT`, `CASH`.

## Key Decisions
- [2026-04-16] Standardized `MobilDetail` modal to use `BottomSheetScrollView` and removed `Date.now()` cache-buster on media URLs to resolve Android rendering issues.
- [2026-04-16] Identified backend bug in `get_capital_report` and `get_neraca` where `method_filter == 'cash'` incorrectly only included `KasBankJenis.CASH`, excluding unit-specific and main cash accounts.

## State
- Done:
  - Investigated frontend purchase submission logic: Confirmed `metode: 'TUNAI'` and `kas_jenis: 'KAS_UNIT_BENGKEL'` are correctly sent.
  - Investigated backend `get_capital_report` and `get_neraca`: Located the hardcoded `KasBankJenis.CASH` check in `get_kas_sum` helper.
  - Applied fix to `get_kas_sum` in `backend/app/api/v1/dashboard.py` to include all cash-account types.
- Now:
  - Awaiting user verification for both report categorization and Android modal visibility.
- Next:
  - Close issue once verified.

## Open Questions
- None at the moment.

## Working Set
- `backend/app/api/v1/dashboard.py`
- `frontend/app/bengkel/purchase/index.tsx`
- `frontend/app/laporan/perubahan-modal.tsx`
