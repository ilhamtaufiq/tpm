# Continuity Ledger - Workshop UI/UX & Financial Optimization

## Goal (incl. success criteria):
- Standardize workshop financial reporting and form logic.
- Improve UI/UX by moving administrative actions into a prominent 'Service Grid'.
- Success: Professional, bento-style dashboard for workshop operations.

## Constraints/Assumptions:
- Business units need quick access to Wallet, Inventory, and Master Data.
- Financial transactions must distinguish between unit cash and internal company movements.

## Key decisions:
- [UI/UX] Slimmed down the Blue Header to a minimal height, removed all statistics from it.
- [UI/UX] Moved Unit Statistics (Antre, Proses, Selesai) into a row of three elegant, non-scrolling metric cards at the top of the content area.
- [UI/UX] Reordered the content: Search & Filters -> Metric Cards -> Service Grid (Quick Actions) -> Section Header -> Date Picker -> Transaction List.
- [UI/UX] Polished the Service Grid to a premium 'Bento' style: 2x2 grid, white icon containers, colored icons, and consistent labels.
- [Backend/Finance] Map `INTERNAL` transactions to central cash (`KAS_UTAMA`) to prevent reporting discrepancies in unit-level physical cash drawers.

### State & Progress
- **Done**:
    - Bento-style Service Grid implementation (Bengkel, Mobil, Jasa Angkut).
    - Header slim-down and stats relocation (Bengkel, Mobil, Jasa Angkut).
    - TypeScript error resolution (specifically the `sheetIndex` reference error).
    - Consistency across all business unit dashboards (Modernized FAB, Standardized Padding, Unified Layout).
- **Now**: Work complete. Monitoring for interaction polish.
- **Next**: Ensuring performance stability across low-end Android devices for the new layout.

## Working set (files/ids/commands):
- `frontend/app/bengkel/index.tsx`
- `frontend/components/BengkelForm.tsx`
- `backend/app/services/kas_bank_integration.py`
