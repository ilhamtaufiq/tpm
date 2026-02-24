# Continuity Ledger - TPM Split Payment in Manajemen Biaya Unit

## Goal
Add split payment functionality (multiple payment methods) to the "Manajemen Biaya Unit" feature, consistent with other parts of the application.

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
- Now: Verifying and Abschluss.
- Next: Done.

## Open Questions (UNCONFIRMED)
None.

## Working Set
- backend/app/schemas/mobil.py
- backend/app/services/mobil_service.py
- backend/app/api/v1/mobil.py
- frontend/components/MobilCostForm.tsx
