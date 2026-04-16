# Continuity Ledger - TPM Local Development

## Goal
Fix missing "Beban Gaji" (Salary Expense) in the Laba Rugi (Profit and Loss) report.

## Constraints/Assumptions
- Salary data is fetched from `SlipGaji` model via `SlipGajiService`.
- Only `LUNAS` (Paid) salaries are included in the report.
- The frontend expects `reportData.pengeluaran_details.gaji.total_gaji_pokok`.

## Key Decisions
- Found that `backend/app/api/v1/dashboard.py` was merging salary summary into the existing `pengeluaran_details` but only updating `total` and `count`, losing the `total_gaji_pokok` and `total_uang_lembur` fields required by the frontend.
- Updated the merge logic to perform a deep-merge of all summary fields.

## State
- **Done**: 
    - Analyzed `laba-rugi.tsx` mapping.
    - Identified data loss in `dashboard.py`.
    - Fixed the merge logic in `backend/app/api/v1/dashboard.py`.
- **Now**: Verifying if other sections need salary data.
- **Next**: Final report to user.

## Open Questions
- Is "Beban Gaji" expected to be shown in the overall overhead section as well, or is the current workshop-only attribution sufficient?

## Working Set
- `frontend/app/laporan/laba-rugi.tsx`
- `backend/app/api/v1/dashboard.py`
- `backend/app/services/slip_gaji_service.py`
