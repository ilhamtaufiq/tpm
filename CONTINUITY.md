# Continuity Ledger - TPM Super App

## Goal
Implement "Batasi Akses Web" (Restrict Web Access) feature that can be toggled from the mobile app settings or via frontend environment variables. Also brand update from "Tulus Putra Mandiri" to "Tiga Putra Motor".

## Constraints/Assumptions
- Web access restriction redirects users to `/landing?reason=mobile_only`.
- Local setting `is_pin_enabled` is required for granular PIN protection, but platform-level access (like web restriction) should be configurable independently of PIN status.
- Frontend ENV `EXPO_PUBLIC_DISABLE_WEB_ACCESS` acts as a hard override (locks the feature to enabled).

## Key Decisions
- Moved "Batasi Akses Web" to a new "Akses Platform" section in `security-features.tsx` to separate it from page-level PIN protection.
- Added visual feedback (badge) when the setting is locked by an environment variable.
- Re-used existing redirection logic in `_layout.tsx` and `index.tsx`.
- Updated footer logo in `landing.tsx` to use the image asset `logo-tpm.png` and updated the brand name.

## State
- Done:
  - [x] Implementation of redirection logic in `app/_layout.tsx` and `app/index.tsx`.
  - [x] Landing page handling of `mobile_only` reason.
  - [x] UI Toggle in `app/settings/security-features.tsx` under new "Akses Platform" section.
  - [x] Brand identity update in `landing.tsx` (Logo & Name).
- Now:
  - Feature complete and ready for testing.
- Next:
  - Test on web browser to verify redirection when toggled ON.
  - Test on web browser with `EXPO_PUBLIC_DISABLE_WEB_ACCESS=true`.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- `frontend/app/_layout.tsx`
- `frontend/app/index.tsx`
- `frontend/app/landing.tsx`
- `frontend/app/settings/security-features.tsx`
- `frontend/store/useSecurityStore.ts`
- `backend/app/api/v1/security.py`
