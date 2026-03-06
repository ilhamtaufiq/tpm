# CONTINUITY: Car Sales DP and Debt Management

## Goal
Implement car sales/purchase DP logic, display remaining debt, and implement repayment functionality. Recover from corrupted Git configuration. Update PIN pad design.

## Context
- The system handles car inventory (purchases) and car sales.
- Purchases can be cash or DP (creating `HutangUsaha`).
- Sales can be cash or DP (creating `PiutangUsaha`).
- Car status changes to `BOOKING` if sold via DP, and `TERJUAL` if fully paid.
- Users need to see remaining debt/receivables for each car and process repayments.
- **Git Recovery**: `.git/config` was corrupted, rebuilt using info from `.git/FETCH_HEAD`.
- **PIN Pad**: User wants a specific layout: 
  1 2 3
  4 5 6
  7 8 9
    0 x

## Key Decisions
- **Backend Sync**: Recording a car purchase with DP automatically creates a `HutangUsaha` record.
- **Backend Sync**: Recording a car sale with DP automatically creates a `PiutangUsaha` record and sets car status to `BOOKING`.
- **Frontend Tracking**: `MobilDetail` screen now fetches and displays both `activeTx` (sales receivable) and `activeHutang` (purchase debt).
- **Repayment Integration**: Created `HutangPaymentModal` (based on `PaymentModal`) to handle debt repayments.
- **Visibility**: Added badges ("HUTANG", "PIUTANG") to the car inventory list for quick identification.
- **Git Recovery**: Manually rebuilding `.git/config` using info from `.git/FETCH_HEAD` and directory structure.
- **PIN Design**: Adjusting the `PinScreen` layout to match the 3-column keypad with 0 and Backspace in the center and right slots of the last row.

## Progress State
### Done
- Backend logic for creating Hutang on car purchase (`mobil_service.py`).
- Backend logic for reaching Piutang on car sale (`penjualan_mobil_service.py`).
- Integrated `HutangService.process_payment` to update source transaction status.
- Created `HutangPaymentModal` component.
- Updated `MobilDetail` to show debt info and trigger repayment modals.
- Updated `MobilInventoryScreen` to show status badges.
- Fixed source labels in `PiutangScreen`.
- Updated `MobilResponse` schema to include purchase payment status.
- Recovered corrupted `.git/config` file.
- Updated PIN pad design in `frontend/app/(security)/pin.tsx` to match custom layout (3 columns, 0 and delete on last row).

### Now
- Final verification of the end-to-end flow.

### Next
- Monitoring for any further UI feedback.

## Working Set
- `frontend/app/(security)/pin.tsx`
- `backend/app/services/mobil_service.py`
- `backend/app/services/penjualan_mobil_service.py`
- `backend/app/services/hutang_service.py`
- `backend/app/schemas/mobil.py`
- `frontend/components/MobilDetail.tsx`
- `frontend/components/HutangPaymentModal.tsx`
- `frontend/app/mobil/index.tsx`
- `frontend/app/finance/piutang.tsx`
- `.git/config`
