# Continuity Ledger

## Goal
Centralize all financial settlement functionality (receivables/piutang) to the Finance section.

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
  - Restricted Jual Beli Mobil (Car Sales) settlement to `finance/piutang` page (removed "Lunasi Pembayaran" from MobilDetail).
  - Improved `finance/piutang` list to display `nomor_referensi` for better transaction identification.
  - Fixed missing `Info` icon import in `MobilDetail.tsx`.
- Now: Completed centralization of all receivable settlements.
- Next: Final confirmation with user.

## Working set
- `backend/app/services/penjualan_mobil_service.py` - cancel_booking() method
- `backend/app/api/v1/penjualan_mobil.py` - POST cancel endpoint
- `backend/app/services/piutang_service.py` - _update_source_transaction fix
- `frontend/services/mobil.ts` - cancelBookingMobil
- `frontend/hooks/useMobil.ts` - useCancelBookingMobil
- `frontend/components/MobilDetail.tsx` - cancel modal UI
