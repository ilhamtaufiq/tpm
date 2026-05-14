# Continuity Ledger

## Goal
- Resolve financial reporting discrepancies (specifically a 200k imbalance in the Balance Sheet).
- Ensure backend and frontend data are synchronized and using correct accounting principles.

## Constraints/Assumptions
- The backend is the single source of truth for all financial totals.
- Non-cash transactions (like salary deductions for kasbon) should not generate entries in the cashbook (KasBank).

## Key decisions
- **Backend Fix**: Modified `KasbonService` in `backend/app/services/kasbon_service.py` to stop creating `KasBank` MASUK entries for `POTONG_GAJI` (salary deductions). These are non-cash movements.
- **Database Cleanup**: Manually deleted incorrect `POTONG_GAJI` entries from the `kas_bank` table to restore the correct cash balance.
- **Frontend Fix**: Completely removed `transitAdj` (artificial balancing logic) from `neraca.tsx` and ensured the UI uses backend-provided `total_aktiva` and `total_pasiva`.
- **Identity Fix**: The Balance Sheet now correctly uses `Total Assets = Total Equity + Total Debt`.

## State
- **Done**: 
  - Identified the cause of the 200k discrepancy: A salary slip with 400k gross salary and 200k deduction was recording 0 net cash change instead of -200k.
  - Fixed `KasbonService` to prevent future occurrences.
  - Cleaned up the `kas_bank` table (deleted ID 1570).
  - Synchronized Neraca UI with backend totals.
  - Resolved TypeScript errors in reporting modules.
- **Now**: Verified the cash balance and equity are now perfectly aligned (9.6M each in the current test scenario).
- **Next**: Final verification by the user to confirm the "TERDAPAT SELISIH" message is gone.

## Open questions (UNCONFIRMED)
- None.

## Working set
- `backend/app/services/kasbon_service.py`
- `backend/app/services/reports/base.py`
- `frontend/app/laporan/neraca.tsx`
- `frontend/app/laporan/perubahan-modal.tsx`
- `frontend/types/reports.ts`
