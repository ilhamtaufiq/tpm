# Continuity Ledger

## Goal
- Modify Balance Sheet (Neraca) report to remove internal transaction details that are already accounted for in unit profits.
- Specifically, remove "Hutang Perbaikan Stok Mobil (Internal)" and related internal balances.

## Constraints/Assumptions
- Internal repairs at the workshop unit are recognized as profit by that unit and added to the car's inventory value.
- On a consolidated basis, these internal debts/receivables should be eliminated.

## Key decisions
- Removed "Hutang Perbaikan Stok Mobil (Internal)" fallback row from the Hutang section.
- Removed unit-specific internal debt detail rows from `report.cross_validation.mismatches`.
- Removed unit-specific internal receivable detail rows ("Tagihan Perbaikan") from the Aktiva section for consistency.

## State
- **Done**: 
  - Identified target rows in `frontend/app/laporan/neraca.tsx`.
  - Removed internal debt and receivable detail rows from Balance Sheet (specifically for Bengkel).
  - Implemented `totalHutangExternal`, `totalPiutangExternal`, and adjusted `totalAktivaAdj`/`totalPasivaAdj` using `useMemo`.
  - Updated all display components in Neraca to use these consolidated values.
  - Implemented **Auto-Settlement Simulation** in Neraca for **Bengkel** unit upon car sale.
  - Implemented **Virtual Elimination** in `frontend/app/finance/hutang.tsx` and `frontend/app/finance/piutang.tsx`: Internal transactions to **Bengkel** for **sold units** are automatically hidden.
  - **Reverted Jasa Angkut (JA) logic**: Based on user feedback, JA is no longer subject to virtual elimination/auto-settlement and returns to original manual tracking.
- **Now**: Completed the request for automatic internal debt/receivable removal upon sale.
- **Next**: Final verification with user.

## Open questions (UNCONFIRMED)
- None at the moment.

## Working set
- `frontend/app/laporan/neraca.tsx`
- `frontend/app/finance/hutang.tsx`
- `frontend/app/finance/piutang.tsx`
