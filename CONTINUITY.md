# Continuity Ledger - Perubahan Modal Reconciliation

## Goal
Simplify the "Perubahan Modal" report to align with standard accounting principles (Statement of Changes in Equity) while maintaining "VERIFIED BALANCE" status.

Success criteria:
- UI presents a clear Beginning Balance + Profit + Contributions - Drawings = Ending Balance.
- Asset-only movements (Cash -> Inventory) are moved to analytical breakdowns to avoid confusion in the equity statement.
- PDF export reflects the clean, professional accounting structure.
- Status remains "VERIFIED BALANCE".

## Constraints/Assumptions
- The backend `ModalService` provides granular data which the frontend now simplifies for presentation.
- Any discrepancy between theoretical equity and actual net assets is shown as "Penyesuaian Saldo".

## Key Decisions
- **Simplification**: Reduced `perubahan-modal.tsx` from ~1100 to ~500 lines.
- **Data Grouping**: Combined setoran tunai, non-kas, and funding into "Setoran Modal". Used `info.laba_bersih` as the primary profit figure.
- **Separation of Concerns**: Moved detailed Asset Snapshots and Unit Profitability to separate cards below the main equity table.

## State
- **Done**: 
  - Comprehensive refactoring of `perubahan-modal.tsx` UI and PDF export.
  - Implemented `calculateSimplifiedTotals` to bridge granular backend data to standard accounting rows.
  - Decoupled asset transformation movements from the equity statement.
  - Updated PDF template for a more executive look.
- **Now**: Finalizing documentation and handoff.
- **Next**: User feedback on the simplified reporting structure.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- backend/app/services/reports/base.py
- backend/app/services/reports/modal_service.py
- frontend/app/laporan/perubahan-modal.tsx
