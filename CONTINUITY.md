# Continuity Ledger

## Goal
Investigate and rectify a discrepancy in the Balance Sheet where the remaining debt for a purchased car is not correctly reflecting the Down Payment (DP) amount.

## Constraints/Assumptions
- Framework: FastAPI + SQLAlchemy + Alembic
- DB: MySQL (TPM)
- Reports use historical calculation: SUM(nominal) - SUM(pembayaran).

## Key decisions
- **Hutang Recording:** Fixed `MobilService.create` to record ONLY the actual debt (Price - DP) in `nominal_hutang`, ensuring consistency with other modules and correct historical reporting in the Balance Sheet.
- **Verification:** Created `test_car_debt_fix.py` and executed it using the local `venv` to confirm the fix.
- **Maintenance:** Provided `fix_car_debt_records.py` to reconcile any existing inconsistent debt records.

## State
- **Done:**
  - Logic analysis of `MobilService` vs `NeracaService`.
  - Implementation of consistency fix in `MobilService`.
  - Verification with local test script.
- **Now:**
  - Task verified and ready for deployment.
- **Next:**
  - Monitor production reports for consistency.

## Open questions
- None.

## Working set
- `backend/app/services/mobil_service.py`
- `backend/test_car_debt_fix.py`
- `backend/fix_car_debt_records.py`
