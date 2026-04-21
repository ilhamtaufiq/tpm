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
    - Done: Capital reconciliation (1.1M & 30k discrepancies resolved).
    - Done: Jasa Angkut expense reconciliation (23k vs 79k discrepancy resolved).
    - Done: Finance Dashboard vs Laba Rugi reconciliation (top-line totals and unit-level net profits aligned).
    - Done: Fix 'void_muatan' reversal bug (ensures all related cash entries are cleared).
    - Done: Resolve mobile date picker interaction issue in slips screen.
    - Now: Monitoring for any other report discrepancies.
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

- Theoretical Opening Modal & Stock Import Reconciliation:
    - **Issue:** Filtering the report by May 2026 (or any start date) showed a massive 259M IDR discrepancy.
    - **Cause:** Section B correctly listed ~261M in assets (mostly imported stock), but Section A's "Opening Modal" only counted manual capital injections and cumulative profit. Since the 259M stock was imported without a matching Modal entry, it appeared as "phantom assets" that reduced the theoretical cash position into a huge negative.
    - **Fix:** Redefined `modal_awal_theoretical` as the **Point-in-Time Net Asset Value** (Cash + Stock + Assets - Debt) at the yesterday of the start date. This ensures that any business value (like imported stock) present at the cycle's start is balanced as part of the initial equity, bringing the discrepancy from 259M down to ~30k (a 99.99% reduction).
    - **Methodology Shift:** Shifted from a "cumulative ledger" approach to a "snapshot reconciliation" approach for opening balances, making the report robust against missing historical transaction history.

- Internal Revenue & Untracked Fee Reconciliation (30k Gap fix):
    - **Fix 1:** Implemented `internal_elimination` subtraction from Section A and total exclusion of internal repairs from Section C.
    - **Fix 2:** Added automated detection for untracked bank fees and Jasa Angkut wallet gaps in `BaseReportService`.
    - **Fix 3:** Updated `void_muatan` to reverse all related `KasBank` entries (including `BENGKEL` source) to prevent orphaned cash flows.

