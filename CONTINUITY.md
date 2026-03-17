# Continuity Ledger - TPM Project

## Goal
Implement a comprehensive User Management system, unify operational costs, and track cash transactions on a per-user basis (Individual User Wallets). Ensure the UI adheres to the Premium Bento Layout and supports dynamic theme colors.

## Constraints/Assumptions
- Cash transactions are linked to `user_id` in `KasBank` to track individual wallets.
- Global cash balance is the sum of all individual user wallets.
- Users can transfer cash to each other (e.g., Cashier to Manager).

## Key Decisions
- **Cash Per User**: Added `user_id` to `KasBank` model and updated `KasBankService` to filter balances by user.
- **Cash Breakdown**: Implemented a per-user cash breakdown in the `Mutasi Kas` screen.
- **Transfer Logic**: Enhanced `KasBankService.transfer` to support user-to-user cash movements.
- **User Management**: Integrated user selection into financial forms (Modal/Transfer) for role-based cash handling.

## State
- **Done**: 
  - Backend and frontend support for Admin, Kasir, and Mekanik roles.
  - Premium User Management UI with stats and profile details.
  - Cash Per User: Database schema updated, service logic implemented, and API endpoints enhanced.
  - Mutasi Kas UI updated with user cash breakdown and user-specific transaction forms.
  - **User Wallets Screen**: Created a dedicated dashboard for per-user cash balances with filter and transfer integration.
  - **SMTP Settings**: Added global SMTP configuration for Gmail, including Backend model, API with test connection feature, and dedicated Frontend settings page.
- **Now**:
  - Verification of deep-linking from User Wallets to filtered transaction lists.
- **Next**:
  - Implement a "Tutup Kasir" (Cashier Closing) report feature.

  - Review remaining forms for hardcoded color values.
  - Verify "Tutup Kasir" handles all user wallets simultaneously or per cashier.

## Open Questions
- Should we implement a "pending transfer" logic where the receiver must accept the cash? (Currently immediate).

## Working Set
- `backend/app/services/kas_bank_service.py`
- `backend/app/api/v1/kas_bank.py`
- `frontend/app/finance/user-wallets.tsx`
- `frontend/app/finance/mutasi.tsx`
- `frontend/components/WalletSection.tsx`
- `frontend/services/keuangan.ts`
