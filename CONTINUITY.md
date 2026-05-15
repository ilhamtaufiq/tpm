# Continuity Ledger - Laba Rugi & Lembur Integration

## Goal
1. Standardize identifier generation to prevent UI state collisions (collision-resistant unique IDs).
2. Stabilize Kasbon reporting to maintain a balanced Neraca (Balance Sheet).
3. **Synchronize Lembur (Overtime) Costs**: Ensure overtime expenses are correctly deducted from Bengkel unit profit and displayed in the Laba Rugi report to match the Perubahan Modal report.

## Constraints/Assumptions
- Overtime costs (lembur) were already accounted for in `modal_service.py` but missing from `laba_rugi_service.py` calculations and UI.
- All payroll data (Gaji + Lembur) is centralized in `SlipGajiService` and accessible via `BaseReportService`.

## Key Decisions
- **Unified Profit Calculation**: Updated `laba_rugi_service.py` to explicitly subtract `b_lembur` from the net profit calculation, mirroring the logic used in capital change reports.
- **Explicit UI Exposure**: Added "Beban Lembur Karyawan" as a distinct line item in the frontend and PDF/Print exports for full financial transparency.

## State
- **Done**: Integrated lembur costs into `laba_rugi_service.py` backend logic.
- **Done**: Updated `laba-rugi.tsx` frontend to display lembur as a separate expense line.
- **Done**: Updated `reportTemplates.ts` to include lembur in PDF/Print exports.
- **Now**: Verifying data consistency between Laba Rugi and Perubahan Modal.
- **Next**: Final review of the entire financial reporting suite.

## Working Set
- `backend/app/services/reports/laba_rugi_service.py`
- `frontend/app/laporan/laba-rugi.tsx`
- `frontend/utils/reportTemplates.ts`
- `backend/app/services/reports/modal_service.py`
- `CONTINUITY.md`
