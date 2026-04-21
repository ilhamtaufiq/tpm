# Continuity Ledger - Jasa Angkut Reconciliation

- Goal: Reconcile Jasa Angkut operational expenses (BBM, Toll, etc.) in Laba Rugi and Perubahan Modal reports.
- Constraints/Assumptions:
    - **Trip Costs:** Sum of fixed trip columns (BBM, Toll, Parkir, etc.) and manual trip-linked expenses (JasaAngkutBiayaLainnya).
    - **Automatic Wallet Entries:** MuatanForm creates KasBank entries for manual costs which are correctly reduced from cash but should not be subtracted from reported expenses unless duplicated in the ledger.
- Key Decisions:
    - **Removed `ja_double_exp`:** Eliminated the adjustment that was incorrectly subtracting automated JA wallet entries from the reported expenses, which caused a ~56k under-reporting.
    - **Unified `trip_costs`:** Switched all report services to use the full `trip_costs` aggregate (Fixed + Manual) for JA operational rows to ensure consistency with MuatanForm data.
    - **Breakdown Correction:** Updated `ModalService` to include fixed trip costs (BBM, Toll) in the armada breakdown helper.
    - **Dashboard Centralization:** Moved Dashboard P&L calculation to using `LabaRugiService` directly in the backend `dashboard.py` to ensure 100% agreement between the Finance Tab and Laba Rugi Report.
- State:
    - Done: Capital reconciliation (1.1M discrepancy resolved).
    - Done: Jasa Angkut expense reconciliation (23k vs 79k discrepancy resolved).
    - Done: Finance Dashboard vs Laba Rugi reconciliation (top-line totals and unit-level net profits aligned).
    - Now: Final verification of financial report consistency.
- Working set:
    - `backend/app/services/reports/base.py`
    - `backend/app/services/reports/laba_rugi_service.py`
    - `backend/app/services/reports/modal_service.py`
    - `backend/app/api/v1/dashboard.py`
    - `backend/app/services/muatan_service.py`
    - `backend/app/schemas/jasa_angkut.py`
    - `frontend/app/(tabs)/finance.tsx`

- Split Payment Reconciliation:
    - **Issue:** Split payments in Jasa Angkut often exceeded the reported profit share (laba_tpm) because users entered the full trip price, causing "Perubahan Modal" discrepancies.
    - **Fix:** Implemented automatic normalization/scaling in `MuatanService` (create/update) to ensure the sum of `KasBank` entries always equals `muatan.laba_tpm`.
    - **Update Logic:** Added transition handling in `MuatanService.update`. Marking a trip as `LUNAS` via the edit form now correctly triggers cash recording and reconciles any existing `Piutang`.

- Credit Purchase Reconciliation:
    - **Issue:** Buying cars or parts on credit (Hutang) caused a discrepancy in " Perubahan Modal\ because Section C only subtracted 'cash' portions while Section E added the full debt, double-counting the unpaid value in the theoretical cash position.
 - **Fix:** Switched Section C (Pengurangan Modal) to use the **Total** purchase value (Cash + Accrued) for both cars and parts. This allows Section E (Hutang) to correctly offset the unpaid part, keeping the theoretical modal aligned with physical cash.
