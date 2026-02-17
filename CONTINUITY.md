# Continuity Ledger

## Goal
1. Refactor Bengkel (Workshop) feature to add a **kategori** (category) field: "umum", "jasa_angkut", "jual_beli_mobil".
2. Link workshop transactions to specific domain records (muatan for jasa_angkut, mobil for jual_beli_mobil).
3. Automate internal payments for domain-specific categories (reduce TPM profit for jasa_angkut, add to HPP for jual_beli_mobil).
4. **UPDATED**: Change "muatan" selection flow to: Choose Armada first, then choose filtered Transaksi Muatan.

## Constraints/Assumptions
- Jasa Angkut categories use `INTERNAL` payment method (no cash/bank entry).
- Selection of muatan/mobil auto-fills car plate and customer info.
- Search results for muatan must be grouped by Armada and show route/driver info (if searched globally), but now primarily filtered by selected Armada.

## Key Decisions
- Created `ArmadaSelector.tsx` for standalone fleet selection.
- Modified `BengkelForm.tsx` to include `selectedArmada` state.
- Filtering logic for muatan: `armada_id === selectedArmada.id || nopol === selectedArmada.nopol`.
- Disabled muatan selection until an armada is chosen to ensure data integrity.

## State
- Done:
  - Categories: "umum", "jasa_angkut", "jual_beli_mobil" implemented.
  - Internal payment logic for specific categories.
  - New two-step selection flow (Armada -> Muatan) implemented.
- Now:
  - Completed UI refinements for the new flow.
- Next:
  - Final verification of the filtering logic with real data.

## Open Questions
- None.

## Working Set
- `frontend/components/BengkelForm.tsx`
- `frontend/components/ui/ArmadaSelector.tsx`
- `frontend/services/jasaAngkut.ts`
- `backend/app/models/jasa_angkut.py`
