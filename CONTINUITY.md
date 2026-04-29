# Continuity Ledger - TPM Equity Reconciliation

## Goal
Resolve persistent reconciliation variance in "Perubahan Modal" report, specifically handling debt-funded assets, capitalized costs, and booking scenarios (DP/Receivables). Ensure operational transparency for all business units.

## Constraints/Assumptions
- Manual debt settlement is preferred (no auto-lunas on sale).
- Net Asset Value (Actual) must equal Theoretical Modal (Waterfall).
- Inventory values include capitalized preparation and repair costs.
- Booking DPs and Booking Receivables must be treated as liabilities until the sale is final (status TERJUAL).
- "Allow Negative Balance" is an administrative override for manual reconciliation.

## Key Decisions
- [x] Refactored `alokasi_stok_net` to include capitalized costs (prep/repairs).
- [x] Implemented `customer_dp` and `net_booking_piutang` as liabilities.
- [x] **New**: Implemented `allow_negative` (Force Transaction) toggle in Mutasi and Expenses to bypass strict balance validation.
- [x] **New**: Refined Jasa Angkut (JA) breakdown into Unit, Armada, Trip, and Repairs categories.
- [x] **New**: Integrated Piutang/Kasbon rotation (Penambahan & Alokasi Dana) into Perubahan Modal sections to track fund allocation.

## State
- **Done**: 
    - Stock neutralization logic for capitalized costs.
    - Booking/DP liability logic in `BaseReportService`.
    - Force transaction (allow_negative) backend & frontend implementation.
    - Detailed JA and Piutang breakdown in `ModalService` and UI.
- **Now**: System is balanced and provides granular visibility into unit-level operations and cash allocation.
- **Next**: Monitor for future reconciliation gaps during month-end closing.

## Open Questions
- None at the moment. Current logic covers all identified discrepancy sources and operational tracking needs.

## Working Set
- `backend/app/services/reports/modal_service.py`
- `backend/app/services/reports/base.py`
- `frontend/app/laporan/perubahan-modal.tsx`
- `frontend/app/finance/mutasi.tsx`
- `frontend/app/finance/expenses/index.tsx`
