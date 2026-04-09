# Continuity Ledger - TPM Workshop Project

## Goal (incl. success criteria)
Ensure complete financial transparency by integrating all operational unit cash accounts into reports and clarifying the flow of general expenses.
Success criteria:
- Neraca and Perubahan Modal reports display all unit cash accounts (Bengkel, Jasa Angkut, Mobil) regardless of balance.
- General (Umum) expenses are correctly mapped and visible across Profit & Loss, Balance Sheet, and Capital reports.
- Reconciliation logic is transparent and verifiable.

## Constraints/Assumptions
- Cash is tracked in unit-specific accounts (KAS_UNIT_...) and central accounts.
- The system uses accounting identity `Modal = Aktiva - Hutang` for the Balance Sheet.
- General expenses (bisnis_kategori='umum') are tracked via `PengeluaranService`.

## Key decisions
- Updated backend `get_neraca` and `get_capital_report` to initialize `unit_details` with all unit keys (bengkel, jasa_angkut, mobil) with default 0.
- Standardized frontend display in `neraca.tsx` and `perubahan-modal.tsx` to always show the unit breakdown.

## State
- **Now**:
    - Explaining the reporting flow of "Umum" category expenses.
- **Done**:
    - Fixed zero-balance unit visibility in Neraca and Perubahan Modal reports.
    - Verified backend aggregation logic for unit-specific cash.
- **Next**:
    - Add a dedicated "Overhead Umum" section in Laba Rugi if needed for better clarity.

## Open questions (UNCONFIRMED)
- Does the user want a dedicated section for "Pengeluaran Umum" in the Laba Rugi report, or is the current aggregation sufficient?

## Working set (files/ids/commands)
- backend/app/api/v1/dashboard.py
- frontend/app/laporan/neraca.tsx
- frontend/app/laporan/perubahan-modal.tsx
- frontend/app/laporan/laba-rugi.tsx
- backend/app/services/pengeluaran_service.py

