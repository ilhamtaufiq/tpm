# Continuity Ledger

## Goal
Refine the "Laba Rugi" (Profit & Loss) report by removing the "Total Beban" line items while keeping the core calculation (Laba Kotor and Laba Bersih).

## Constraints/Assumptions
- File: `frontend/app/laporan/laba-rugi.tsx`.
- Calculation logic for Laba Bersih must remain: Laba Kotor - Total Biaya.
- UI components (Insight Card and Unit Sections) and PDF export templates need adjustment.

## Key Decisions
- Remove "Total Beban" row from visual report (previous step).
- Corrected Laba Bersih calculation in backend (`dashboard.py`): Excluded `pembelian_part` (already in HPP) and `prive` (equity) from the `total_pengeluaran` used for `laba_bersih`. This fixes the double-counting of sparepart costs (35k in user's example).

## State
- Done:
    - Adjusted UI to focus on Laba Kotor and Laba Bersih.
    - Updated backend `get_profit_summary` to exclude non-operational/duplicate costs from Net Profit calculation.
- Now:
    - Finalizing changes and verifying consistency.
- Next:
    - Verify if the user wants "Prive" to be shown differently in the final rekap.

## Open Questions (UNCONFIRMED)
- Should the numbering in the PDF (4, 5, 6) be adjusted if a row is removed (though currently "Total Beban" isn't numbered in PDF)?
- Does the user want "Total Beban" removed from the final rekap (it's not there currently anyway)?

## Working Set
- `frontend/app/laporan/laba-rugi.tsx`

