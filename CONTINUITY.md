# Continuity Ledger

- Goal: Fix Wallet Balance Updates for Receivables and Down Payments (DP)
  - Ensure "Hasil Jual (Tunai)" correctly increases when a piutang is paid or DP is received.
  - Route unit-specific cash transactions to `KAS_UNIT_BENGKEL`, `KAS_UNIT_MOBIL`, or `KAS_UNIT_JASA_ANGKUT`.

- Constraints/Assumptions:
  - System uses unit-specific ledger accounts (`KAS_UNIT_...`) for physical cash tracking.
  - `PiutangService.process_payment_split` is already updated to honor `kas_jenis`.
  - Frontend components must explicitly specify the cash account to avoid defaulting to the main account.

- Key decisions:
  - Field name is standardized to `kas_jenis` (matching the backend schema).
  - `PaymentModal` will be updated to accept a `kas_jenis` prop, as it is a shared component.
  - Backend services will be updated to propagate `kas_jenis` from the schema to the ledger integration.

- State:
  - Done:
    - Updated `PiutangService` to support `kas_jenis`.
    - Updated `keuangan.py` schema to include `kas_jenis`.
    - Mapped `KaryawanSelector` for "Kasbon" logic in all units.
  - Now:
    - Standardizing `kas_jenis` field across all frontend forms and shared components.
    - Updating `mobil.py` and `bengkel.py` schemas to support `kas_jenis` in split payment items.
    - Updating remaining backend services specifically for penjualan (Mobil) and muatan (Jasa Angkut).
  - Next:
    - Validate fix by checking "Hasil Jual (Tunai)" balance in the business unit wallets.

- Open questions:
  - None at this moment.

- Working set:
  - `backend/app/schemas/mobil.py`
  - `backend/app/schemas/bengkel.py`
  - `backend/app/services/penjualan_mobil_service.py`
  - `backend/app/services/muatan_service.py`
  - `frontend/components/PaymentModal.tsx`
  - `frontend/components/BengkelForm.tsx`
  - `frontend/components/MobilSalesForm.tsx`
  - `frontend/app/bengkel/index.tsx`
  - `frontend/app/mobil/index.tsx`
  - `frontend/app/jasa-angkut/index.tsx`
