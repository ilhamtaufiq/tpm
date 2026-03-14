# Continuity Ledger

## Goal
Ensure all financial obligations related to car sales (including workshop parts, unit management costs, and investor disbursements) are correctly settled and accounted for upon sale. Build accurate financial reporting reflecting these settlements.

## Constraints/Assumptions
- Backend: FastAPI + SQLAlchemy + MySQL
- Frontend: React Native (Expo) + NativeWind
- Mobile-first app (TPM business management)

## Key Decisions
- **DP Handling**: `p_mobil_direct_cash` subtracts direct cash from gross piutang in LPM
- **Workshop Piutang Settlement**: Bilateral KasBank entries (MASUK bengkel / KELUAR JB Mobil) on car sale
- **Hutang Settlement**: Only mark LUNAS, NO KasBank entry (cost already recorded when incurred)
- **Piutang Part Jual Mobil**: Now filters by `Mobil.status != TERJUAL` — only unsold cars show
- **Section A Laba**: Uses FULL `laba_kotor_mobil` (investor+TPM share), not just `laba_tpm`. Investor payout tracked separately in Section C.
- **Internal Bilateral Exclusion**: Section C excludes all `PaymentMethod.INTERNAL` entries from JB Mobil outflows
- **Investor Disbursement**: New mechanism with status tracking (BELUM_DICAIRKAN / DICAIRKAN), KasBank KELUAR on actual disbursement

## State
### Done
- Fixed DP discrepancy in LPM
- Settled internal workshop piutangs on car sale
- Settled unit hutangs (BBN, pajak) on car sale — no phantom KasBank
- Fixed Piutang Part Jual Mobil to exclude sold cars
- Fixed Section A to use full laba (including investor share)
- Excluded INTERNAL bilateral entries from Section C
- Added investor disbursement mechanism (model, migration, service, API)
- Fixed duplicate index migration error (`ix_jasa_angkut_biaya_lainnya_tanggal`) by deleting redundant migration `20260313_001553`
- Fixed receipt print paper size (80mm/58mm) in preview by correcting units from pixels to points for Expo Print and enforcing mm units in CSS.

### Now
- Backend for investor disbursement complete
- Frontend page for investor disbursement pending (can be built when needed)

### Next
- Build frontend UI for `/finance/pencairan-investor` page
- Test full reconciliation flow end-to-end
- Verify penyesuaian is Rp.0 after fixes

## Open Questions
- UNCONFIRMED: Is the Rp.4,442,500 penyesuaian fully resolved after adding laba_investor to Section A?

## Working Set
- `backend/app/models/mobil.py` — TransaksiPenjualanMobil with disbursement fields
- `backend/app/services/penjualan_mobil_service.py` — settlement + disbursement methods
- `backend/app/api/v1/penjualan_mobil.py` — disbursement API endpoints
- `backend/app/api/v1/dashboard.py` — LPM capital report fixes
- `backend/app/utils/constants.py` — InvestorDisbursementStatus enum
- `backend/app/schemas/mobil.py` — TransaksiMobilResponse with disbursement fields
- `backend/alembic/versions/20260313_001000_add_investor_disbursement_fields.py` — migration (Redundant migration 20260313_001553 deleted)
