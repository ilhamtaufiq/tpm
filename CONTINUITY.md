# Continuity Ledger - TPM Workshop Project

## Goal (incl. success criteria)
Enhance workshop transaction form and reports to handle "Always Ready" stock and improve customer onboarding flow. 
Success criteria:
- Stock capital calculation excludes items with stock 999.
- Dashboard/Reports display 999 as "Always Ready" or "Ready" with 0 value contribution.
- BengkelForm allows adding new customers on the fly via a guest-like flow.

## Constraints/Assumptions
- Stock 999 is a business rule for unlimited/always available items.
- Project uses Expo Router, NativeWind (Tailwind), Lucide icons, and React Query.
- Backend uses FastAPI, SQLModel.

## Key decisions
- Modified `SparePartService.get_stock_value` to use `CASE` statements to filter out 999 stock from value calculations.
- Implemented `CustomerFormModal` as a reusable component for quick customer registration.
- Integrated quick registration into `MasterDataSelector` for the "Customer" type.
- Updated PDF export templates to correctly show unlimited stock items.

## State
- **Done**:
    - Fixed capital calculation logic (backend).
    - Updated Inventory UI for 999 stock.
    - Updated Stock Sparepart Report UI and PDF.
    - Created `CustomerFormModal` component.
    - Integrated "Add Customer" flow into `MasterDataSelector`.
    - Fixed backend crash by adding safety checks when serving frontend static files.
    - Fixed TypeScript error in `PurchaseScreen` by adding missing `mutationFn` to `useCreatePembelianParts` hook.
    - Fixed Manifest Validation Error in `app.json` by changing `softwareKeyboardLayoutMode` from `adjustResize` to `resize`.
    - Added Inventory Statistics feature (Top 5 Sales and Lowest Stock) in `InventoryScreen`.
    - Implemented advanced sorting in Spare Part list (by sales, stock, etc.).
    - Replaced sorting Modal with a premium `BottomSheet` in `InventoryScreen` for UI consistency.
    - Verified `softwareKeyboardLayoutMode` fix in `app.json`.
    - Investigating frontend build status (missing index.html in dist).
- **Next**:
    - Final verification and handover.

## Open questions (UNCONFIRMED)
- None at the moment.

## Working set (files/ids/commands)
- backend/app/services/spare_part_service.py
- frontend/app/laporan/stock-sparepart.tsx
- frontend/components/ui/MasterDataSelector.tsx
- frontend/components/ui/CustomerFormModal.tsx
- frontend/components/BengkelForm.tsx
