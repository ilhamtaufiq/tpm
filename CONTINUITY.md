# Continuity Ledger - TPM Split Payment in Manajemen Biaya Unit

## Goal
Implement search functionality in "Hutang Usaha" (Accounts Payable) page to improve user experience when filtering through debts.

## Constraints/Assumptions
- Backend uses FastAPI, Pydantic, and SQLAlchemy.
- Frontend uses React Native (Expo) with Tailwind CSS (nativewind).
- Split payment implementation should follow existing patterns (e.g., `PenjualanMobilService`).
- "Manajemen Biaya Unit" refers to adding `MobilBiayaLainnya` to a `Mobil` record.

## Key Decisions
- Update `MobilBiayaCreate` schema to include `payments` list.
- Update `MobilService.add_biaya` to iterate through `payments` and create `KasBank` entries for each.
- Update `MobilCostForm.tsx` UI to allow users to add multiple payment methods and amounts.

## State
- Done: 
  - Updated backend schemas for `MobilBiayaCreate` and `TransaksiMobilCreate` to support split payments.
  - Implemented logic in `MobilService` and `PenjualanMobilService` to record multiple `KasBank` entries for costs, unit creation, and sales.
  - Updated API endpoints to handle split payment data.
  - Redesigned `MobilCostForm.tsx` and `MobilSalesForm.tsx` UI with split payment toggles and dynamic rows.
  - Fixed lint errors in both forms.
  - Fixed investor profit reporting in Dashboard, Laba Rugi, and Capital Change reports to show TPM share.
  - Implemented search functionality in `PiutangUsahaScreen`.
  - Fixed critical backend typo (`jumlah_terbayar` -> `total_dibayar`) across `KasbonService`, `MuatanService`, and `TransaksiBengkelService`.
  - Standardized Kasbon UI in `sdm/kasbon.tsx` with premium Glassmorphism header, search, filters, and detail modals matching the Finance module style.
  - Fixed Kasbon-Finance synchronization: payments in Finance now update Kasbon status (`LUNAS`/`CICILAN`).
  - Implemented Split Disbursement for new Kasbon creation (multiple funding sources).
  - Fixed lint errors in `kasbon.tsx` and updated `sdmService` types to support split payments.
  - Implemented Split Payment for Armada Operational Expenses in `jasa-angkut/armada/detail`.
    - Updated `ArmadaExpenseCreate` backend schema and `ArmadaService.add_expense` to support split payments.
    - Updated `jasaAngkutService` and `ArmadaDetail.tsx` frontend to support multiple payment methods and amounts.
  - Implemented Split Payment for Muatan Revenue in `jasa-angkut/MuatanForm.tsx`.
    - Updated `MuatanCreate` backend schema and `MuatanService.create` to support split payments.
    - Removed dynamic operational costs from `MuatanForm.tsx` as requested (now handled at Armada level).
    - Added split payment UI for muatan revenue collection in `MuatanForm.tsx`.
- Done: Standardized kasbon UI.
- Done: Implemented split payment/disbursement for Kasbon.
- Done: Fixed bug where kasbon deduction from payroll didn't reduce the piutang balance (missing commits and missing PaymentMethod constant).
- Now: Verifying fixes.
- Next: Awaiting user feedback.

## Open Questions (UNCONFIRMED)
None.

## Working Set
- frontend/app/finance/hutang.tsx
- backend/app/services/hutang_service.py
- backend/app/api/v1/hutang.py
