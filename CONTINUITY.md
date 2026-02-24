# Continuity Ledger

## Goal
Implement booking cancellation with penalty feature for car sales.

## Constraints/Assumptions
- Car must be in BOOKING status to cancel
- Penalty cannot exceed the DP already paid
- Refund = DP - Penalty
- Penalty recorded as income (KAS MASUK), refund as expense (KAS KELUAR)
- Piutang is closed on cancellation
- Car reverts to TERSEDIA on cancellation

## Key decisions
- Backend: Added `cancel_booking()` method in `PenjualanMobilService` (Supports Split Refund)
- Backend: Added `POST /penjualan-mobil/{id}/cancel` endpoint (Supports Split Refund)
- Backend: Updated `update_payment` in `PenjualanMobilService` (Supports Split Payment)
- Frontend: Added split payment UI in Payment Modal and Cancel Modal with toggle and currency formatting.
- Previous fix: `piutang_service.py._update_source_transaction()` now also transitions car BOOKING → TERJUAL when piutang is paid via piutang page
- Workshop, Jasa Angkut & SDM Kasbon: Settlement/payment for debts/kasbon is now restricted to the `finance/piutang` page only. Module detail/list pages now only show a summary of the debt.

## State
- Done:
  - Backend `cancel_booking()` in `penjualan_mobil_service.py`
  - Backend `POST /{id}/cancel` endpoint in `penjualan_mobil.py`
  - Backend `_update_source_transaction()` fix in `piutang_service.py`
  - Frontend service `cancelBookingMobil` in `services/mobil.ts`
  - Frontend hook `useCancelBookingMobil` in `hooks/useMobil.ts`
  - Frontend cancel modal UI in `components/MobilDetail.tsx`
  - Restricted Workshop debt settlement to `finance/piutang` page.
  - Restricted Jasa Angkut debt settlement to `finance/piutang` page.
  - Restricted SDM Kasbon debt settlement to `finance/piutang` page.
- Now: All requested settlement restrictions implemented and centralized in Finance.
- Next: Final confirmation with user.

## Working set
- `backend/app/services/penjualan_mobil_service.py` - cancel_booking() method
- `backend/app/api/v1/penjualan_mobil.py` - POST cancel endpoint
- `backend/app/services/piutang_service.py` - _update_source_transaction fix
- `frontend/services/mobil.ts` - cancelBookingMobil
- `frontend/hooks/useMobil.ts` - useCancelBookingMobil
- `frontend/components/MobilDetail.tsx` - cancel modal UI
