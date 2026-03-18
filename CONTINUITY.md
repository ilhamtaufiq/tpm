# Continuity Ledger

- Goal: Fix backend migration error (MySQL 1553 - cannot drop index used in FK).
- Constraints/Assumptions:
    - MySQL requires foreign keys to be dropped before the index they use.
    - Migration file `20260318_152354_remove_user_id_from_kas_bank.py` had the wrong order.
- Key decisions:
    - Swap `op.drop_index` and `op.drop_constraint` in the `upgrade()` function.
- State:
    - Done:
        - Identified the problematic migration file.
        - Swapped the order of dropping the index and foreign key.
    - Now: Confirming the fix and communicating with the user.
    - Next: None.
- Open questions (UNCONFIRMED):
    - None.
- Working set (files/ids/commands):
    - `backend/alembic/versions/20260318_152354_remove_user_id_from_kas_bank.py`
