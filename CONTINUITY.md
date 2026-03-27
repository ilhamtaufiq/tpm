# Continuity Ledger

## Goal
- Design and plan the "Operational Balance" (Saldo BOP) feature.
- Implement Barcode/QR Code scanning in BengkelForm for spare parts.
- Implement real-time data refresh mechanism for reports (Dashboard, Neraca, etc.) using React Query polling.
- **NEW**: Add Lunas/Belum Lunas stats and filter to Bengkel, Jasa Angkut, and Mobil pages.

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
  - Fixed `PenjualanMobilService.cancel_booking` logic.
  - Updated `PenjualanMobilService.get_summary` and `get_list` to handle `BATAL` transactions.
  - Corrected `dashboard.py` reports to filter out `BATAL` receivables and handle detached transaction profit.
  - Added Lunas/Belum Lunas stats and `paymentFilter` to Bengkel, Jasa Angkut, and Mobil list pages.
- Now:
  - Analyzing `sparepart.tsx` to verify if `kode` input exists for Barcode scanning usage.
- Next:
  - Add input field for `kode` (Kode Barang/Barcode) in `sparepart.tsx`.
  - Implement auto-refresh in Dashboard and Financial Reports UI components.

## Open questions (UNCONFIRMED if needed)
- Does the user want the `kode` field to be auto-generated or manually typed/scanned in the master data form?

## Working set (files/ids/commands)
- `c:\laragon\www\tpm\backend\app\services\penjualan_mobil_service.py`
- `c:\laragon\www\tpm\backend\app\api\v1\dashboard.py`
- `c:\laragon\www\tpm\backend\app\utils\constants.py`
- `c:\laragon\www\tpm\frontend\components\MobilDetail.tsx`

