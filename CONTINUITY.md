# Continuity Ledger

## Goal
Refactor Bengkel (Workshop) feature to add a **kategori** (category) field with two values: "Jasa Angkut" and "Jual Beli Mobil". When creating a bengkel transaction, user first selects category (Jasa Angkut or Jual Beli Mobil), then picks the relevant transport transaction or car. Remove bengkel integration from Jasa Angkut and Mobil screens but keep transaction detail showing in the respective category.

### Success Criteria
- Bengkel transactions have a `kategori` field (jasa_angkut / jual_beli_mobil / umum)
- BengkelForm allows selecting category and linking to relevant muatan/mobil
- The integration flow from Jasa Angkut and Mobil TO bengkel is removed
- Transaction detail in bengkel still shows category info
- Financial flow remains unchanged

## Constraints/Assumptions
- Backend `TransaksiPenjualanBengkel` model does NOT have a `kategori` column yet → needs migration
- Backend schema `TransaksiBengkelCreate` does NOT have `kategori` yet → needs update
- Frontend-only changes for now, with backend schema + model updates
- This is a frontend + backend full-stack change

## Key Decisions
- Three categories: "umum" (default/legacy), "jasa_angkut", "jual_beli_mobil"
- Adding `kategori`, `muatan_id`, `mobil_id` columns to `TransaksiPenjualanBengkel`
- Category selector at top of BengkelForm
- When "jasa_angkut" selected: show muatan/transport transaction picker
- When "jual_beli_mobil" selected: show mobil (car) picker
- "umum" is default for backward compatibility
- Remove `addBengkelTransaction` integration from mobil service/hooks
- Remove bengkel section from jasa angkut detail view  

## State
- Done: Analysis of existing codebase
- Now: Implementing changes
- Next: Testing

## Open Questions
- Backend database migration for new columns (manual step?)

## Working Set
### Backend
- `backend/app/models/bengkel.py` - Add kategori, muatan_id, mobil_id
- `backend/app/schemas/bengkel.py` - Update create/response schemas
- `backend/app/services/bengkel_service.py` - Update service logic

### Frontend  
- `frontend/services/bengkel.ts` - Update interfaces
- `frontend/hooks/useBengkel.ts` - Add hooks for muatan/mobil selection
- `frontend/components/BengkelForm.tsx` - Add category selector + muatan/mobil picker
- `frontend/app/bengkel/index.tsx` - Show category badge on transactions
- `frontend/app/jasa-angkut/index.tsx` - Remove bengkel integration
- `frontend/services/mobil.ts` - Remove addBengkelTransaction (later)
- `frontend/hooks/useMobil.ts` - Remove useAddBengkelTransaction (later)
