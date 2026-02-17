# Continuity Ledger

## Goal
1. Refactor Bengkel (Workshop) feature to add a **kategori** (category) field.
2. Refine Jasa Angkut profitability to correctly reflect TPM's profit (pendapatan_kotor - laba_supir) and report on an accrual basis.
3. Implement centralized Hutang (Payables) tracking for spare parts and car purchases on credit.

### Success Criteria
- Bengkel transactions have a `kategori` field (jasa_angkut / jual_beli_mobil / umum)
- BengkelForm allows selecting category and linking to relevant muatan/mobil
- The integration flow from Jasa Angkut and Mobil TO bengkel is removed
- Transaction detail in bengkel still shows category info
- Financial flow remains unchanged

## Constraints/Assumptions
- Backend `TransaksiPenjualanBengkel` model does NOT have a `kategori` column yet → needs migration
- Backend schema `TransaksiBengkelCreate` does NOT have `kategori` yet → needs update
- Frontend-only changes for now, with backend schema + model updates
- This is a frontend + backend full-stack change

## Key Decisions
- Three categories: "umum" (default/legacy), "jasa_angkut", "jual_beli_mobil"
- Adding `kategori`, `muatan_id`, `mobil_id` columns to `TransaksiPenjualanBengkel`
- Category selector at top of BengkelForm
- When "jasa_angkut" selected: show muatan/transport transaction picker
- When "jual_beli_mobil" selected: show mobil (car) picker
- "umum" is default for backward compatibility
- Remove `addBengkelTransaction` integration from mobil service/hooks
- Remove bengkel section from jasa angkut detail view  

## State
- Done: 
  - Implementation of conditional visibility in `BengkelForm.tsx`.
  - Backend updates for muatan relationship in Bengkel transactions.
  - Frontend display updates for transport transaction number in Bengkel details.
  - Updated `RelatedBengkelTransactions.tsx` to show service/part details.
  - Fixed Rp.0,00 total in Bengkel card header by ensuring proper API serialization.
  - Fixed 0 Operational Cost on Jasa Angkut trips by including workshop maintenance costs in profit calculation.
  - **Absensi & Gaji Improvements (Item 7):**
    - Added `SETENGAH_HARI` status to attendance.
    - Implemented pro-rated salary formula: `(Gaji Pokok / 25) * Hadir`.
    - Updated backend services and frontend UI (Absensi toggle, Payroll input) to support float attendance values.
  - **Jasa Angkut & Hutang Refinement & Reports:**
    - Modified `MuatanService.get_summary` to report on an accrual basis (including unpaid) and exclude `laba_supir` from company revenue.
    - Implemented `HutangUsaha` and `PembayaranHutang` models and services.
    - Integrated credit purchases in `PembelianPartService` and `MobilService` with automatic Hutang record creation.
    - Added Hutang API endpoints for tracking and settling liabilities.
    - Added `HutangUsahaScreen` to the frontend for managing payables.
    - Integrated Hutang into Dashboard summaries and Finance hub.
    - Fixed TypeScript errors in `hutang.tsx` and `perubahan-modal.tsx`  - Now:
    - Responding to user request to change grouping format to "Nama Kendaraan - Jenis/Tipe" (per-unit grouping).
  - Fixed:
    - Jasa Angkut grouping showing "Armada Luar" for registered fleets by adding `joinedload(MuatanJasaAngkut.armada)` in backend service.
    - Implemented grouping of Jasa Angkut transactions by **Armada Type** (Jenis) instead of individual vehicles.
    - Updated Jasa Angkut screen to show type-based headers (e.g., "Armada Truk", "Armada Colt").
    - Renamed "Armada Luar / Manual" group to "Armada Luar" for clarity.
    - Included total group revenue in the header.
    - Added 'Hutang' (Credit) payment option in `Pembelian Part` form, enabling credit purchases that automatically generate `HutangUsaha` records.
    - **Fixed:** Backend logic in `PembelianPartService` now correctly identifies credit purchases by explicitly checking against pay-now methods (Tunai/Transfer), ensuring `HutangUsaha` records are created even if `metode_bayar` case varies or is new.
    - Added "E. HUTANG / KEWAJIBAN" section to the Capital Change Report (Laporan Perubahan Modal) to display unpaid payables (Part, Mobil, Investor, Lainnya) which effectively increases cash on hand availability relative to expenses booked.
    - **Fixed:** Finance Hub dashboard now correctly displays Cash and Bank BCA balances by using uppercase keys (`CASH`, `BANK_BCA`) to match backend enums, and improved the layout of Total Saldo, Piutang, and Hutang cards to prevent text clipping.
    - Added Split Payment feature for Hutang Usaha, allowing users to pay a single debt using multiple payment methods (e.g., partial Tunai and partial Transfer) simultaneously.
    - Updated Kasbon list card to show employee name more prominently and added a delete button for unpaid kasbon records, enhancing data management flexibility.
  - **UI/UX Polish:**
    - Redesigned "Biaya Operasional" page with Premium Bento UI, including a dark premium header and monthly summary stats.
    - Implemented currency formatting (thousand separators) and "Rp" prefix for the expense amount input.
- Now:
  - Adding 'reset hutang' (reset debt) to the 'reset transaksi' (reset transaction) feature.
  - Updating `MaintenanceService` in the backend to clear `HutangUsaha` and `PembayaranHutang` tables.
- Next:
  - Verify if any other tables need resetting.
  - Final user verification.

## Open Questions
- None.

## Working Set
- `frontend/components/BengkelForm.tsx`
- `frontend/app/bengkel/index.tsx`
- `frontend/components/RelatedBengkelTransactions.tsx`
- `backend/app/Models/bengkel.py`
- `backend/app/schemas/bengkel.py`
- `backend/app/services/transaksi_bengkel_service.py`
