# Continuity Ledger - TPM Project

## Goal
Implement a comprehensive User Management system, unify operational costs, and manage overall cash transactions. Ensure the UI adheres to the Premium Bento Layout and supports dynamic theme colors.

## Constraints/Assumptions
- Cash transactions are NOT linked to `user_id` in `KasBank` (Per-User Wallets removed).
- Global cash balance is tracked per account type (CASH, BANK_BCA, etc.) regardless of who holds it.
- Transfers occur between account types (e.g., CASH to BANK_BCA).

## Key Decisions
- **Remove Per-User Cash**: Removed `user_id` from `KasBank` model and simplified `KasBankService` to track global balances.
- **Simplify Transfers**: Modified `KasBankService.transfer` to remove user-to-user logic, focusing only on account-to-account movements.
- **UI Cleanup**: Removed "User Wallets" screen and breakdown from "Mutasi Kas" and home dashboard.

## State
- **Done**: 
  - Backend and frontend support for Admin, Kasir, and Mekanik roles.
  - Premium User Management UI with stats and profile details.
  - Per-User Cash Removal: Database schema updated (user_id removed), service logic simplified, and API endpoints updated.
  - Mutasi Kas UI cleaned up (removed user filters and breakdown).
  - User Wallets screen deleted.
  - SMTP Settings: Added global SMTP configuration for Gmail, including Backend model, API with test connection feature, and dedicated Frontend settings page.
- **Now**:
  - Final verification of the cash flow system without per-user tracking.
- **Next**:
  - Implement a "Tutup Kasir" (Cashier Closing) report feature based on total cash.

## Open Questions
- Should "Tutup Kasir" include a physical vs system cash comparison field?

## Working Set
- `backend/app/models/keuangan.py`
- `backend/app/services/kas_bank_service.py`
- `backend/app/api/v1/kas_bank.py`
- `frontend/services/keuangan.ts`
- `frontend/app/finance/mutasi.tsx`
- `frontend/app/(tabs)/finance.tsx`
- `frontend/components/WalletSection.tsx`

