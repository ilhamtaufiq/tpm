# Continuity Ledger

## Goal
- Design and plan the "Operational Balance" (Saldo BOP) feature for Jasa Angkut and Bengkel/Showroom modules.
- Ensure the mechanism allows fund allocation without disrupting overall cash flow.
- Refine the design document `saldo-bop-modul.md` based on user feedback.

## Constraints/Assumptions
- Uses the existing `KasBank` system but with new account categories (`KasBankJenis`).
- Funds are transferred from main accounts (Cash/BCA) to these specialized BOP accounts.
- The system should maintain total liquidity consistency (internal transfers don't change net cash).

## Key decisions
1.  **Account Structure**: Proposed new `KasBankJenis` like `BOP_JASA_ANGKUT` and `BOP_MOBIL`.
2.  **Workflow**: Use "Transfer Kas" (Internal Mutation) for top-up.

## State
- Done:
  - Initial draft of `saldo-bop-modul.md` created.
- Now:
  - Clarifying the nature of BOP accounts (Cash/BCA classification).
- Next:
  - Update `saldo-bop-modul.md` with refined details.
  - Seek user approval before implementation.

## Open questions (UNCONFIRMED if needed)
- Should BOP accounts be subdivided by physical location (e.g., `BOP_CASH_JASA_ANGKUT` vs `BOP_BCA_JASA_ANGKUT`) or is a single virtual account sufficient? `UNCONFIRMED`
- Are "BOP Jasa Angkut" funds typically held in cash by drivers? `UNCONFIRMED`

## Working set (files/ids/commands)
- `c:\laragon\www\tpm\saldo-bop-modul.md`
- `c:\laragon\www\tpm\backend\app\utils\constants.py`

