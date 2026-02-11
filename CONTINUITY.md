# Ledger Snapshot
- **Goal**: Fix Piutang (Accounts Receivable) creation and settlement logic across the application.
- **Now**: Resolved `AttributeError` by standardizing `nomor_referensi` and fixed settlement API validation. Added unpaid info pills and settlement UI.
- **Next**: Verify the end-to-end flow of creating a transaction with partial payment and then settling it.
- **Open Questions**: None.

# Continuity Ledger
- **Goal (incl. success criteria)**:
  - Correct `PiutangUsaha` record creation in workshop, car sales, and cash advance services.
  - Implement functional AR settlement (Pelunasan Piutang) in the Bengkel screen.
  - Resolve "Unexpected text node" crashes in the frontend via safe conditional rendering.
  - Ensure backend parity between frontend requests and API schemas.
- **Constraints/Assumptions**:
  - `PiutangUsaha` model uses `nomor_referensi` (not `referensi_nomor`).
  - React Native/Expo frontend requires ternary operators for conditional rendering to avoid boolean nodes.
- **Key decisions**:
  - Implemented `_generate_nomor_piutang` in each service for localized control.
  - Refactored `update_payment` API to use a Pydantic schema for the request body.
  - Added visual "Unpaid" indicators (info pills) to the Bengkel screen for better UX.
- **State**:
  - Done:
    - Fixed `PiutangUsaha` instantiation in `TransaksiBengkelService`, `PenjualanMobilService`, and `KasbonService`.
    - Standardized filter field names to `nomor_referensi`.
    - Fixed conditional rendering in `BengkelForm.tsx`, `BengkelScreen.tsx`, and `ThermalReceipt.tsx`.
    - Added "Pelunasan Piutang" settlement feature in `BengkelScreen.tsx`.
    - Fixed API validation error for settlement by adding `PaymentUpdate` schema.
  - Now: Monitoring for any remaining field name mismatches.
  - Next: Verify flow for Car Sales and Jasa Angkut if needed.
- **Open questions (UNCONFIRMED if needed)**:
  None.
- **Working set (files/ids/commands)**:
  - `backend/app/services/transaksi_bengkel_service.py`
  - `backend/app/schemas/bengkel.py`
  - `backend/app/api/v1/transaksi_bengkel.py`
  - `frontend/app/bengkel/index.tsx`
  - `backend/app/models/keuangan.py`
