# Continuity Ledger - TPM Local Development
 
## Goal
- Fix missing "Beban Gaji" (Salary Expense) in the Laba Rugi (Profit and Loss) report.
- Align public digital receipt display with the thermal printer receipt format.
- Resolve double-counting of car capital costs in P&L and Neraca reports.
- Synchronize system-wide print settings between Web and Mobile platforms.
 
## Constraints/Assumptions
- Salary data is fetched from `SlipGaji` model via `SlipGajiService`.
- Only `LUNAS` (Paid) salaries are included in the report.
- The public receipt mirrors the physical layout (monospace, dashed lines, simplicity).
- PDF Filename format: `nomor_transaksi-nama_pelanggan-nomor_polisi-tanggal.pdf`.
 
## Key Decisions
- Found that `backend/app/api/v1/dashboard.py` was merging salary summary incorrectly; updated to deep-merge all summary fields.
- Refactored `PublicReceiptPage` (frontend) and `generate_html_receipt`/`generate_receipt_image` (backend) to use a thermal printer aesthetic.
- Fixed `NameError` in `backend/app/api/v1/settings.py` which prevented Web/Mobile synchronization.
- Excluded car management costs from `total_beban` in both Neraca and P&L endpoints to prevent double-counting.
 
## State
- **Done**: 
    - Fixed salary merging logic in `backend/app/api/v1/dashboard.py`.
    - Resolved double-counting in Neraca by excluding capitalized car costs from `total_beban`.
    - Resolved double-counting in P&L (`profit-summary`) by excluding car management costs from general ops.
    - Split HPP in Laba Rugi UI to show "Harga Beli" vs "Biaya Lainnya".
    - Fixed `NameError` bug in Settings API to enable Web/Mobile synchronization.
    - Implemented PDF download with specific filename format for receipts.
- **Now**: Verifying that financial figures match manual calculations for cars.
- **Next**: Final verification of print settings synchronization across devices.
 
## Open Questions
- None at the moment.
 
## Working Set
- `frontend/app/laporan/laba-rugi.tsx`
- `backend/app/api/v1/dashboard.py`
- `frontend/app/receipt/[type]/[id].tsx`
- `backend/app/api/v1/public_receipt.py`
