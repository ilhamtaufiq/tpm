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
- **Now**:
    - Finalizing UI verification for "Rincian Piutang" display.
- **Next**:
    - Validate mathematical consistency (Theoretical vs Actual Capital) after piutang fix.
    - Confirm "BALANCE" status in Perubahan Modal report.

## Open Questions
- None at the moment.

## Working Set
- `backend/app/services/reports/base.py`
- `backend/app/services/reports/modal_service.py`
- `frontend/app/laporan/perubahan-modal.tsx`
