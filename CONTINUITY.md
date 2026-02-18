# Continuity Ledger

## Goal
- Modify the display of "muatan" (cargo/shipment) search results in the `BengkelForm` for the "jasa_angkut" (transport service) category.
- Requirement: Display only the TPM share nominal (Gross TPM share), excluding the driver's share.

## Constraints/Assumptions
- Nominal share TPM is calculated as `pendapatan_kotor - laba_supir`.
- `laba_supir` is usually 50% of `pendapatan_kotor` based on `JASA_ANGKUT_PROFIT_SPLIT = 0.5`.
- The user wants this specifically in the search list and the selected state within `BengkelForm`.

## Key decisions
- Updated `BengkelForm.tsx` to use `(Number(item.pendapatan_kotor) || 0) - (Number(item.laba_supir) || 0)` instead of `item.pendapatan_kotor`.

## State
- Done: Updated `BengkelForm.tsx` in two locations (search list rendering and selected state rendering).
- Now: Verifying the changes.
- Next: Inform user about the completion.

## Open questions
- None.

## Working set
- `frontend/components/BengkelForm.tsx`
