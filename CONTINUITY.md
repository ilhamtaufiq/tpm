# Continuity Ledger - Business Unit UI Refactor

## Goal
Refactor the UI of financial and business unit screens to move header-specific content (cards, summaries) from the fixed `Header` component directly into the scrollable page content. This aligns with the Bento-style layout used in other modules.

## Constraints/Assumptions
- Use `Header` component for fixed navigation (title, back button, profile).
- Move summary cards (Profit, Liquidity) into `ScrollView` (Bengkel/Mobil) or `FlatList` `ListHeaderComponent` (Mutasi).
- Adjust styling of moved content from "Glassmorphism" (on blue) to "Standard Card" (on light background) if necessary.
- Maintain Bento-style consistency across all modules.

## Key Decisions
- Goal: Relocate header-specific content (title, metrics, tabs) into the main scrollable page layouts across Business Units (Bengkel, Mobil, Jasa Angkut) and Finance modules.
- Constraints/Assumptions:
  - Header component remains for basic navigation (Back button, Title).
  - Heavy header content (Insight Cards, Tabs) moved to Bento-style cards on the main surface.
  - Safe area handling and "overlap" styling (-mt-8) maintained for visual continuity.
- Key decisions:
  - Use white Bento cards for integrated insights (Summary Cards) on the surface background.
  - Position tabs/search as fixed elements below the header with an overlap effect.

## State
- Done:
  - [x] Refactor `frontend/app/bengkel/index.tsx` (Pre-existing/Refined)
  - [x] Refactor `frontend/app/mobil/index.tsx`
  - [x] Refactor `frontend/app/jasa-angkut/index.tsx`
  - [x] Refactor `frontend/app/finance/mutasi.tsx`
  - [x] Refactor `frontend/app/(tabs)/finance.tsx`
  - [x] Refactor `frontend/app/finance/laporan.tsx`
  - [x] Refactor `frontend/app/finance/piutang.tsx`
  - [x] Refactor `frontend/app/finance/hutang.tsx`
- Now:
  - Verifying consistency across all modules.
- Next:
  - Final polish and testing of navigation/profile access.

## Open Questions (UNCONFIRMED)
- None at the moment.

## Working Set
- `frontend/app/finance/piutang.tsx`
- `frontend/app/finance/hutang.tsx`
- `frontend/app/finance/laporan.tsx`
- `frontend/app/finance/mutasi.tsx`
- `frontend/app/(tabs)/finance.tsx`
