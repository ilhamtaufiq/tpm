# Continuity Ledger - TPM Equity Report Integration

## Goal
Finalize the "Perubahan Modal" report integration by resolving the discrepancy in the "Laba Usaha" calculation, specifically addressing the -500k issue reported for the Mobil unit.

## Constraints/Assumptions
- "Biaya Persiapan" (Prep costs) are currently being treated as period expenses in the Laba Rugi report (per user request in Conversation edb9841c).
- In the Balance Sheet/Capital perspective, these costs should ideally be capitalized as part of Inventory.
- The -500k reported likely stems from a prep cost (Pajak/STNK) recorded for a car that is not yet sold or is in "Booked" status.

## Key Decisions
- [Decided] Replace monolithic "Laba Bersih" with "Laba Usaha (Unit)" and "Beban Operasional & Gaji Pusat".
- [Decided] Follow strict accounting (Option B): Capitalize prep costs for unsold cars into "Stok Mobil" and only show realized profit in "Laba Usaha".

## State
- **Done**: Backend `ModalService` updated to expose `laba_usaha`. Frontend `perubahan-modal.tsx` updated to show the new breakdown.
- **Now**: Implementing strict accounting logic to resolve the -500k "Unit Mobil" loss (capitalizing prep costs instead of expensing them in the Equity statement).
- **Next**: Update `ModalService.py` to ensure `laba_usaha` only includes realized profits.

## Open Questions
- Does the user want the -500k prep cost to be shown as a loss in the equity report (matching Laba Rugi) or capitalized (matching Balance Sheet)?
- Is the -500k appearing because it's being subtracted from "Laba Usaha" but not neutralized by stock value in that specific view?

## Working Set
- `backend/app/services/reports/modal_service.py`
- `backend/app/services/reports/base.py`
- `frontend/app/laporan/perubahan-modal.tsx`
- `backend/app/services/reports/laba_rugi_service.py`
