# Continuity Ledger

## Goal
- Design and plan the "Operational Balance" (Saldo BOP) feature.
- **NEW**: Implement Barcode/QR Code scanning in BengkelForm for spare parts.

## Constraints/Assumptions
- Scanner requires a physical device and `expo-camera` library.
- Spare parts match by `kode`.

## Key decisions
1.  **Scanner Library**: Using `expo-camera` (CameraView API).
2.  **UI Integration**: Added "Scan" button in BengkelForm's spare part tab.

## State
- Done:
  - Created `BarcodeScannerModal.tsx` and integrated into `BengkelForm.tsx`.
  - Added `BATAL` status to `PaymentStatus`, `PiutangStatus`, and `HutangStatus`.
  - Updated `TransaksiPenjualanMobil` model to allow nullable `mobil_id`.
  - Fixed `PenjualanMobilService.cancel_booking` logic (detachment, financial correction, non-redundant cash logging).
  - Updated `PenjualanMobilService.get_summary` and `get_list` to handle `BATAL` transactions.
  - Corrected `dashboard.py` reports to filter out `BATAL` receivables and handle detached transaction profit.
- Now:
  - Verified booking cancellation flow and its impact on financial reports.
- Next:
  - User to verify the fix in the UI.

## Open questions (UNCONFIRMED if needed)
- None

## Working set (files/ids/commands)
- `c:\laragon\www\tpm\backend\app\services\penjualan_mobil_service.py`
- `c:\laragon\www\tpm\backend\app\api\v1\dashboard.py`
- `c:\laragon\www\tpm\backend\app\utils\constants.py`
- `c:\laragon\www\tpm\frontend\components\MobilDetail.tsx`

