# Continuity Ledger - TPM Workshop Project

## Goal (incl. success criteria)
Ensure complete financial transparency by integrating all operational unit cash accounts into reports and clarifying the flow of general expenses.
Success criteria:
- Neraca and Perubahan Modal reports display all unit cash accounts (Bengkel, Jasa Angkut, Mobil) regardless of balance.
- General (Umum) expenses and Armada-specific Jasa Angkut costs are correctly mapped and visible across Profit & Loss, Balance Sheet, and Capital reports.
- Reconciliation logic is transparent and verifiable.
- Administrative tools (Users, Settings) are complete and functional.

## Constraints/Assumptions
- Cash is tracked in unit-specific accounts (KAS_UNIT_...) and central accounts.
- The system uses accounting identity `Modal = Aktiva - Hutang` for the Balance Sheet.
- Jasa Angkut operational costs from PengeluaranBengkel are grouped by `armada_id`.

## Key decisions
- Updated `PengeluaranService.get_summary` to provide an armada-level breakdown for Jasa Angkut expenses.
- Updated `perubahan-modal.tsx` (UI & PDF) to show "biaya operasional per armada".
- Updated `laba-rugi.tsx` (UI) for consistency.
- Standardized frontend display in `neraca.tsx` and `perubahan-modal.tsx` to always show the unit breakdown.
- Implemented **User Deletion** feature in `users.tsx` with confirmation dialogs.
- Fixed TypeScript/Type errors in `users.tsx` (Button props, AlertDialog variant) and `perubahan-modal.tsx` (Row component className prop).

## State
- **Now**:
    - Finalizing UI verifications and addressing user requests.
- **Done**:
    - Refactored `frontend/components/MobilForm.tsx` to handle multi-account payments (`sumberBayar`: Unit Tunai, Utama Tunai, Utama Transfer, Split).
    - Updated `MobilCreate` schema in `backend/app/schemas/mobil.py` to accept `kas_jenis`.
    - Integrated `kas_jenis` injection into `kas_bank` ledger inside `backend/app/services/mobil_service.py` during car purchases.
    - Redesigned `neraca.tsx` UI layout adhering to Stitch UI Design principles without altering the logical values.
    - Redesigned `laba-rugi.tsx` UI layout adhering to Stitch UI Design principles without altering the logical values.
    - Redesigned `perubahan-modal.tsx` UI layout adhering to Stitch UI Design principles (modern glassmorphic, neater cards, and structured groupings) without altering the logical values.
    - Changed payment options in Pembelian Sparepart to support both Akun Bengkel (Cash) and Akun Utama (Cash & Bank), while maintaining split payment capabilities and Hutang option.
    - Changed payment options in Armada Operational Expense to support KAS_UNIT_JASA_ANGKUT, KAS_UTAMA, and BANK_UTAMA.
    - Handled kas_jenis dynamically based on the selected payment method across modules.
- **Next**:
    - Project handover or further feature requests from user.

## Open questions (UNCONFIRMED)
- None at the moment.

## Working set (files/ids/commands)
- frontend/app/bengkel/purchase/index.tsx
- frontend/app/laporan/neraca.tsx
- frontend/app/laporan/perubahan-modal.tsx
- frontend/app/laporan/laba-rugi.tsx
- backend/app/services/pengeluaran_service.py
- frontend/app/settings/users.tsx
- frontend/.agent/workflows/skills/stitch-ui-design/SKILL.md
