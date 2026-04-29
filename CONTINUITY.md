# Continuity Ledger

## Goal
Resolve systemic discrepancies across financial reporting modules (Neraca, Perubahan Modal, Laba Rugi) and fix runtime errors.

## Constraints/Assumptions
- Backend uses FastAPI/SQLAlchemy.
- Constants are defined in `app.utils.constants`.
- Models are in `app.models`.

## Key Decisions
- Standardize logic in `BaseReportService`.
- Fix missing imports in `ModalService` (`HutangSource`, `case`).

## State
- **Done**:
    - Fixed `NameError: name 'HutangSource' is not defined` in `modal_service.py`.
    - Added `case` to `sqlalchemy` imports in `modal_service.py`.
    - Integrated "Kasbon Karyawan (Umum)" into "Piutang Lainnya" reporting logic in `BaseReportService`.
    - Fixed double-counting of piutang in `ModalService` calculation.
    - Overhauled historical piutang/hutang logic in `BaseReportService` to use point-in-time (nominal - payments) logic.
- **Now**:
    - Waiting for user to manually verify transactions for April 29th to isolate the source of the remaining 654k discrepancy.
- **Next**:
    - Validate mathematical consistency (Theoretical vs Actual Capital) after piutang fix.
    - Confirm "BALANCE" status in Perubahan Modal report for April 29th.


## Open Questions
- None at the moment.

## Working Set
- `backend/app/services/reports/base.py`
- `backend/app/services/reports/modal_service.py`
- `frontend/app/laporan/perubahan-modal.tsx`
