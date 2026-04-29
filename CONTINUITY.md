# Continuity Ledger - TPM Equity Reconciliation

## Goal
Resolve persistent reconciliation variance in "Perubahan Modal" report, specifically handling debt-funded assets, capitalized costs, and booking scenarios (DP/Receivables).

## Constraints/Assumptions
- Manual debt settlement is preferred (no auto-lunas on sale).
- Net Asset Value (Actual) must equal Theoretical Modal (Waterfall).
- Inventory values include capitalized preparation and repair costs.
- Booking DPs and Booking Receivables must be treated as liabilities until the sale is final (status TERJUAL).

## Key Decisions
- [x] Refactored `alokasi_stok_net` to include capitalized costs (prep/repairs) to neutralize stock value increases.
- [x] Implemented `customer_dp` (Uang Muka Penjualan) as a liability for unsold/booked units.
- [x] Implemented `net_booking_piutang` (Piutang Belum Realisasi) as a liability for booked units to neutralize unearned receivables.
- [x] Updated Frontend to display these new liability categories for transparency.

## State
- **Done**: 
    - Stock neutralization logic for capitalized costs.
    - Booking/DP liability logic in `BaseReportService`.
    - UI synchronization for new liability keys.
- **Now**: Verifying balance state with the user.
- **Next**: Final audit of `Neraca` synchronization if "Selisih" appears there.

## Open Questions
- None at the moment. Current logic should cover all identified discrepancy sources.

## Working Set
- `backend/app/services/reports/modal_service.py`
- `backend/app/services/reports/base.py`
- `frontend/app/laporan/perubahan-modal.tsx`
