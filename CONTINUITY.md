# Continuity Ledger - AlertDialog Fix

## Goal
Fix two AlertDialog rendering issues on Android:
1. AlertDialog not appearing centered after printing receipt (bengkel/index.tsx) — it was imported but never rendered.
2. AlertDialog buttons invisible in "Validasi" dialog (BengkelForm.tsx) — AlertDialog was rendered inside BottomSheetScrollView, clipping the Modal.

## Constraints/Assumptions
- AlertDialog uses RN Modal internally — must be rendered at top-level, not inside BottomSheets or other constrained containers.
- Must not break web behavior.

## Key Decisions
- Added missing `<AlertDialogComponent>` render to `bengkel/index.tsx` at root level.
- Moved `<AlertDialog>` from `renderFormContent()` (inside scroll) to both web and mobile render paths at the container level in `BengkelForm.tsx`.

## State
- Done:
  - [x] Fix bengkel/index.tsx — add AlertDialogComponent render at root level
  - [x] Fix BengkelForm.tsx — move AlertDialog outside BottomSheetScrollView
- Now:
  - Verification complete.
- Next:
  - User testing on Android device.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- `frontend/app/bengkel/index.tsx`
- `frontend/components/BengkelForm.tsx`
- `frontend/components/ui/AlertDialog.tsx`
