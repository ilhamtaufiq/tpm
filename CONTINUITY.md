# Continuity Ledger - TPM Project

## Goal
Unify all operational costs (Armada and Mobil) into the Bengkel Expenses (PengeluaranBengkel) system. Ensure inputs from Detail views create unified records and calculations correctly aggregate these costs.

## Constraints/Assumptions
- Workshop expenses related to "Jasa Angkut" are now primarily linked to `armada_id`.
- Workshop expenses related to "Jual Beli Mobil" are linked to `mobil_id`.
- The "Input Biaya" button in Armada/Mobil Detail views should create `PengeluaranBengkel` records to maintain a single source of truth for expenses.

## Key Decisions
- **Backend**: Updated `ArmadaService.add_expense` and `MobilService.add_biaya` to create `PengeluaranBengkel` records instead of localized "Biaya Lainnya" models.
- **Backend**: Implemented `_generate_pengeluaran_nomor` in both services to ensure unique transaction numbers for unified expenses.
- **Backend**: Updated `Mobil.total_part_service` to aggregate `PengeluaranBengkel` records linked to the car unit.
- **Backend**: Ensured `ArmadaService.get_detail` aggregates all `PengeluaranBengkel` with `bisnis_kategori="jasa_angkut"`.
- **Frontend**: Updated `MobilCostForm.tsx` to use the standard `nominal` field for split payments to match the backend schema.
- **Frontend**: Simplified Jasa Angkut trip detail by removing individual operational costs (as they are now aggregated at the Armada level).

## State
- **Done**: 
  - Backend integration of operational costs into unified Expenses system.
  - Backend transaction number generation for unified expenses.
  - Frontend schema alignment for Mobil cost inputs.
  - Removal of redundant cost displays in Jasa Angkut trip details.
  - Migration of historical operational costs from legacy tables to unified Expenses system.
  - Robust display of workshop expenses in Armada Detail view.
- **Now**: 
  - Verifying data display in Armada and Mobil detail views.
- **Next**:
  - Monitor for any edge cases in business category aggregation.

## Open Questions
- Should "Pajak / BBN / ADM" recorded in `PengeluaranBengkel` be treated as HPP (Asset Cost) or Profit Deduction? (Currently treated as Profit Deduction/Unit Cost similar to repairs).

## Working Set
- `backend/app/services/armada_service.py`
- `backend/app/services/mobil_service.py`
- `backend/app/models/mobil.py`
- `frontend/components/MobilCostForm.tsx`
- `frontend/components/jasa-angkut/ArmadaDetail.tsx`
- `frontend/app/jasa-angkut/index.tsx`
