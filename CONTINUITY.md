# Continuity Ledger

## Goal
1. Refactor Bengkel (Workshop) feature to add a **kategori** (category) field: "umum", "jasa_angkut", "jual_beli_mobil".
2. Link workshop transactions to specific domain records (muatan for jasa_angkut, mobil for jual_beli_mobil).
3. Automate internal payments for domain-specific categories (reduce TPM profit for jasa_angkut, add to HPP for jual_beli_mobil).
4. **NEW**: Improve "muatan" search results in BengkelForm to be more comprehensive.

## Constraints/Assumptions
- Jasa Angkut categories use `INTERNAL` payment method (no cash/bank entry).
- Selection of muatan/mobil auto-fills car plate and customer info.
- Search results for muatan must be grouped by Armada and show route/driver info.

## Key Decisions
- Use `SectionList` in `BengkelForm.tsx` for grouped muatan search results.
- Grouping logic: `item.armada.nama || item.nopol`.
- Display format: `Asal -> Tujuan` for route, explicit `Supir` label.

## State
- Done:
  - Categories: "umum", "jasa_angkut", "jual_beli_mobil" implemented.
  - Internal payment logic for specific categories.
  - Grouping and comprehensive display of muatan search results in `BengkelForm.tsx`.
- Now:
  - Finalizing UI refinements.
- Next:
  - Test the new search UI.
  - Verify data consistency across categories.

## Open Questions
- None.

## Working Set
- `frontend/components/BengkelForm.tsx`
- `frontend/services/jasaAngkut.ts`
- `backend/app/models/jasa_angkut.py`
