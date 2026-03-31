# Continuity Ledger

- Goal: Fix "Hasil Jual (Tunai)" displaying 0 in Bengkel dashboard.
- Constraints/Assumptions: Financial totals should reflect real cash/bank inflows in the ledger.
- Key decisions: Refactor `TransaksiBengkelService.get_summary` to query the `KasBank` table instead of the `TransaksiPenjualanBengkel` table for financial metrics.
- State:
  - Done:
    - Fixed NameError in `backend/app/schemas/mobil.py` by adding missing `KasBankJenis` import.
    - Identified that the "Hasil Jual (Tunai)" was 0 because it excluded income from piutang settlements.
    - Refactored `TransaksiBengkelService.get_summary` to use the `KasBank` ledger. Improved robustness by including both BENGKEL and PIUTANG source types for income calculation.
  - Now: Completed fix for Bengkel workshop reporting.
  - Next: User verification of "Hasil Jual (Tunai)" in the dashboard.
- Open questions (UNCONFIRMED if needed): None.
- Working set (files/ids/commands):
  - `backend/app/services/transaksi_bengkel_service.py`
  - `backend/app/schemas/mobil.py`
