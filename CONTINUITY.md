# Continuity Ledger - TPM Project

## Goal
Implement a comprehensive User Management system (Admin, Cashier, Mechanic) and unify operational costs into the Bengkel Expenses system. Ensure the UI adheres to the Premium Bento Layout and supports dynamic theme colors.

## Constraints/Assumptions
- Workshop expenses are now primarily linked to `armada_id` or `mobil_id` within the `PengeluaranBengkel` system.
- User roles now include `ADMIN`, `KASIR`, `MEKANIK`, `MANAGER`, `STAFF`.
- UI must follow the "Premium Bento Layout" with large rounded corners and dynamic colors from `useUIStore`.

## Key Decisions
- **User Management**: Updated `UserRole` enum and database schema to support new roles.
- **User Management**: Implemented `users.tsx` with a premium bento design, stats dashboard, and role-based visualization.
- **Dynamic Styling**: Replaced hardcoded `#023C69` with `themeColors.primary` from `useUIStore` across key files (`users.tsx`, `index.tsx`, `all-menus.tsx`, `home.tsx`, `customer.tsx`, `Button.tsx`, `StatsSlider.tsx`).
- **Backend Architecture**: Unified all operational costs (Armada and Mobil) into `PengeluaranBengkel` records.

## State
- **Done**: 
  - Backend and frontend support for Admin, Cashier, and Mechanic roles.
  - Premium User Management UI with stats and profile details.
  - Refined theme support: ensured core pages respect dynamic primary/secondary colors from appearance settings.
  - Unified operational costs aggregation in Armada and Mobil views.
- **Now**: 
  - Standardizing dynamic color usage across all remaining tactical components.
- **Next**:
  - Test role-based access control (RBAC) specifically for Cashiers and Mechanics.
  - Review remaining forms for hardcoded color values.

## Open Questions
- Should Mechanics have limited access to car sales data? (Likely yes, restricted to technical details).

## Working Set
- `frontend/app/settings/users.tsx`
- `frontend/app/all-menus.tsx`
- `frontend/store/useUIStore.ts`
- `frontend/app/index.tsx`
- `frontend/components/ui/Button.tsx`
- `frontend/components/StatsSlider.tsx`
- `frontend/app/master-data/customer.tsx`
