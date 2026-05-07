# Continuity Ledger

## Goal
Deploy the TPM Super App to a production Ubuntu VPS environment and resolve database schema discrepancies.

## Constraints/Assumptions
- Target OS: Ubuntu (VPS)
- DB: MySQL (TPM)
- User: ubuntu
- Framework: FastAPI + SQLAlchemy + Alembic

## Key decisions
- **Credential Storage:** Configured Git credential helper on VPS for non-interactive pulls.
- **Catch-all Migration:** Enhanced `20260220_220052_add_phone_to_users.py` (df64ee66aab1) to create `hutang_usaha` and `pembayaran_hutang` tables, as they were missing from the initial schema and all subsequent migrations.
- **User Seeding:** Integrated `seed_users.py` into the deployment script to automate admin creation.

## State
- **Done:** 
  - Audit of 47 migration files.
  - Identification of missing table definitions (`hutang_usaha`, `pembayaran_hutang`).
  - Patching of the catch-all migration.
- **Now:** 
  - Finalizing deployment instructions for the user.
- **Next:** 
  - User runs `sudo ./deploy-vps.sh` (after dropping the DB) to verify the fix.

## Open questions
- None at this moment.

## Working set
- `backend/alembic/versions/20260220_220052_add_phone_to_users.py`
- `deploy-vps.sh`
- `update-app.sh`
- `backend/app/models/keuangan.py`
