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
  - Created `BarcodeScannerModal.tsx`.
  - Integrated scanner into `BengkelForm.tsx`.
  - Created branch `release/v2.1.0` and merged into `main`.
- Now:
  - Development continuing on `main` branch.
- Next:
  - User to install `expo-camera`.
  - Verify scan logic with real data.

## Open questions (UNCONFIRMED if needed)
- Does the user prefer a different scanner library? `UNCONFIRMED`

## Working set (files/ids/commands)
- `c:\laragon\www\tpm\frontend\components\BengkelForm.tsx`
- `c:\laragon\www\tpm\frontend\components\ui\BarcodeScannerModal.tsx`
- `c:\laragon\www\tpm\frontend\package.json`

