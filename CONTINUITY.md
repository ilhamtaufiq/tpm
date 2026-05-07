# Continuity Ledger

## Goal
Deploy the TPM Super App to a production Ubuntu VPS environment and resolve database schema discrepancies. (ACHIEVED)

## Constraints/Assumptions
- Target OS: Ubuntu (VPS)
- DB: MySQL (TPM)
- User: ubuntu
- Framework: FastAPI + SQLAlchemy + Alembic

## Key decisions
- **Credential Storage:** Configured Git credential helper on VPS for non-interactive pulls.
- **Catch-all Migration:** Enhanced `20260220_220052_add_phone_to_users.py` (df64ee66aab1) to create `hutang_usaha` and `pembayaran_hutang` tables.
- **User Seeding:** Integrated `seed_users.py` into the deployment script.

## State
- **Done:** 
  - Audit of 47 migration files.
  - Patching of the catch-all migration to create missing tables.
  - Successful deployment on VPS with fresh DB.
- **Now:** 
  - Task completed successfully.
- **Next:** 
  - (Optional) SSL/HTTPS setup.
  - (Optional) Verification of financial reports.

## Open questions
- None.

## Working set
- `backend/alembic/versions/20260220_220052_add_phone_to_users.py`
- `deploy-vps.sh`
- `update-app.sh`
