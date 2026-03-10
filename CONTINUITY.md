# Goals
- Correct Balance Sheet (Neraca) and Capital Change Report (LPM) logic regarding car part/service costs.
- Avoid double-counting of workshop costs as both inventory and receivables.
- Ensure profit calculations remain correct (net of parts).
- Improve Frontend profit estimation display in `MobilSalesForm.tsx`.

# Progress
- **Backend `dashboard.py`**:
    - Modified `get_neraca` to exclude `stok_mobil_part_service` from `stok_mobil_total` (Inventory).
    - Modified `get_capital_report` (section_a) to use `total_modal_excluding_parts` for `hpp_mobil`.
- **Backend `penjualan_mobil_service.py`**:
    - Added `total_modal_excluding_parts` to the `get_summary` return value.
- **Frontend `MobilSalesForm.tsx`**:
    - Fixed numeric parsing bug (replaced `parseFloat(String(...))` with `Number(...)`).
    - Redesigned "Estimasi Laba" card to show a detailed breakdown:
        - Harga Jual
        - Harga Beli Unit
        - Biaya Pengeluaran (Pajak, BBN, etc.)
        - Biaya Sparepart dan Servis
        - Biaya Operasional Tambahan (if any)
    - Ensured profit is shown clearly as the final result.

# Key Decisions
- Parts/Service costs for cars are now strictly categorized as Workshop Receivables (Piutang Bengkel) in the Balance Sheet, and are excluded from the "Stock Mobil" asset value to prevent double-counting.
- In the Capital Change Report, the HPP for car sales now explicitly excludes parts to match the "Basis" of the physical unit, while workshop costs are tracked separately in the Piutang/Expenses sections.
- Frontend estimation now uses `Number()` instead of `parseFloat()` for safer handling of API-returned values and avoids string concatenation bugs.

# State
- **Done**: Backend logic updates and Frontend display enhancements. verified logic consistency.
- **Now**: Finalizing documentation.
- **Next**: Final review of the reports by the user.

# Working set
- `backend/app/api/v1/dashboard.py`
- `backend/app/services/penjualan_mobil_service.py`
- `frontend/components/MobilSalesForm.tsx`
- `backend/app/models/mobil.py`
- `frontend/utils/format.ts`
