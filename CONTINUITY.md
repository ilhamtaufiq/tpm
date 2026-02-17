# Continuity Ledger

- Goal: Fix `update-app.sh` to always run `alembic upgrade head` and `npx expo export -p web` during update.
- Constraints/Assumptions:
  - Running on a VPS (Linux/Ubuntu).
  - Script uses parallel subshells.
- Key decisions:
  - Removed conditional `if` checks for the core migration and build steps.
  - Kept detection logic for `requirements.txt` and `package.json` to avoid unnecessary installs (though npm is currently skipped).
- State:
  - Done: Modified `update-app.sh` to bypass change detection for core steps.
  - Now: Explaining properties of Alembic migrations (data safety).
  - Next: User verification/further tasks.
- Open questions (UNCONFIRMED):
  - None.
- Working set:
  - `c:\laragon\www\tpm\update-app.sh`
