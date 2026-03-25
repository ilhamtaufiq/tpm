# Continuity Ledger

## Goal
Modify the Laba Rugi report to remove "Total Beban Bisnis" and its accumulation from the display and export.

## Constraints/Assumptions
- Project: TPM (Laporan Laba Rugi).
- Frontend: Expo (React Native).
- File: `frontend/app/laporan/laba-rugi.tsx`.
- Language: Indonesian.

## Key Decisions
- Removed "Total Beban Bisnis" from the Final Recap section.
- Removed "Total Beban Bisnis" from the PDF Export logic in both templates.
- Kept "Profit Bersih Akhir" calculation as is (visibility change only).
- Verified other "Total Beban" labels (left them for now as they are unit-specific or differently labeled).

## State
- Done:
    - Analyzed `frontend/app/laporan/laba-rugi.tsx`.
    - Removed "Total Beban Bisnis" from the mobile UI and the PDF export HTML.
- Now:
    - Task complete.
- Next:
    - Awaiting user feedback on whether unit-level "Total Beban" should also be removed.

## Open Questions (UNCONFIRMED)
- Should "Total Beban" in unit sections or the header be removed too?
- Does "akumulasinya" refer to calculating the profit differently? (Assumed visibility for now).

## Working Set
- `frontend/app/laporan/laba-rugi.tsx`
