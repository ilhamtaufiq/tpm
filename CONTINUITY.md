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
- **Workshop Settlement**: Automated internal workshop debt clearance upon car sale. Payments now follow the sale's method (Transfer -> Bank Utama, Cash -> Unit Wallet), allowing the unit wallet to go negative temporarily to carry repair costs.

## State
- **Done**: 
  - Comprehensive refactoring of `perubahan-modal.tsx` UI and PDF export.
  - Implemented `calculateSimplifiedTotals` to bridge granular backend data to standard accounting rows.
  - Decoupled asset transformation movements from the equity statement.
  - Updated PDF template for a more executive look.
  - Implemented client-side balance validation in `MobilForm.tsx`.
  - Eliminated negative "Piutang Lainnya" artifact in Neraca.
  - **Fixed**: Missing "Piutang Sparepart Mobil" in Neraca. Corrected filters to use `PiutangSource` instead of `unit`.
  - **Balanced**: Restored full "Stok Mobil" value in Neraca. Removing repair costs from stock caused a discrepancy against Equity (Laba). Now accurately shows internal debt vs internal receivable while maintaining asset valuation.
- **Diagnostics**: Added a "Trace" panel in Neraca to identify specific internal transactions with mismatched balances (e.g., Workshop invoice with no corresponding Unit debt).
- **Now**: Verifying financial reporting consistency across modules.
- **Next**: Monitor unit wallet balances and transaction logs for edge cases in split payments.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- backend/app/services/reports/base.py
- backend/app/services/reports/modal_service.py
- frontend/app/laporan/perubahan-modal.tsx
