# Continuity Ledger

## Goal
- Implement theme appearance settings in the profile page.
- Move Armada Detail from modal to separate screen in `jasa-angkut`.
- Refine `BengkelForm` for `jasa_angkut` category: link directly to Armada and deduct from Net Profit.

## Constraints/Assumptions
- Project uses NativeWind v4 (Tailwind for React Native).
- Persist theme settings using Zustand and AsyncStorage.
- Workshop transactions for fleet are deducted from Armada Net Profit if not linked to a specific muatan.

## Key decisions
- Added `armada_id` to `TransaksiPenjualanBengkel` model and schemas.
- Updated `ArmadaService.get_detail` to account for non-muatan workshop repairs in net profit calculation.
- Streamlined `BengkelForm` to remove muatan selection for `jasa_angkut` category, focusing on Armada selection.
- Automatic internal payment handling for fleet repairs.

## State
- Done: 
    - Updated backend model and schemas for workshop transactions.
    - Generated and applied alembic migration for `armada_id`.
    - Updated `BengkelForm` UI and submission logic.
    - Updated `ArmadaService` stats calculation.
- Now: Verifying the integration.
- Next: Final check.

## Open questions
- None.

## Working set
- `backend/app/models/bengkel.py`
- `backend/app/services/armada_service.py`
- `frontend/components/BengkelForm.tsx`
- `frontend/app/jasa-angkut/armada/[id].tsx`

