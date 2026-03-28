# Continuity Ledger

## Goal
Resolve the zero-balance issue in the workshop dashboard, remove legacy BOP categories, and enhance the workshop wallet modal for transaction-level transparency and easy cash adjustments.

## Status
- **Done**: 
    - Implemented automatic `KasBank` recording for `LUNAS` workshop transactions in `TransaksiBengkelService`.
    - Performed retroactive data sync (Verified `KAS_UNIT_BENGKEL` balance is correct).
    - Removed `BOP_...` legacy accounts from backend (`constants.py`, `dashboard.py`) and frontend (`keuangan.ts`, `expenses/index.tsx`, `mutasi.tsx`).
    - Fixed `AttributeError: BOP_MOBIL_CASH` in `PenjualanMobilService.get_summary` by mapping it to `KAS_UNIT_MOBIL`.
    - **Header Cleanup**: Removed the balance pill from the workshop dashboard header for a cleaner UI.
    - **Wallet Modal Enhancement**:
        - Integrated transaction-level summary (Total Tunai vs Total Transfer) based on selected period filters.
        - Implemented **Dual-Mode Adjustment Form** (Dana Keluar vs Dana Masuk) to support both expenses and manual cash corrections.
        - Refined "Setoran Unit" and "Catat Biaya" actions for better clarity.
    - **Summary Enhancement**: Updated `TransaksiBengkelService.get_summary` to include `total_dana_masuk` and `total_dana_keluar` tracking.
    - **Backend API Fix**: Resolved a `NameError (KasBankJenis)` that was causing the `/summary` API to crash and return 0 for all totals (Total Tunai, Transfer, Dana Masuk).
    - **Balance Transparency**: Adjusted the UI to only show `Total Dana Masuk Utama` per user request, hiding the office balance.
- **Now**: Verify real-time testing—totals should now correctly populate automatically.
- **Next**: Monitor real-time balance updates during new workshop transactions.

## Key Decisions
- **Unit-Level Liquidity**: Each unit (Bengkel, Jasa Angkut, Mobil) handles its own cash for operational needs before depositing to `BANK_UTAMA`.
- **Flexible Adjustments**: Provided a direct way for managers to correct workshop cash balances (In/Out) without navigating through complex finance modules.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- `backend/app/services/transaksi_bengkel_service.py`
- `frontend/app/bengkel/index.tsx`
- `CONTINUITY.md`
