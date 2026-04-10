# Continuity Ledger - TPM Workshop Project

## Goal (incl. success criteria)
Ensure complete financial transparency by integrating all operational unit cash accounts into reports and clarifying the flow of general expenses.
Success criteria:
- Neraca and Perubahan Modal reports display all unit cash accounts (Bengkel, Jasa Angkut, Mobil) regardless of balance.
- General (Umum) expenses and Armada-specific Jasa Angkut costs are correctly mapped and visible across Profit & Loss, Balance Sheet, and Capital reports.
- Reconciliation logic is transparent and verifiable.

## Constraints/Assumptions
- Cash is tracked in unit-specific accounts (KAS_UNIT_...) and central accounts.
- The system uses accounting identity `Modal = Aktiva - Hutang` for the Balance Sheet.
- Jasa Angkut operational costs from PengeluaranBengkel are grouped by `armada_id`.

## Key decisions
- Updated `PengeluaranService.get_summary` to provide an armada-level breakdown for Jasa Angkut expenses.
- Updated `perubahan-modal.tsx` (UI & PDF) to show "biaya operasional per armada".
- Updated `laba-rugi.tsx` (UI) for consistency.
- Standardized frontend display in `neraca.tsx` and `perubahan-modal.tsx` to always show the unit breakdown.

## State
- **Now**:
    - Finalizing the implementation of "biaya operasional per armada" for Jasa Angkut.
- **Done**:
    - Fixed zero-balance unit visibility in Neraca and Perubahan Modal reports.
    - Integrated granular armada-specific breakdowns for Jasa Angkut operational costs.
    - Updated backend services and API endpoints to support granular reporting.
- **Next**:
    - Monitor user feedback on the new report granularity.

## Open questions (UNCONFIRMED)
- None at the moment.

## Working set (files/ids/commands)
- backend/app/api/v1/dashboard.py
- frontend/app/laporan/neraca.tsx
- frontend/app/laporan/perubahan-modal.tsx
- frontend/app/laporan/laba-rugi.tsx
- backend/app/services/pengeluaran_service.py
