# Continuity Ledger - Kasbon & Frontend Stability

## Goal
1. Standardize identifier generation to prevent UI state collisions (collision-resistant unique IDs).
2. Stabilize Kasbon reporting to maintain a balanced Neraca (Balance Sheet).

## Constraints/Assumptions
- Frontend-only IDs (`Date.now()`) were causing duplicate key collisions during rapid user input.
- Backend defaults Kasbon to 'BENGKEL' unit but funds come from Corporate (`KAS_UTAMA`).

## Key Decisions
- **ID Hardening**: Standardized `Date.now() + Math.random()` across all dynamic list rendering logic.
- **Audit Tool**: Created `analyze_duplicates.py` to systematically verify codebase compliance.
- **Persistent Context**: Established `.agent/` folder with detailed documentation (`CONTEXT.md`, `ACCOUNTING_RULES.md`, etc.) to stabilize AI reasoning across sessions.
- **Kasbon Routing**: Decoupled fund source (`KAS_UTAMA`) from reporting unit (`BENGKEL`) using the `payments` array to ensure accurate asset classification.

- **Done**: Resolved Neraca discrepancy by excluding Kasbon from 'Modal Non-Kas' (capital discovery) logic.
- **Done**: Fixed "Insufficient Balance" in Kasbon by ensuring the backend respects explicit `kas_jenis` routing from the frontend.
- **Now**: Final verification of Balance Sheet stability.
- **Next**: Monitor system for any further accounting anomalies.

## Working Set
- `backend/app/Services/reports/neraca_service.py`
- `backend/app/Services/kasbon_service.py`
- `frontend/app/sdm/kasbon.tsx`
- `scratch/analyze_duplicates.py`

