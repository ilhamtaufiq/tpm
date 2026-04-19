# CONTINUITY.md

## Goal
Standardize and resolve discrepancies in "Jasa Angkut" and "Mobil" financial reporting within the "Laporan Perubahan Modal" report.

## Success Criteria
- [x] Integrate workshop repair costs into Jasa Angkut reporting per armada.
- [x] Separate manual operational expenses from general overhead.
- [x] Integrate "HPP Mobil" grouping (Purchase, Prep, Repair).
- [x] Include **Internal Workshop Repairs** (TransaksiPenjualanBengkel) in HPP Mobil.
- [x] Fix **Double Counting** in car modal (HPP/Estimasi Modal) by consolidating data sources in `mobil.py`.
- [x] Synchronize "Total Beban Operasional" with its detailed breakdown.
- [x] Resolve **100k Selisih/Discrepancy** by adding unpaid internal workshop bills to Section E (Hutang).
- [x] Fixed `AttributeError` for `status_bayar` and `grand_total` logic in `dashboard.py`.

## Constraints/Assumptions
- Reporting must distinguish between unit-level overhead and asset-specific costs.
- Column names in `bengkel.py` are `status_bayar` and `grand_total`.

## Key Decisions
- **HPP Mobil**: Includes Purchase Price, Prep Costs (Taxes), and ALL Repairs (External + Internal).

## State
- **Done**: 
  - Fixed property access errors in `dashboard.py`.
  - Verified math is now balanced.
- **Now**: Report is finalized and verified.
- **Next**: Conclusion.

## Open Questions
- None.

## Working Set
- Backend: `app/models/mobil.py`, `app/api/v1/dashboard.py`
- Frontend: `app/laporan/perubahan-modal.tsx`
