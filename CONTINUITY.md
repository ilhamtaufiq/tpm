# Continuity Ledger

## Goal
- Modify "Stok Mobil (Inventory)" calculation in `frontend/app/laporan/neraca.tsx` by removing "biaya sparepart dan service" while keeping operational costs like Tax/Pajak, BBN, etc.

## Constraints/Assumptions
- User specified `frontend/app/laporan/neraca.tsx`, but logic is in `backend/app/api/v1/dashboard.py` and `backend/app/models/mobil.py`.
- Users record Tax/Pajak both via `MobilBiayaLainnya` (dedicated module) and `PengeluaranBengkel` (workshop operational expenses assigned to a car).
- "biaya sparepart dan service" should be excluded from inventory asset value in Neraca.
- "biaya pajak dll" should remain in inventory asset value.

## Key decisions
1.  **Backend Calculation**: Modified `get_neraca` in `dashboard.py` to exclude `stok_mobil_part_service` from the `stok_mobil_total` sum.
2.  **Model Refactoring**: Updated `Mobil` model properties `total_biaya` and `total_part_service` to distinguish between "HPP Costs" (Tax, BBN, STNK, etc.) and "Service/Maintenance Costs" based on description keywords (e.g., `[Pajak]`, `BBN`) when recorded via Workshop Pengeluaran.
    -   This prevents Tax recorded in the workshop module from being accidentally categorized as a service and removed from inventory value.

## State
- Done:
  - Excluded `total_part_service` from `get_neraca` inventory total.
  - Refined `Mobil.total_biaya` and `Mobil.total_part_service` to allow Tax/BBN recorded in workshop to be treated as HPP.
- Now: Summary provided to the user.
- Next: Final user verification.

## Open questions (UNCONFIRMED if needed)
- None.

## Working set (files/ids/commands)
- `c:\laragon\www\tpm\backend\app\api\v1\dashboard.py`
- `c:\laragon\www\tpm\backend\app\models\mobil.py`
- `c:\laragon\www\tpm\frontend\app\laporan\neraca.tsx`
