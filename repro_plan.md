# Implementation Plan - Fix Financial Balance Display

The user reported that the "Akumulasi Seluruh Akun" on the `finance/mutasi` page displays `Rp.0,00` even though there should be a balance. Investigation revealed that the `mutasi.tsx` file uses lowercase keys to access the balance object, while the backend returns uppercase keys (matching the `KasBankJenis` type).

## Proposed Changes

### Frontend

#### 1. Update `frontend/app/finance/mutasi.tsx`
- Change `balances?.cash?.saldo + balances?.bank_bca?.saldo` to `balances?.total_saldo`.
- Update `ACCOUNT_FILTERS` values to uppercase.
- Update `JENIS_LABEL` keys to uppercase.
- Update `transferForm` and `modalForm` initial states and selection logic to use uppercase identifiers.
- Ensure all references to `KasBankJenis` values use uppercase strings.

## Verification Plan

### Automated Tests
- N/A (Manual verification required as it's a UI issue)

### Manual Verification
- Open the Mutasi Kas page.
- Verify "Total Likuiditas" / "Akumulasi Seluruh Akun" displays the correct non-zero balance.
- Verify the list of transactions displays correct account labels (e.g., "Cash" instead of nothing).
- Verify the "Transfer" and "Setoran Modal" forms work with the updated identifiers.
