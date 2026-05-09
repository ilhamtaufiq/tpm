# Continuity Ledger

## Goal
Achieve complete accounting accuracy and transparency by finalizing the integration of unit-level profits into financial reports and providing granular breakdown of car inventory valuation.

## Constraints/Assumptions
- Accrual accounting: Prep costs for unsold units are capitalized in inventory.
- Realized prep costs (prep_hpp) are used for profit reports.
- UI transparency for all business units (Bengkel, Mobil, JA).

## Key decisions
- Use `prep_hpp` instead of total prep expenses for periodic profit reports.
- Add `stok_mobil_detail` to Neraca to show exactly which cars make up the inventory value.
- Synchronize PDF templates with UI changes for professional output.

## State
### Done
- Reconciled "Laba Usaha" in `perubahan-modal.tsx`.
- Refactored `LabaRugiService` to use accrual-based prep costs.
- Added car-level stock breakdown to `NeracaService` and `base.py`.
- Implemented car inventory detail UI in `neraca.tsx`.
- Updated `NeracaReport` TypeScript types.
- Updated `buildNeracaExportHtml` in `reportTemplates.ts`.

### Now
- Completed the requested car stock detail expansion in Neraca.

### Next
- User verification of the new inventory transparency.

## Open questions
- None at this moment.

## Working set
- backend/app/services/reports/base.py
- backend/app/services/reports/neraca_service.py
- frontend/app/laporan/neraca.tsx
- frontend/utils/reportTemplates.ts
- frontend/types/reports.ts
