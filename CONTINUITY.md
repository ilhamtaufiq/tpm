# Continuity Ledger - 2026-04-19

## Goal
Fix financial report discrepancies in "Laporan Perubahan Modal", specifically focusing on the accurate partitioning of mobile unit costs (Prep vs repairs) and resolving reporting errors (KeyError, NameError).

## Constraints/Assumptions
- Mobile unit costs are split between wallet expenses (Ledger) and workshop internal transfers.
- Wallet expenses use categories: BIAYA_LAINNYA (Prep), BIAYA_OPERASIONAL (Repairs), BIAYA_UMUM (Overhead).
- Workshop internal transfers use categories: 'jual_beli_mobil', 'mobil', 'penjualan_mobil'.
- "Section A" (Profit) should use Gross Profit to prevent double-deduction of expenses already counted in "Section C".

## Key Decisions
- **Partitioning**: Used `PengeluaranBengkel` for wallet outflows and `TransaksiPenjualanBengkel` for workshop work.
- **Deduplication**: Avoided double-counting by clearly separating sources (Ledger vs Workshop) and categories.
- **Section A**: Updated to use Gross Profit (Pendapatan - Harga Beli) for Mobil unit, moving all operational costs (Prep/Repair) to Section C.

## State
### Done
- Fixed `KeyError: 'total_hpp'` by adding the key to unit breakdown in `BaseReportService`.
- Fixed `NameError` in `ModalService` for Section A return fields.
- Expanded workshop category filter in `PenjualanMobilService.get_summary` to include 'mobil' and 'penjualan_mobil'.
- Refactored `BaseReportService.get_unit_financial_breakdown` to properly partition Ledger costs from Workshop costs.
- Verified fix with debug script: "Biaya Manajemen Unit (Prep)" and "Bengkel Unit Bisnis Mobil" now show 100k each (total 200k) matching the user's data.

### Now
- Task completed and verified.

### Next
- User verification on production data.
- Add drill-down features for these totals if requested.

## Open Questions
- None.

## Working set
- `backend/app/services/reports/base.py`
- `backend/app/services/reports/modal_service.py`
- `backend/app/services/penjualan_mobil_service.py`
