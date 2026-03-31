# Continuity Ledger - Role-Based Redirection Implementation

## Goal
Implement role-based redirection for users with roles `BENGKEL`, `JASA_ANGKUT`, and `MOBIL` so they land directly on their respective module index pages and cannot access the home page.

## Constraints/Assumptions
- Roles are: `BENGKEL`, `JASA_ANGKUT`, `MOBIL` (Uppercase from backend).
- Target pages: `/bengkel`, `/jasa-angkut`, `/mobil`.
- Blocking access to `/(tabs)/home`.

## Key Decisions
- Update `frontend/app/index.tsx` for initial redirect after hydration.
- Update `frontend/app/(auth)/login.tsx` for redirect after login and when already authenticated.
- Add a guard to `frontend/app/(tabs)/home.tsx` to redirect unauthorized roles.
- The `handleGoBack` fallbacks in each unit index could eventually be improved but they currenty rely on root redirect or home guard which works.

## State
- Done:
    - Updated `frontend/app/index.tsx` for initial redirect after hydration.
    - Updated `frontend/app/(auth)/login.tsx` for redirect after login and when already authenticated.
    - Implemented role guard in `frontend/app/(tabs)/home.tsx`.
    - Standardized navigation fallbacks to use root '/' in `Header` and business unit modules.
- Now:
    - Implementation complete.
- Next:
    - Final confirmation with user.

## Open Questions
- Should the "Home" tab itself be hidden in the `_layout` for these roles? (Currently `(tabs)/_layout.tsx` has `display: 'none'` for `tabBarStyle`, suggesting it might not be using the standard bottom bar).
- Is there a header logo that redirects to home? (Most units have a `ChevronLeft` or `Header` variant).

## Working Set
- `frontend/app/index.tsx`
- `frontend/app/(auth)/login.tsx`
- `frontend/app/(tabs)/home.tsx`
- `frontend/app/bengkel/index.tsx`
- `frontend/app/mobil/index.tsx`
- `frontend/app/jasa-angkut/index.tsx`
