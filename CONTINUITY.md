# Continuity Ledger

## Goal
- Design and plan the "Operational Balance" (Saldo BOP) feature.
- Implement Barcode/QR Code scanning in BengkelForm for spare parts.
- Implement real-time data refresh mechanism for reports (Dashboard, Neraca, etc.) using React Query polling.
- **DONE**: Filter armada (fleet) list in `MuatanForm.tsx` to only show those that are ready based on trip status (PROSES vs SELESAI).
- **DONE**: Implement trip status (PROSES/SELESAI) in Jasa Angkut module.
- **DONE**: Implement supir (driver) readiness logic similar to armada, filtering out busy drivers from pills.
- **DONE**: Add status update functionality in the Detail view for quick completion of trips.
- **DONE**: Fix database error `Unknown column 'muatan_jasa_angkut.status'` by manually adding the column.
- **DONE**: Add quick selection pills (top 5 ready/active) for Armada and Driver in `MuatanForm.tsx`.
- **DONE**: Add Lunas/Belum Lunas stats and date range filter to Bengkel, Jasa Angkut, and Mobil list pages.
- **URGENT**: Fix SyntaxError in `frontend/app/jasa-angkut/index.tsx` (Duplicate declaration of `handleEdit`).
- **URGENT**: Fix `ModuleNotFoundError` in `backend/app/services/muatan_service.py`.

## Constraints/Assumptions
- Scanner requires a physical device and `expo-camera` library.
- Spare parts match by `kode`.

## Key decisions
1.  **Scanner Library**: Using `expo-camera` (CameraView API).
2.  **UI Integration**: Added "Scan" button in BengkelForm's spare part tab.
3.  **Bug Fix (Jasa Angkut)**: Consolidated `handleEdit`, added missing `useActiveArmada` hook, fixed `searchQuery` declaration order, and repaired broken JSX blocks in the filter overlay.
4.  **Master Data (Sparepart)**: Added `Kode Barang / Barcode` input field to the form to support barcode-based lookups and scanning.
5.  **Backend Fix**: Corrected import path for `PiutangUsaha` in `muatan_service.py` to point to `app.models.keuangan`.
6.  **Fleet Filtering**: Modified `ArmadaService.get_active_armada` to check if the armada has any Muatan with status `PROSES`. If so, it is marked as `is_ready = False`.
7.  **Trip Status**: Added `MuatanStatus` (PROSES/SELESAI) to `MuatanJasaAngkut` model, schemas, and UI (Form & List views).
8.  **Database Migration**: Manually executed SQL to add `status` column to `muatan_jasa_angkut` table to fix runtime errors.
9.  **Selection UX**: Added max 5 "Ready" pills for Armada and Driver quick selection in the form to improve speed.
10. **Detail UX**: Added a prominent button in the Detail view to toggle between `PROSES` and `SELESAI` with a confirmation dialog.

## State
- Done:
  - Created `BarcodeScannerModal.tsx` and integrated into `BengkelForm.tsx`.
  - Added `BATAL` status to `PaymentStatus`, `PiutangStatus`, and `HutangStatus`.
  - Updated `TransaksiPenjualanMobil` model to allow nullable `mobil_id`.
  - Fixed `PenjualanMobilService.cancel_booking` logic.
  - Updated `PenjualanMobilService.get_summary` and `get_list` to handle `BATAL` transactions.
  - Corrected `dashboard.py` reports to filter out `BATAL` receivables and handle detached transaction profit.
  - Added Lunas/Belum Lunas stats, `paymentFilter`, and `dateRange` filter to Bengkel, Jasa Angkut, and Mobil list pages (Standardized UI across operational modules).
  - Fixed `SyntaxError` and multiple logic bugs in `frontend/app/jasa-angkut/index.tsx`.
  - Added `kode` input field to `master-data/sparepart.tsx`.
  - Fixed `ModuleNotFoundError: No module named 'app.models.piutang'` in `muatan_service.py`.
  - Implemented armada "ready" status filtering based on current active trips.
  - Added trip status (PROSES/SELESAI) tracking in Jasa Angkut.
  - Fixed missing `status` column in database.
  - Added Armada and Driver recommendation pills in MuatanForm.
  - Added Status Toggle button in Muatan Detail view.
- Now:
  - Finalizing Jasa Angkut enhancements.
- Next:
  - Implement auto-refresh in Dashboard and Financial Reports UI components.
  - Finalize barcode scanning logic in `BengkelForm` to use the `kode` field.

## Open questions (UNCONFIRMED if needed)
- Does the user want the `kode` field to be auto-generated or manually typed/scanned in the master data form?

## Working set (files/ids/commands)
- `c:\laragon\www\tpm\frontend\components\jasa-angkut\MuatanForm.tsx`
- `c:\laragon\www\tpm\frontend\app\jasa-angkut\index.tsx`
- `c:\laragon\www\tpm\backend\app\services\armada_service.py`
- `c:\laragon\www\tpm\backend\app\utils\constants.py`
- `c:\laragon\www\tpm\backend\app\models\jasa_angkut.py`
- `c:\laragon\www\tpm\backend\app\schemas\jasa_angkut.py`
