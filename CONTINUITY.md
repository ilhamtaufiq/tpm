# Continuity Ledger

- Goal (incl. success criteria): Fix "Piutang Karyawan" not decreasing in reports when deducted from salary slips.
- Constraints/Assumptions:
    - P&L uses Gross Salary for expenses.
    - Capital Report reconciliation depends on tracking net changes in assets.
- Key decisions:
    1.  Create `KasBank` MASUK entries for salary deductions in `KasbonService.apply_payment_from_payroll` (Source: KASBON, Method: POTONG_GAJI).
    2.  Modify `dashboard.py` to calculate `total_penerimaan_piutang` (All payments received) and subtract it from Section B in the Capital Report.
    3.  This ensures the modal reconciliation formula balances when old debts are repaid (as cash increases, piutang asset correctly "decreases" in the net total).
- State:
  - Done:
    - Identified that `KasBank` entries were missing for payroll deductions.
    - Identified that Capital Report was ignoring repayments of old piutangs.
    - Implemented `create_kas_entry` in `KasbonService`.
    - Implemented `void_payroll_payment` cleanup for `KasBank`.
    - Updated `PiutangService.get_summary` and `dashboard.py` (Capital Report) to handle gross totals and total repayments.
    - Fixed "Stok Mobil" zero value in Neraca: corrected math error in `get_neraca` where purchase price was accidentally subtracted.
  - Now: Monitoring and verification.
  - Next: User verification of Neraca and Profit & Loss values.
- Open questions (UNCONFIRMED if needed): None.
- Working set (files/ids/commands):
    - `backend/app/api/v1/dashboard.py`
    - `backend/app/models/mobil.py`
