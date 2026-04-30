# Continuity Ledger - Perubahan Modal Reconciliation

## Goal
Resolve financial reporting discrepancies in "Perubahan Modal" report, specifically regarding internal workshop repairs for car trading units. 
Success criteria:
- Consolidated Net Income correctly reflects 0 profit for internal transfers.
- "Penambahan Modal" and "Pengurangan Modal" totals are mathematically consistent with displayed rows.
- Internal eliminations are explicitly shown to the user.
- Status remains "VERIFIED BALANCE".

## Constraints/Assumptions
- Internal repairs (category 'jual_beli_mobil') are capitalized into car stock value.
- Equity increases when internal labor/parts are added to an asset (Profit in Bengkel) but should be eliminated at consolidation level if unrealized (car not sold).
- CURRENT APPROACH: Fully eliminate internal revenue from profit until the car is sold.

## Key Decisions
- **BaseReportService**: Subtract `internal_elimination` from `retained_earnings`.
- **ModalService**: Add `internal_elimination` as a row in both Penambahan and Pengurangan sections.
- **ModalService**: Fix double counting where capitalized repairs were added to both Stock Growth and Non-Cash Capital.

## State
- **Done**: 
  - Initial audit of `BaseReportService`, `ModalService`, and `perubahan-modal.tsx`.
  - Fixed `BaseReportService.py` profit and piutang logic (elimination and overhead).
  - Fixed `ModalService.py` double-counting and structure (elimination rows).
  - Updated `perubahan-modal.tsx` UI and PDF export for transparency.
- **Now**: Final validation.
- **Next**: Final handoff to user.

## Open Questions (UNCONFIRMED)
- None at the moment.

## Working Set
- backend/app/services/reports/base.py
- backend/app/services/reports/modal_service.py
- frontend/app/laporan/perubahan-modal.tsx
