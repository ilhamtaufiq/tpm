# Continuity Ledger - TPM Local Development
 
## Goal
- Fix missing "Beban Gaji" (Salary Expense) in the Laba Rugi (Profit and Loss) report.
- Align public digital receipt display with the thermal printer receipt format.
- Implement PDF download for public receipts with custom filenames.
 
## Constraints/Assumptions
- Salary data is fetched from `SlipGaji` model via `SlipGajiService`.
- Only `LUNAS` (Paid) salaries are included in the report.
- The public receipt mirrors the physical layout (monospace, dashed lines, simplicity).
- PDF Filename format: `nomor_transaksi-nama_pelanggan-nomor_polisi-tanggal.pdf`.
 
## Key Decisions
- Found that `backend/app/api/v1/dashboard.py` was merging salary summary incorrectly; updated to deep-merge all summary fields.
- Refactored `PublicReceiptPage` (frontend) and `generate_html_receipt`/`generate_receipt_image` (backend) to use a thermal printer aesthetic.
- Implemented `get_receipt_pdf` in `backend/app/api/v1/public_receipt.py` using **ReportLab**.
- Set `Content-Disposition` on backend and specific `fileUri` on frontend (via `downloadAsync`) to enforce the requested filename format.
 
## State
- **Done**: 
    - Fixed salary merging logic in `backend/app/api/v1/dashboard.py`.
    - Renamed "Biaya Gaji" to "Beban Gaji" for accounting professional terminology.
    - Updated `PublicReceiptPage` to use thermal printer style.
    - Updated backend HTML receipt and OG Image to match thermal printer style.
    - Implemented PDF download with filename format: `nomor_transaksi-nama_pelanggan-nomor_polisi-tanggal`.
- **Now**: Handing off to user.
- **Next**: Await user feedback.
 
## Open Questions
- None at the moment.
 
## Working Set
- `frontend/app/laporan/laba-rugi.tsx`
- `backend/app/api/v1/dashboard.py`
- `frontend/app/receipt/[type]/[id].tsx`
- `backend/app/api/v1/public_receipt.py`
